"use client";

import { useCallback, useEffect, useState, useSyncExternalStore } from "react";

const noopSubscribe = () => () => {};

/**
 * Keeps the screen from dimming/locking while `enabled` is true, via the
 * Screen Wake Lock API. Browsers release the lock whenever the tab is hidden,
 * so it is re-requested each time the page becomes visible again, and it is
 * released when disabled or on unmount. `supported` is false during server
 * rendering and in browsers without the API (the toggle should be disabled).
 * If the browser refuses the lock (e.g. battery saver), `enabled` turns back
 * off and `error` explains why.
 */
export function useWakeLock() {
  const supported = useSyncExternalStore(
    noopSubscribe,
    () => "wakeLock" in navigator,
    () => false,
  );
  const [enabled, setEnabled] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled || !supported) return;

    let sentinel: WakeLockSentinel | null = null;
    let cancelled = false;

    async function acquire() {
      if (document.visibilityState !== "visible") return;
      if (sentinel && !sentinel.released) return;
      try {
        const lock = await navigator.wakeLock.request("screen");
        if (cancelled) {
          void lock.release();
          return;
        }
        sentinel = lock;
      } catch (err) {
        if (cancelled) return;
        setError(
          err instanceof Error && err.message
            ? `Couldn't keep the screen on: ${err.message}`
            : "Couldn't keep the screen on.",
        );
        setEnabled(false);
      }
    }

    function handleVisibilityChange() {
      void acquire();
    }

    void acquire();
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      void sentinel?.release();
    };
  }, [enabled, supported]);

  const toggle = useCallback(() => {
    setError(null);
    setEnabled((prev) => !prev);
  }, []);

  return { supported, enabled, error, toggle };
}
