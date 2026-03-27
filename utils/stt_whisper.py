"""
utils/stt_whisper.py

Replaces Groq Whisper API with Gemini 2.5 Flash Audio Transcription.
Drop-in replacement — same function signature as before.
"""
from __future__ import annotations

import base64
import logging
import os
from pathlib import Path

import requests

logger = logging.getLogger(__name__)


def _resolve_suffix(filename: str | None) -> str:
    if filename:
        s = Path(filename).suffix.strip().lower()
        if s in {".webm", ".wav", ".mp3", ".m4a", ".mp4", ".ogg", ".oga"}:
            return s
    return ".webm"


def _mime(suffix: str) -> str:
    return {
        ".webm": "audio/webm",
        ".wav":  "audio/wav",
        ".mp3":  "audio/mpeg",
        ".m4a":  "audio/mp4",
        ".mp4":  "audio/mp4",
        ".ogg":  "audio/ogg",
        ".oga":  "audio/ogg",
    }.get(suffix, "audio/webm")


def transcribe_audio_bytes(
    audio_bytes: bytes,
    language: str | None = None,
    *,
    filename: str | None = None,
    context_hint: str | None = None,
) -> dict[str, object]:
    """
    Transcribe audio bytes using Groq API.
    """
    if not audio_bytes:
        return {
            "text": "",
            "confidence": 0.0,
            "low_confidence": True,
            "language": language or "en",
        }

    api_key = os.getenv("GROQ_API_KEY", "")
    if not api_key:
        raise RuntimeError("GROQ_API_KEY is not set in .env")

    model = os.getenv("GROQ_WHISPER_MODEL", "whisper-large-v3-turbo").strip()
    url = "https://api.groq.com/openai/v1/audio/transcriptions"

    suffix = _resolve_suffix(filename)
    form_filename = filename if filename else f"audio{suffix}"

    headers = {
        "Authorization": f"Bearer {api_key}"
    }

    files = {
        "file": (form_filename, audio_bytes)
    }
    
    data = {"model": model, "response_format": "verbose_json"}
    
    if language:
        data["language"] = language
    if context_hint:
        data["prompt"] = context_hint

    try:
        response = requests.post(url, headers=headers, files=files, data=data, timeout=60)
        
        try:
            response.raise_for_status()
        except Exception:
            logger.error("Groq API Error: %s", response.text)
            raise

        response_data = response.json()
        text = response_data.get("text", "").strip()
        
        confidence = 0.92
        segments = response_data.get("segments", [])
        if segments:
            import math
            probs = [seg.get("avg_logprob", -1) for seg in segments]
            avg_prob = sum(probs) / len(probs) if probs else -1
            confidence = math.exp(avg_prob) if avg_prob < 0 else 0.92

        return {
            "text": text,
            "confidence": confidence if text else 0.0,
            "low_confidence": not bool(text),
            "language": response_data.get("language", language or "en"),
        }

    except Exception as exc:
        logger.error("Groq audio transcription failed: %s", exc)
        raise RuntimeError(f"Transcription failed: {exc}") from exc
