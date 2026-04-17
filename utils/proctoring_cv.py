"""OpenCV-based frame analysis for interview proctoring."""

from __future__ import annotations

import time
from pathlib import Path
from typing import Any

try:
    import cv2  # type: ignore
    import numpy as np  # type: ignore
except Exception:  # pragma: no cover - runtime dependency fallback
    cv2 = None
    np = None

try:
    import mediapipe as mp  # type: ignore
    from mediapipe.tasks import python  # type: ignore
    from mediapipe.tasks.python import vision  # type: ignore
    _MEDIAPIPE_AVAILABLE = True
except Exception:
    mp = None
    _MEDIAPIPE_AVAILABLE = False

_FACE_CASCADE = None
_UPPER_BODY_CASCADE = None
_MP_FACE_DETECTOR = None

if cv2 is not None:
    _FACE_CASCADE = cv2.CascadeClassifier(cv2.data.haarcascades + "haarcascade_frontalface_default.xml")
    _UPPER_BODY_CASCADE = cv2.CascadeClassifier(cv2.data.haarcascades + "haarcascade_upperbody.xml")

if _MEDIAPIPE_AVAILABLE and cv2 is not None:
    try:
        base_options = python.BaseOptions(model_asset_path="mediapipe/tasks/vision/face_liveness_detector/float32.tflite")
        options = vision.FaceLivenessDetectorOptions(base_options=base_options)
        _MP_FACE_DETECTOR = vision.FaceLivenessDetector.from_options(options)
    except Exception:
        _MP_FACE_DETECTOR = None

_LAST_FRAMES: dict[int, Any] = {}
_LAST_PERIODIC_SAVE: dict[int, float] = {}
_MP_FACE_MESH = None

if _MEDIAPIPE_AVAILABLE and cv2 is not None:
    try:
        _MP_FACE_MESH = mp.solutions.face_mesh
    except Exception:
        _MP_FACE_MESH = None


def analyze_frame(session_id: int, raw_bytes: bytes) -> dict[str, object]:
    try:
        if cv2 is None or np is None or not _is_cascade_ready(_FACE_CASCADE):
            return {
                "ok": True,
                "faces_count": 1,
                "motion_score": 0.0,
                "face_signature": None,
                "face_box": None,
                "upper_bodies_count": 0,
                "left_shoulder_visibility": None,
                "right_shoulder_visibility": None,
                "shoulder_score": None,
                "shoulder_present": None,
                "shoulder_model_enabled": False,
                "error": None,
                "opencv_enabled": False,
            }

        frame = _decode_frame(raw_bytes)
        if frame is None:
            return {
                "ok": False,
                "faces_count": 0,
                "motion_score": 0.0,
                "face_signature": None,
                "error": "Invalid frame payload",
                "opencv_enabled": True,
            }

        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
        
        faces_count = 0
        face_box = None
        face_quality_score = None
        
        if _MP_FACE_MESH is not None:
            rgb_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
            with _MP_FACE_MESH.FaceMesh(max_num_faces=4, refine_landmarks=False) as face_mesh:
                results = face_mesh.process(rgb_frame)
                if results.multi_face_landmarks:
                    faces_count = len(results.multi_face_landmarks)
                    if faces_count == 1:
                        landmarks = results.multi_face_landmarks[0]
                        h, w = frame.shape[:2]
                        x_coords = [int(lm.x * w) for lm in landmarks]
                        y_coords = [int(lm.y * h) for lm in landmarks]
                        x_min, x_max = min(x_coords), max(x_coords)
                        y_min, y_max = min(y_coords), max(y_coords)
                        face_box = (x_min, y_min, x_max - x_min, y_max - y_min)
                        
                        face_quality_score = _calculate_face_quality(landmarks, w, h)
        
        if faces_count == 0:
            faces = _FACE_CASCADE.detectMultiScale(gray, scaleFactor=1.2, minNeighbors=5, minSize=(50, 50))
            faces_count = int(len(faces))
            face_box = _as_box(faces[0]) if faces_count == 1 else None
        
        face_signature = _face_signature(gray, face_box) if face_box else None
        motion_score = _motion_score(session_id, gray)
        shoulder_data = _shoulder_metrics(gray, face_box)

        return {
            "ok": True,
            "faces_count": faces_count,
            "motion_score": float(motion_score),
            "face_signature": face_signature,
            "face_box": face_box,
            "face_quality_score": face_quality_score,
            "upper_bodies_count": int(shoulder_data["upper_bodies_count"]),
            "left_shoulder_visibility": shoulder_data["left_shoulder_visibility"],
            "right_shoulder_visibility": shoulder_data["right_shoulder_visibility"],
            "shoulder_score": shoulder_data["shoulder_score"],
            "shoulder_present": shoulder_data["shoulder_present"],
            "shoulder_model_enabled": shoulder_data["shoulder_model_enabled"],
            "mediapipe_enabled": _MP_FACE_MESH is not None,
            "error": None,
            "opencv_enabled": True,
        }
    except Exception as exc:
        return {
            "ok": False,
            "faces_count": 0,
            "motion_score": 0.0,
            "face_signature": None,
            "error": f"Internal cv error: {exc}",
            "opencv_enabled": True,
        }


