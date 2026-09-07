import { useEffect } from 'react';

interface WakeLockSentinelLike {
  release: () => Promise<void>;
  released: boolean;
}

/** Keeps the screen on while a workout is running, where the browser allows it. */
export function useWakeLock(active: boolean) {
  useEffect(() => {
    if (!active) return;
    const wakeLock = (
      navigator as unknown as {
        wakeLock?: { request: (type: 'screen') => Promise<WakeLockSentinelLike> };
      }
    ).wakeLock;
    if (!wakeLock) return;

    let sentinel: WakeLockSentinelLike | null = null;
    let cancelled = false;

    const request = async () => {
      try {
        const next = await wakeLock.request('screen');
        if (cancelled) {
          void next.release();
          return;
        }
        sentinel = next;
      } catch {
        // Denied or unsupported — the timer still runs, the screen may dim.
      }
    };

    // The lock is dropped when the tab is hidden; re-take it on return.
    const onVisibility = () => {
      if (document.visibilityState === 'visible' && (!sentinel || sentinel.released)) {
        void request();
      }
    };

    void request();
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', onVisibility);
      void sentinel?.release().catch(() => undefined);
    };
  }, [active]);
}
