import { animate } from 'motion';
import { EASE, RING_FILL_MS } from './motion.tokens';

// Імперативні анімації на Motion — для SVG-кільця і чисел, де варіанти незручні.

export const isReducedMotion = (): boolean =>
  typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const COUNT_DEFAULT_MS = 500;

const formatUk = (value: number): string => Math.round(value).toLocaleString('uk-UA');

type CountUpOptions = { durationMs?: number; format?: (value: number) => string };

/** Лічильник чисел (ккал, кг), ease-out. Формат uk-UA: «1 370». Повертає функцію зупинки. */
export const countUp = (el: Element, from: number, to: number, options: CountUpOptions = {}): (() => void) => {
  const format = options.format ?? formatUk;
  if (isReducedMotion()) {
    el.textContent = format(to);
    return () => undefined;
  }
  const controls = animate(from, to, {
    duration: (options.durationMs ?? COUNT_DEFAULT_MS) / 1000,
    ease: EASE.out,
    onUpdate: (latest) => {
      el.textContent = format(latest);
    },
  });
  return () => controls.stop();
};

type FillArcOptions = { fromRatio?: number; durationMs?: number; delayMs?: number };

/**
 * Заповнення дуги через stroke-dashoffset. Довжина дуги — з getTotalLength(),
 * тож працює і для півкола «Сьогодні» (170×96), і для шапки чату (112×70).
 */
export const fillArc = async (path: SVGPathElement, ratio: number, options: FillArcOptions = {}): Promise<void> => {
  const length = path.getTotalLength();
  const clamped = Math.min(1, Math.max(0, ratio));
  path.style.strokeDasharray = `${length} ${length}`;
  const target = length * (1 - clamped);
  if (isReducedMotion()) {
    path.style.strokeDashoffset = String(target);
    return;
  }
  const start = length * (1 - (options.fromRatio ?? 0));
  await animate(
    path,
    { strokeDashoffset: [start, target] },
    {
      duration: (options.durationMs ?? RING_FILL_MS) / 1000,
      delay: (options.delayMs ?? 0) / 1000,
      ease: EASE.out,
    },
  );
};