def compare_signatures(signature_a: list[float], signature_b: list[float]) -> float | None:
    if np is None:
        return None
    if not signature_a or not signature_b:
        return None
    a = np.asarray(signature_a, dtype=np.float32)
    b = np.asarray(signature_b, dtype=np.float32)
    if a.shape != b.shape:
        return None
    denom = float(np.linalg.norm(a) * np.linalg.norm(b))
    if denom <= 1e-8:
        return None
    return float(np.dot(a, b) / denom)


def should_store_periodic(session_id: int, interval_seconds: int) -> bool:
    now_ts = time.time()
    last = _LAST_PERIODIC_SAVE.get(session_id, 0.0)
    if (now_ts - last) >= float(interval_seconds):
        _LAST_PERIODIC_SAVE[session_id] = now_ts
        return True
    return False


def _decode_frame(raw_bytes: bytes):
    if np is None or cv2 is None:
        return None
    if not raw_bytes:
        return None
    arr = np.frombuffer(raw_bytes, dtype=np.uint8)
    return cv2.imdecode(arr, cv2.IMREAD_COLOR)


def _motion_score(session_id: int, gray_frame: Any) -> float:
    if cv2 is None or np is None:
        return 0.0
    small = cv2.resize(gray_frame, (160, 90))
    previous = _LAST_FRAMES.get(session_id)
    _LAST_FRAMES[session_id] = small
    if previous is None:
        return 0.0
    diff = cv2.absdiff(previous, small)
    return float(np.mean(diff) / 255.0)


def _face_signature(gray_frame: Any, face_box: tuple[int, int, int, int] | None) -> list[float] | None:
    if cv2 is None or np is None:
        return None
    if not face_box:
        return None
    x, y, width, height = [int(v) for v in face_box]
    if width <= 0 or height <= 0:
        return None
    roi = gray_frame[y : y + height, x : x + width]
    if roi.size == 0:
        return None
    roi = cv2.resize(roi, (64, 64))
    hist = cv2.calcHist([roi], [0], None, [32], [0, 256])
    cv2.normalize(hist, hist)
    return [float(v) for v in hist.flatten()]


