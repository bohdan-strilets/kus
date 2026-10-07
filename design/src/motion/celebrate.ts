import { animate } from 'motion';
import { isReducedMotion } from './motion.imperative';
import { EASE } from './motion.tokens';

// Частинки трьох рівнів успіху. Чим рідша подія — тим яскравіше. Див. docs/motion.md.

type PieceType = 'dot' | 'line' | 'ring' | 'bite' | 'star';

type BurstConfig = {
  count: number;
  types: PieceType[];
  colors: string[];
  distance: number;
  durationMs: number;
  /** Кут розльоту [від, до] у радіанах. Без нього — коло. */
  spread?: [number, number];
  /** Падіння вниз у px (конфеті досягнення). */
  gravity?: number;
};

export const CELEBRATE: Record<'kusik' | 'goal' | 'achieve', BurstConfig> = {
  /** 1 · «Кусь» — кожен запис страви: 4 крихти вгору, 450 мс. */
  kusik: {
    count: 4,
    types: ['dot', 'dot', 'bite', 'dot'],
    colors: ['#E58A45', '#F2A877', '#E58A45', '#F7C59A'],
    distance: 30,
    durationMs: 450,
    spread: [-Math.PI * 0.95, -Math.PI * 0.05],
  },
  /** 2 · Ціль дня — раз на день: 12 частинок колом навколо кільця, 700 мс. */
  goal: {
    count: 12,
    types: ['dot', 'line', 'ring', 'line'],
    colors: ['#E58A45', '#F2A877', '#B9521A', '#F7C59A'],
    distance: 92,
    durationMs: 700,
  },
  /** 3 · Досягнення — рідко: 18 конфеті з пряниками й зірками, падають, 1000 мс. */
  achieve: {
    count: 18,
    types: ['bite', 'star', 'dot', 'star', 'dot', 'ring'],
    colors: ['#F2A877', '#E58A45', '#F5C451', '#B9521A', '#F7C59A'],
    distance: 120,
    durationMs: 1000,
    gravity: 60,
    spread: [-Math.PI * 0.95, -Math.PI * 0.05],
  },
};

const BITE_SVG =
  '<svg width="100%" height="100%" viewBox="0 0 100 100"><defs><linearGradient id="kpg" x1="0.15" y1="0.1" x2="0.85" y2="0.95"><stop offset="0" stop-color="#FFB877"/><stop offset="1" stop-color="#D45F22"/></linearGradient><mask id="kpm"><rect width="100" height="100" fill="#fff"/><circle cx="91" cy="31" r="10" fill="#000"/><circle cx="83" cy="18" r="10" fill="#000"/><circle cx="70" cy="10" r="9.5" fill="#000"/></mask></defs><circle cx="50" cy="50" r="42" fill="url(#kpg)" mask="url(#kpm)"/></svg>';

const starSvg = (color: string): string =>
  `<svg width="100%" height="100%" viewBox="0 0 20 20"><path d="M10 0 L12.4 7.6 L20 10 L12.4 12.4 L10 20 L7.6 12.4 L0 10 L7.6 7.6Z" fill="${color}"/></svg>`;

const PIECE_STYLE: Record<PieceType, (color: string) => string> = {
  dot: (color) => `width:7px;height:7px;border-radius:50%;background:${color}`,
  line: (color) => `width:12px;height:3px;border-radius:2px;background:${color}`,
  ring: (color) => `width:11px;height:11px;border-radius:50%;border:2px solid ${color}`,
  bite: () => 'width:14px;height:14px',
  star: () => 'width:12px;height:12px',
};

// Статичний SVG-рядок без даних користувача, тому innerHTML тут безпечний.
const createPiece = (type: PieceType, color: string): HTMLSpanElement => {
  const piece = document.createElement('span');
  piece.className = 'k-particle';
  piece.setAttribute('aria-hidden', 'true');
  piece.style.cssText += PIECE_STYLE[type](color);
  if (type === 'bite') piece.innerHTML = BITE_SVG;
  if (type === 'star') piece.innerHTML = starSvg(color);
  return piece;
};

const randomBetween = (min: number, max: number): number => min + Math.random() * (max - min);

/** Розліт частинок з центру `origin` усередині `host` (host: position relative, overflow visible). */
export const burst = (host: HTMLElement, origin: Element, config: BurstConfig): void => {
  if (isReducedMotion()) return;
  const hostRect = host.getBoundingClientRect();
  const rect = origin.getBoundingClientRect();
  const x = rect.left - hostRect.left + rect.width / 2;
  const y = rect.top - hostRect.top + rect.height / 2;

  for (let i = 0; i < config.count; i++) {
    const type = config.types[i % config.types.length];
    const color = config.colors[i % config.colors.length];
    const piece = createPiece(type, color);
    host.appendChild(piece);

    const angle = config.spread
      ? randomBetween(config.spread[0], config.spread[1])
      : (i / config.count) * Math.PI * 2 + Math.random() * 0.4;
    const distance = config.distance * randomBetween(0.65, 1.15);
    const dx = Math.cos(angle) * distance;
    const dy = Math.sin(angle) * distance;
    const rotation = type === 'line' ? (angle * 180) / Math.PI : randomBetween(-120, 120);
    const base = `translate(${x}px,${y}px) translate(-50%,-50%) `;
    const duration = (config.durationMs * randomBetween(0.8, 1.2)) / 1000;

    const keyframes = config.gravity
      ? {
          transform: [
            `${base}translate(0,0) scale(.3) rotate(0deg)`,
            `${base}translate(${dx * 0.8}px,${dy - 20}px) scale(1) rotate(${rotation / 2}deg)`,
            `${base}translate(${dx}px,${dy + config.gravity}px) scale(.9) rotate(${rotation}deg)`,
          ],
          opacity: [1, 1, 0],
        }
      : {
          transform: [
            `${base}translate(0,0) scale(.3) rotate(${type === 'line' ? rotation : 0}deg)`,
            `${base}translate(${dx}px,${dy}px) scale(1) rotate(${rotation}deg)`,
          ],
          opacity: [1, 0],
        };

    const times = config.gravity ? [0, 0.45, 1] : undefined;
    void animate(piece, keyframes, { duration, ease: EASE.out, times }).then(() => piece.remove());
  }
};
