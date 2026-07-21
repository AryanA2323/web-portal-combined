import { useEffect, useRef } from 'react';

/**
 * A custom hook to automatically run a refresh callback periodically
 * and instantly when the browser tab becomes visible again.
 * 
 * @param {Function} callback - The function to run (e.g. fetch data)
 * @param {number} intervalMs - Polling interval in milliseconds (default 30000ms)
 * @param {boolean} enabled - Whether polling is active (default true)
 */
export default function useAutoRefresh(callback, intervalMs = 30000, enabled = true) {
  const savedCallback = useRef(callback);

  // Remember the latest callback if it changes
  useEffect(() => {
    savedCallback.current = callback;
  }, [callback]);

  // Set up the interval
  useEffect(() => {
    if (!enabled) return;

    const tick = () => {
      if (savedCallback.current) {
        savedCallback.current(true); // Pass true to indicate it's an auto-refresh
      }
    };

    const id = setInterval(tick, intervalMs);
    return () => clearInterval(id);
  }, [intervalMs, enabled]);

  // Set up visibility change listener
  useEffect(() => {
    if (!enabled) return;

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        if (savedCallback.current) {
          savedCallback.current(true); // Pass true to indicate it's an auto-refresh
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [enabled]);
}
