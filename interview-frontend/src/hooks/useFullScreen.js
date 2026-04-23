/**
 * useFullScreen.js
 *
 * Prompts user to enter full-screen mode on interview start.
 * Warns if user exits full-screen (doesn't stop interview).
 * Tracks full-screen exit count for proctoring.
 *
 * Usage:
 *   const { isFullScreen, exitCount, requestFullScreen } = useFullScreen({
 *     enabled: true,
 *     onExitWarning: (count) => sendToBackend(count)
 *   });
 */

import { useCallback, useEffect, useRef, useState } from "react";

export function useFullScreen({ enabled = true, onExitWarning = null }) {
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [exitCount, setExitCount] = useState(0);
  const [showPrompt, setShowPrompt] = useState(false);
  const [hasRequested, setHasRequested] = useState(false);

  const exitCountRef = useRef(0);
  const isCurrentlyFullScreen = useRef(false);

  const checkFullScreen = useCallback(() => {
    const fs = !!(
      document.fullscreenElement ||
      document.webkitFullscreenElement ||
      document.mozFullScreenElement ||
      document.msFullscreenElement
    );
    setIsFullScreen(fs);
    return fs;
  }, []);

  const requestFullScreen = useCallback(async () => {
    if (!document.documentElement) return false;
    try {
      const el = document.documentElement;
      if (el.requestFullscreen) {
        await el.requestFullscreen();
      } else if (el.webkitRequestFullscreen) {
        await el.webkitRequestFullscreen();
      } else if (el.mozRequestFullScreen) {
        await el.mozRequestFullScreen();
      } else if (el.msRequestFullscreen) {
        await el.msRequestFullscreen();
      }
      setHasRequested(true);
      return true;
    } catch {
      return false;
    }
  }, []);

  const exitFullScreen = useCallback(async () => {
    try {
      if (document.exitFullscreen) {
        await document.exitFullscreen();
      } else if (document.webkitExitFullscreen) {
        await document.webkitExitFullscreen();
      } else if (document.mozCancelFullScreen) {
        await document.mozCancelFullScreen();
      } else if (document.msExitFullscreen) {
        await document.msExitFullscreen();
      }
    } catch { }
  }, []);

  const handleFullScreenChange = useCallback(() => {
    const nowFs = checkFullScreen();

    // User was in full-screen and now exited
    if (isCurrentlyFullScreen.current && !nowFs && hasRequested) {
      exitCountRef.current += 1;
      setExitCount(exitCountRef.current);

      // Trigger warning callback if provided
      if (onExitWarning) {
        onExitWarning(exitCountRef.current);
      }

      // Show prompt to re-enter
      setShowPrompt(true);
    }

    isCurrentlyFullScreen.current = nowFs;
  }, [checkFullScreen, hasRequested, onExitWarning]);

  const handleKeyDown = useCallback((e) => {
    // Detect F11 or Escape attempts
    if (e.key === "Escape" && hasRequested && !isFullScreen) {
      e.preventDefault();
      setShowPrompt(true);
    }
  }, [hasRequested, isFullScreen]);

  useEffect(() => {
    if (!enabled) return;

    // Check initial state
    checkFullScreen();

    // Listen for fullscreen changes
    document.addEventListener("fullscreenchange", handleFullScreenChange);
    document.addEventListener("webkitfullscreenchange", handleFullScreenChange);
    document.addEventListener("mozfullscreenchange", handleFullScreenChange);
    document.addEventListener("MSFullscreenChange", handleFullScreenChange);

    // Listen for escape key
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("fullscreenchange", handleFullScreenChange);
      document.removeEventListener("webkitfullscreenchange", handleFullScreenChange);
      document.removeEventListener("mozfullscreenchange", handleFullScreenChange);
      document.removeEventListener("MSFullscreenChange", handleFullScreenChange);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [enabled, checkFullScreen, handleFullScreenChange, handleKeyDown]);

  // Auto-prompt on mount if enabled
  useEffect(() => {
    if (enabled && !hasRequested) {
      // Delay slightly to let page load
      const timer = setTimeout(() => setShowPrompt(true), 1500);
      return () => clearTimeout(timer);
    }
  }, [enabled, hasRequested]);

  const dismissPrompt = useCallback(() => {
    setShowPrompt(false);
  }, []);

  const reRequestFullScreen = useCallback(async () => {
    const success = await requestFullScreen();
    if (success) {
      setShowPrompt(false);
    }
    return success;
  }, [requestFullScreen]);

  return {
    isFullScreen,
    exitCount,
    showPrompt,
    hasRequested,
    requestFullScreen,
    exitFullScreen,
    dismissPrompt,
    reRequestFullScreen,
  };
}