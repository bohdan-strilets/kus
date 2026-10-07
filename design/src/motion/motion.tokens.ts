import type { Transition, Variants } from 'motion/react';

// Тривалості й криві руху Kusik. Значення 1:1 з tokens.json → motion. Демо: interactive/motion.html.
// У корені застосунку: <MotionConfig reducedMotion="user"> — тоді варіанти нижче самі поважають reduced motion.

export const DURATION_MS = { fast: 120, base: 200, slow: 320, celebrateMax: 1000 } as const;

type CubicBezier = [number, number, number, number];

export const EASE: Record<'out' | 'spring' | 'in', CubicBezier> = {
  out: [0.2, 0.8, 0.2, 1],
  spring: [0.34, 1.56, 0.64, 1],
  in: [0.4, 0, 1, 1],
};

const toSeconds = (ms: number): number => ms / 1000;

export const TRANSITION: Record<'fast' | 'base' | 'slow' | 'pop' | 'exit', Transition> = {
  fast: { duration: toSeconds(DURATION_MS.fast), ease: EASE.out },
  base: { duration: toSeconds(DURATION_MS.base), ease: EASE.out },
  slow: { duration: toSeconds(DURATION_MS.slow), ease: EASE.out },
  pop: { duration: 0.3, ease: EASE.spring },
  exit: { duration: 0.25, ease: EASE.in },
};

/** Нова бульбашка в чаті: знизу 14px + opacity. */
export const bubbleVariants: Variants = {
  hidden: { opacity: 0, y: 14 },
  visible: { opacity: 1, y: 0, transition: TRANSITION.base },
};

/** Рядки картки страви каскадом, крок 60 мс. Батьку — staggerChildren. */
export const ROW_STAGGER_S = 0.06;
export const rowVariants: Variants = {
  hidden: { opacity: 0, y: 6 },
  visible: { opacity: 1, y: 0, transition: TRANSITION.base },
};

/** Bottom sheet: відкриття 320 мс out, закриття 250 мс in. */
export const sheetVariants: Variants = {
  hidden: { y: '105%', transition: TRANSITION.exit },
  visible: { y: 0, transition: TRANSITION.slow },
};
export const scrimVariants: Variants = {
  hidden: { opacity: 0, transition: TRANSITION.exit },
  visible: { opacity: 1, transition: TRANSITION.slow },
};

/** Контент вкладки: з 8px праворуч. */
export const tabContentVariants: Variants = {
  hidden: { opacity: 0, x: 8 },
  visible: { opacity: 1, x: 0, transition: TRANSITION.base },
};

/** Бейдж «записано»: 0 → 1.25 → 1. */
export const popInVariants: Variants = {
  hidden: { scale: 0 },
  visible: { scale: [0, 1.25, 1], transition: { ...TRANSITION.pop, times: [0, 0.6, 1] } },
};

/** Підскок хом'яка при зміні настрою — запускати через animate-контролер або key. */
export const HOP_KEYFRAMES = { y: [0, -8, 0] };
export const HOP_TRANSITION: Transition = { duration: 0.3, ease: EASE.spring, times: [0, 0.4, 1] };

/** Помилка в полі: трусіння 300 мс linear. */
export const SHAKE_KEYFRAMES = { x: [0, -6, 6, -4, 4, 0] };
export const SHAKE_TRANSITION: Transition = { duration: 0.3, ease: 'linear' };

/** Натиск на кнопку/варіант/чип. */
export const PRESS = { whileTap: { scale: 0.96 }, transition: TRANSITION.fast };

/** Кільце калорій: заповнення 700 мс; при переборі — пауза 120 мс, потім дуга over 400 мс. */
export const RING_FILL_MS = 700;
export const RING_OVER_DELAY_MS = 120;
export const RING_OVER_MS = 400;

/** Смужки макросів: 600 мс, затримка 120 + i·80. */
export const BAR_FILL_MS = 600;
export const BAR_DELAY_MS = 120;
export const BAR_STEP_MS = 80;
