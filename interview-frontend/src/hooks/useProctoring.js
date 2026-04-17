/**
 * useProctoring.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Lightweight proctoring hook for the Interview page.
 *
 * Features (all run asynchronously, none block the UI thread):
 *   1. Tab-switch detection   — visibilitychange event
 *   2. Face quality detection — brightness/texture heuristic for face clarity
 *                               Runs every 4 s, auto-disabled if FPS < 20.
 *   3. Voice confidence       — pure heuristic on transcript text:
 *                               speaking rate, filler words, sentence fragmentation.
 *
 * All events are stored in a local ref array AND sent to the backend via the
 * existing proctorApi.uploadFrame / interviewApi event endpoints.
 *
 * Usage:
 *   const { proctoringEvents, voiceMetrics, faceQualitySignal } = useProctoring({
 *     sessionId,
 *     videoRef,
 *     enabled: true,
 *   });
 */

import { useCallback, useEffect, useRef, useState } from "react";

// ── constants ─────────────────────────────────────────────────────────────────
const EMOTION_INTERVAL_MS   = 4000;   // analyse every 4 s
const FPS_DISABLE_THRESHOLD = 20;     // disable emotion if FPS < 20
const FPS_SAMPLE_INTERVAL   = 2000;   // measure FPS every 2 s
const MAX_EVENTS_STORED     = 200;    // cap local event buffer

// Filler words that indicate hesitation
const FILLER_WORDS = [
  "uh", "um", "er", "ah", "like", "you know", "i mean",
  "basically", "literally", "actually", "sort of", "kind of",
];

// ── helpers ───────────────────────────────────────────────────────────────────

/** Estimate face quality from brightness and variance of the face region.
 *  Not ML — just a brightness/texture heuristic that's near-zero CPU cost.
 *  Returns { quality, clarity, lighting } */
function estimateFaceQualityFromFrame(videoEl) {
  try {
    if (!videoEl || videoEl.videoWidth === 0) return null;
    const W = 80, H = 80; // tiny canvas for speed
    const canvas = document.createElement("canvas");
    canvas.width = W; canvas.height = H;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(videoEl, 0, 0, W, H);
    const { data } = ctx.getImageData(0, 0, W, H);

    let sum = 0, sumSq = 0, n = data.length / 4;
    for (let i = 0; i < data.length; i += 4) {
      const luma = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
      sum += luma;
      sumSq += luma * luma;
    }
    const mean = sum / n;
    const variance = sumSq / n - mean * mean;
    const stddev = Math.sqrt(Math.max(0, variance));

    // Face quality estimation from brightness and clarity:
    // Good lighting (100-180 mean), clear features (high stddev from edges)
    // Quality: 0-1 score based on lighting and clarity
    let overall, lighting, clarity;
    if (mean >= 100 && mean <= 180 && stddev >= 25) {
      overall = Math.min(0.95, 0.5 + stddev / 150);
      lighting = 0.85;
      clarity = Math.min(0.9, stddev / 80);
    } else if (mean < 80) {
      overall = 0.35;
      lighting = 0.4;
      clarity = 0.3;
    } else if (mean > 180) {
      overall = 0.45;
      lighting = 0.5;
      clarity = 0.4;
    } else {
      overall = 0.55;
      lighting = 0.65;
      clarity = 0.5;
    }
    return { 
      quality: parseFloat(overall.toFixed(2)), 
      clarity: parseFloat(clarity.toFixed(2)),
      lighting: parseFloat(lighting.toFixed(2))
    };
  } catch {
    return null;
  }
}

/** Analyse a transcript string for voice confidence heuristics. */
function analyseVoiceConfidence(transcript, durationSeconds) {
  if (!transcript || durationSeconds <= 0) return null;

  const words = transcript.trim().split(/\s+/).filter(Boolean);
  const wordCount = words.length;
  if (wordCount < 3) return null;

  const speakingRate = Math.round((wordCount / durationSeconds) * 60); // words/min

  const lowerWords = transcript.toLowerCase();
  let fillerCount = 0;
  FILLER_WORDS.forEach((f) => {
    const re = new RegExp(`\\b${f}\\b`, "g");
    const matches = lowerWords.match(re);
    if (matches) fillerCount += matches.length;
  });

  const hesitationScore = parseFloat(
    Math.min(1, fillerCount / Math.max(1, wordCount / 5)).toFixed(2)
  );

  // Speaking rate: 120–180 wpm = confident, < 80 or > 220 = nervous
  let rateScore = 1.0;
  if (speakingRate < 80 || speakingRate > 220) rateScore = 0.5;
  else if (speakingRate < 100 || speakingRate > 200) rateScore = 0.75;

  const confidenceScore = parseFloat(
    ((rateScore * 0.6) + ((1 - hesitationScore) * 0.4)).toFixed(2)
  );

  return {
    speaking_rate: speakingRate,
    word_count: wordCount,
    filler_count: fillerCount,
    hesitation_score: hesitationScore,
    confidence_score: confidenceScore,
    duration_seconds: Math.round(durationSeconds),
  };
}

