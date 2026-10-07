import { useEffect, useState } from 'react';

const DEFAULT_DELAY_MS = 300;

/** true лише якщо `isActive` тримається довше `delayMs` — щоб лоадер не миготів на швидких запитах. */
export const useDelayedFlag = (isActive: boolean, delayMs = DEFAULT_DELAY_MS): boolean => {
  const [isShown, setIsShown] = useState(false);

  useEffect(() => {
    if (!isActive) {
      setIsShown(false);
      return;
    }
    const timer = setTimeout(() => setIsShown(true), delayMs);
    return () => clearTimeout(timer);
  }, [isActive, delayMs]);

  return isShown;
};