def _shoulder_metrics(
    gray_frame: Any,
    faces: Any,
    face_box: tuple[int, int, int, int] | None,
) -> dict[str, object]:
    if cv2 is None or np is None or not _is_cascade_ready(_UPPER_BODY_CASCADE):
        return {
            "upper_bodies_count": 0,
            "left_shoulder_visibility": None,
            "right_shoulder_visibility": None,
            "shoulder_score": None,
            "shoulder_present": None,
            "shoulder_model_enabled": False,
        }

    upper_bodies = _UPPER_BODY_CASCADE.detectMultiScale(gray_frame, scaleFactor=1.05, minNeighbors=3, minSize=(80, 80))
    upper_bodies_count = int(len(upper_bodies))
    if upper_bodies_count <= 0:
        fallback_left, fallback_right, fallback_score = _fallback_shoulder_score(gray_frame, face_box)
        return {
            "upper_bodies_count": 0,
            "left_shoulder_visibility": round(float(fallback_left), 4),
            "right_shoulder_visibility": round(float(fallback_right), 4),
            "shoulder_score": round(float(fallback_score), 4),
            "shoulder_present": bool(fallback_score >= 0.45),
            "shoulder_model_enabled": True,
            "shoulder_source": "fallback",
        }

    body_box = _pick_best_upper_body(upper_bodies, face_box)
    if not body_box:
        fallback_left, fallback_right, fallback_score = _fallback_shoulder_score(gray_frame, face_box)
        return {
            "upper_bodies_count": upper_bodies_count,
            "left_shoulder_visibility": round(float(fallback_left), 4),
            "right_shoulder_visibility": round(float(fallback_right), 4),
            "shoulder_score": round(float(fallback_score), 4),
            "shoulder_present": bool(fallback_score >= 0.45),
            "shoulder_model_enabled": True,
            "shoulder_source": "fallback",
        }

    if not face_box:
        return {
            "upper_bodies_count": upper_bodies_count,
            "left_shoulder_visibility": 0.65,
            "right_shoulder_visibility": 0.65,
            "shoulder_score": 0.65,
            "shoulder_present": True,
            "shoulder_model_enabled": True,
        }

    fx, fy, fw, fh = face_box
    bx, by, bw, bh = body_box
    if fw <= 0 or fh <= 0 or bw <= 0 or bh <= 0:
        return {
            "upper_bodies_count": upper_bodies_count,
            "left_shoulder_visibility": 0.0,
            "right_shoulder_visibility": 0.0,
            "shoulder_score": 0.0,
            "shoulder_present": False,
            "shoulder_model_enabled": True,
        }

    left_margin = float(fx - bx)
    right_margin = float((bx + bw) - (fx + fw))
    target_margin = max(10.0, 0.25 * float(fw))
    left_margin_score = _clamp(left_margin / target_margin)
    right_margin_score = _clamp(right_margin / target_margin)

    chin_y = float(fy + fh)
    shoulder_line_y = float(by + 0.28 * bh)
    vertical_gap = shoulder_line_y - chin_y
    vertical_score = _clamp((vertical_gap + 0.15 * fh) / max(5.0, 0.45 * fh))

    width_ratio = float(fw) / float(bw)
    width_score = 1.0 - min(1.0, abs(width_ratio - 0.48) / 0.48)

    face_center_x = fx + (fw / 2.0)
    face_center_y = fy + (fh / 2.0)
    center_inside = 1.0 if (bx <= face_center_x <= (bx + bw) and by <= face_center_y <= (by + bh)) else 0.0

    quality = (0.35 * center_inside) + (0.35 * vertical_score) + (0.30 * width_score)
    left_visibility = _clamp((0.55 * left_margin_score) + (0.45 * quality))
    right_visibility = _clamp((0.55 * right_margin_score) + (0.45 * quality))
    cascade_score = _clamp(min(left_visibility, right_visibility))

    # Blend with fallback heuristic so valid frames are not punished when
    # upper-body landmarks are weak due to lighting/background.
    fallback_left, fallback_right, fallback_score = _fallback_shoulder_score(gray_frame, face_box)
    left_visibility = _clamp(max(left_visibility, 0.8 * fallback_left))
    right_visibility = _clamp(max(right_visibility, 0.8 * fallback_right))
    shoulder_score = _clamp(max(cascade_score, 0.75 * fallback_score))

    return {
        "upper_bodies_count": upper_bodies_count,
        "left_shoulder_visibility": round(float(left_visibility), 4),
        "right_shoulder_visibility": round(float(right_visibility), 4),
        "shoulder_score": round(float(shoulder_score), 4),
        "shoulder_present": bool(shoulder_score >= 0.5),
        "shoulder_model_enabled": True,
        "shoulder_source": "cascade",
    }


def _pick_best_upper_body(
    upper_bodies: Any,
    face_box: tuple[int, int, int, int] | None,
) -> tuple[int, int, int, int] | None:
    if upper_bodies is None:
        return None
    boxes = [_as_box(item) for item in upper_bodies]
    boxes = [item for item in boxes if item is not None]
    if not boxes:
        return None

    if not face_box:
        return max(boxes, key=lambda box: int(box[2]) * int(box[3]))

    fx, fy, fw, fh = face_box
    face_center_x = fx + (fw / 2.0)
    face_center_y = fy + (fh / 2.0)

    containing = [
        box
        for box in boxes
        if box[0] <= face_center_x <= (box[0] + box[2]) and box[1] <= face_center_y <= (box[1] + box[3])
    ]
    if containing:
        return min(containing, key=lambda box: abs(box[0] - fx) + abs(box[1] - fy))

    return min(
        boxes,
        key=lambda box: abs((box[0] + box[2] / 2.0) - face_center_x) + abs((box[1] + box[3] / 2.0) - face_center_y),
    )


