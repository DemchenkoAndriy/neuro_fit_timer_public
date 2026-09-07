import { useCallback } from 'react';

export function useVibrate(enabled: boolean) {
  return useCallback(
    (pattern: number | number[]) => {
      if (!enabled) return;
      try {
        navigator.vibrate?.(pattern);
      } catch {
        // Unsupported on desktop and iOS Safari — silently skip.
      }
    },
    [enabled],
  );
}
