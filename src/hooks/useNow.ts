import { useEffect, useState } from 'react';

/**
 * A ticking `Date.now()`. Everything time-related is derived from timestamps
 * rather than accumulated in an interval, so throttled tabs stay accurate.
 */
export function useNow(intervalMs = 250, active = true): number {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!active) return;
    setNow(Date.now());
    const id = window.setInterval(() => setNow(Date.now()), intervalMs);
    const onVisible = () => setNow(Date.now());
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.clearInterval(id);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [intervalMs, active]);

  return now;
}