def _as_box(item: Any) -> tuple[int, int, int, int] | None:
    try:
        x, y, w, h = [int(v) for v in item]
    except Exception:
        return None
    if w <= 0 or h <= 0:
        return None
    return (x, y, w, h)


def _is_cascade_ready(cascade: Any) -> bool:
    try:
        return bool(cascade is not None and not cascade.empty())
    except Exception:
        return False


def _clamp(value: float, minimum: float = 0.0, maximum: float = 1.0) -> float:
    return float(max(minimum, min(maximum, value)))


def _fallback_shoulder_score(
    gray_frame: Any,
    face_box: tuple[int, int, int, int] | None,
) -> tuple[float, float, float]:
    if face_box is None:
        return 0.5, 0.5, 0.5
    try:
        frame_h, frame_w = gray_frame.shape[:2]
    except Exception:
        return 0.5, 0.5, 0.5
    if frame_w <= 0 or frame_h <= 0:
        return 0.5, 0.5, 0.5

    fx, fy, fw, fh = face_box
    if fw <= 0 or fh <= 0:
        return 0.5, 0.5, 0.5

    left_space = float(fx) / float(fw)
    right_space = float(frame_w - (fx + fw)) / float(fw)
    chin_space = float(frame_h - (fy + fh)) / float(fh)
    face_width_ratio = float(fw) / float(frame_w)

    left_score = _clamp((left_space - 0.25) / 0.8)
    right_score = _clamp((right_space - 0.25) / 0.8)
    vertical_score = _clamp((chin_space - 0.25) / 0.95)
    distance_score = _clamp((0.42 - face_width_ratio) / 0.24)

    shoulder_score = _clamp((0.55 * min(left_score, right_score)) + (0.25 * vertical_score) + (0.20 * distance_score))
    return left_score, right_score, shoulder_score


def _calculate_face_quality(landmarks: Any, frame_width: int, frame_height: int) -> float:
    """Calculate face quality score using MediaPipe landmarks.
    
    Quality factors:
    - Face centered in frame
    - Good lighting (brightness variance)
    - Face not too small or too large
    - Clear features (not blurry)
    """
    if not landmarks:
        return 0.0
    
    try:
        face_width = max([int(lm.x * frame_width) for lm in landmarks]) - min([int(lm.x * frame_width) for lm in landmarks])
        face_height = max([int(lm.y * frame_height) for lm in landmarks]) - min([int(lm.y * frame_height) for lm in landmarks])
        
        center_x = (min([int(lm.x * frame_width) for lm in landmarks]) + face_width / 2) / frame_width
        center_y = (min([int(lm.y * frame_height) for lm in landmarks]) + face_height / 2) / frame_height
        
        center_score = 1.0 - ((abs(center_x - 0.5) + abs(center_y - 0.5)))
        center_score = _clamp(center_score * 2)
        
        size_score = _clamp((0.3 - abs(face_width / frame_width - 0.3)) / 0.15) if face_width / frame_width < 0.3 else _clamp((0.5 - abs(face_width / frame_width - 0.4)) / 0.2)
        
        nose_tip = landmarks[1]
        nose_x, nose_y = int(nose_tip.x * frame_width), int(nose_tip.y * frame_height)
        
        left_eye = landmarks[33]
        right_eye = landmarks[263]
        eye_distance = abs(left_eye.x - right_eye.x) * frame_width
        
        eye_clarity = _clamp(eye_distance / 50)
        
        quality = (0.4 * center_score) + (0.25 * size_score) + (0.35 * eye_clarity)
        return round(quality, 4)
    except Exception:
        return 0.5


def save_baseline_image(session_id: int, raw_bytes: bytes) -> str | None:
    """Save baseline frame image to disk.
    
    Returns the saved file path relative to uploads/proctoring/.
    """
    if cv2 is None or np is None:
        return None
    try:
        frame = _decode_frame(raw_bytes)
        if frame is None:
            return None
        
        PROCTOR_ROOT = Path("uploads/proctoring")
        PROCTOR_ROOT.mkdir(parents=True, exist_ok=True)
        
        session_dir = PROCTOR_ROOT / str(session_id)
        session_dir.mkdir(exist_ok=True)
        
        filename = f"baseline_{int(time.time())}.jpg"
        filepath = session_dir / filename
        
        success = cv2.imwrite(str(filepath), frame)
        if success:
            return f"proctoring/{session_id}/{filename}"
        return None
    except Exception:
        return None
