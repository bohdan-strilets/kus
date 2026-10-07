import { useEffect, type RefObject } from 'react';
import { BLINK_FIRST_DELAY_MS, BLINK_JITTER_MS, BLINK_MIN_INTERVAL_MS } from '../hamster/hamster.constants';
import { isReducedMotion } from './motion.imperative';

const BLINK_CLASS = 'k-blink';

type UseBlinkOptions = { enabled: boolean };

/** Додає .k-blink на svg хом'яка раз на 4–6 с. Саме кліпання — CSS у hamster.css. */
export const useBlink = (ref: RefObject<SVGSVGElement | null>, { enabled }: UseBlinkOptions): void => {
  useEffect(() => {
    if (!enabled || isReducedMotion()) return;
    let timer: ReturnType<typeof setTimeout>;

    const tick = () => {
      const el = ref.current;
      if (el) {
        el.classList.remove(BLINK_CLASS);
        // Читання layout перезапускає CSS-анімацію
        void el.getBoundingClientRect();
        el.classList.add(BLINK_CLASS);
      }
      timer = setTimeout(tick, BLINK_MIN_INTERVAL_MS + Math.random() * BLINK_JITTER_MS);
    };

    timer = setTimeout(tick, BLINK_FIRST_DELAY_MS);
    return () => clearTimeout(timer);
  }, [ref, enabled]);
};