// ── main hook ─────────────────────────────────────────────────────────────────
export function useProctoring({ sessionId, resultId, videoRef, enabled = true }) {
  const [proctoringEvents, setProctoringEvents] = useState([]);
  const [voiceMetrics, setVoiceMetrics]         = useState(null);
  const [emotionSignal, setEmotionSignal]        = useState(null);
  const [emotionEnabled, setEmotionEnabled]      = useState(true);

  const eventsRef        = useRef([]);
  const emotionTimerRef  = useRef(null);
  const fpsTimerRef      = useRef(null);
  const frameCountRef    = useRef(0);
  const lastFpsCheckRef  = useRef(0);
  const rafRef           = useRef(null);

  // Push an event into local state + ref buffer
  const pushEvent = useCallback((event) => {
    const stamped = { ...event, timestamp: new Date().toISOString() };
    eventsRef.current = [stamped, ...eventsRef.current].slice(0, MAX_EVENTS_STORED);
    setProctoringEvents((prev) => [stamped, ...prev].slice(0, MAX_EVENTS_STORED));
  }, []);

  // ── 1. TAB SWITCH DETECTION ────────────────────────────────────────────────
  useEffect(() => {
    if (!enabled || !sessionId) return;

    function onVisibilityChange() {
      if (document.hidden) {
        const event = { type: "TAB_SWITCH", detail: "Candidate switched browser tab" };
        pushEvent(event);
        // Use resultId (token) for the event endpoint — falls back to sessionId if resultId is missing.
        const eventTargetId = resultId || sessionId;
        if (eventTargetId) {
          fetch(`/api/interview/${eventTargetId}/event`, {
            method: "POST",
            credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              event_type: "tab_switch",
              detail: "Candidate switched away from the interview tab",
              timestamp: new Date().toISOString(),
              meta: { hidden: true },
            }),
          }).catch(() => {}); // silent fail — never block interview
        }
      }
    }

    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => document.removeEventListener("visibilitychange", onVisibilityChange);
  }, [enabled, sessionId, resultId, pushEvent]);

  // ── 2. FACE QUALITY DETECTION (lightweight, auto-disables on low FPS) ──────────
  useEffect(() => {
    if (!enabled || !sessionId) return;

    lastFpsCheckRef.current = Date.now();

    // Start FPS tracking
    const tick = () => {
      frameCountRef.current += 1;
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);

    // Check FPS every 2 s, disable face quality if too low
    fpsTimerRef.current = setInterval(() => {
      const now = Date.now();
      const elapsed = (now - lastFpsCheckRef.current) / 1000;
      const fps = frameCountRef.current / elapsed;
      frameCountRef.current = 0;
      lastFpsCheckRef.current = now;

      if (fps < FPS_DISABLE_THRESHOLD && emotionEnabled) {
        setEmotionEnabled(false);
      } else if (fps >= FPS_DISABLE_THRESHOLD + 5 && !emotionEnabled) {
        setEmotionEnabled(true);
      }
    }, FPS_SAMPLE_INTERVAL);

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      if (fpsTimerRef.current) clearInterval(fpsTimerRef.current);
    };
  }, [enabled, sessionId, emotionEnabled]);

  useEffect(() => {
    if (!enabled || !sessionId || !emotionEnabled) {
      if (emotionTimerRef.current) clearInterval(emotionTimerRef.current);
      return;
    }

    emotionTimerRef.current = setInterval(() => {
      // Run in a setTimeout so it never blocks the render loop
      setTimeout(() => {
        const video = videoRef?.current;
        // Now using face quality instead of emotion
        const result = estimateFaceQualityFromFrame(video);
        if (!result) return;

        setEmotionSignal(result);
        pushEvent({ type: "FACE_QUALITY", ...result });
      }, 0);
    }, EMOTION_INTERVAL_MS);

    return () => { if (emotionTimerRef.current) clearInterval(emotionTimerRef.current); };
  }, [enabled, sessionId, emotionEnabled, videoRef, pushEvent]);

  // ── 3. VOICE CONFIDENCE — called externally when an answer is submitted ────
  const analyseAnswer = useCallback((transcript, durationSeconds) => {
    const metrics = analyseVoiceConfidence(transcript, durationSeconds);
    if (!metrics) return null;
    setVoiceMetrics(metrics);
    pushEvent({ type: "VOICE_CONFIDENCE", ...metrics });
    return metrics;
  }, [pushEvent]);

  // ── cleanup ────────────────────────────────────────────────────────────────
  useEffect(() => {
    return () => {
      if (rafRef.current)       cancelAnimationFrame(rafRef.current);
      if (emotionTimerRef.current) clearInterval(emotionTimerRef.current);
      if (fpsTimerRef.current)  clearInterval(fpsTimerRef.current);
    };
  }, []);

  return {
    proctoringEvents,   // all local events (tab switch, emotion, voice)
    voiceMetrics,       // latest voice confidence metrics
    emotionSignal,      // latest emotion detection result
    emotionEnabled,     // false if auto-disabled due to low FPS
    analyseAnswer,      // call with (transcript, durationSeconds) after each answer
  };
}
