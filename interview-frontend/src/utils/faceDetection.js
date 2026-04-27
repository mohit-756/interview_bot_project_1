// Lazy face detection using face-api.js (optional)
// Load models only once when the function is first called.
let modelsLoaded = false;

export async function detectFaces(videoElement) {
  if (!videoElement) return 0;
  // Dynamically import face-api to avoid loading it in builds that don't need it
  const faceapi = await import('face-api.js');
  if (!modelsLoaded) {
    await Promise.all([
      faceapi.nets.tinyFaceDetector.loadFromUri('/models'),
      // add other models if needed
    ]);
    modelsLoaded = true;
  }
  const detections = await faceapi.detectAllFaces(
    videoElement,
    new faceapi.TinyFaceDetectorOptions()
  );
  return detections.length;
}
