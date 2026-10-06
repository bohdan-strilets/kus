/**
 * Kusik — рух. Хелпери на Web Animations API, 1:1 з interactive/motion.html.
 * Без бібліотек: WAAPI + CSS вистачає. (Framer Motion можна, але тоді переносити ті самі тривалості/криві.)
 *
 * Головні правила (docs/motion.md):
 *  - Тривалості: fast 120 · base 200 · slow 320 · святкування ≤ 1000 мс.
 *  - Криві: out (.2,.8,.2,1) — поява; spring (.34,1.56,.64,1) — «живі» відгуки; in (.4,0,1,1) — зникнення.
 *  - Анімуємо лише transform і opacity (+ stroke-dashoffset для кільця, height для розкриття уточнення).
 *  - prefers-reduced-motion: усе стрибає одразу в кінцевий стан, частинок немає, лічильники без прокрутки.
 */
import { useEffect, type RefObject } from 'react';

export const DURATION = { fast: 120, base: 200, slow: 320, celebrateMax: 1000 } as const;
export const EASE = {
  out: 'cubic-bezier(.2,.8,.2,1)',
  spring: 'cubic-bezier(.34,1.56,.64,1)',
  in: 'cubic-bezier(.4,0,1,1)',
} as const;

export const reducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

type Opts = { duration: number; delay?: number; easing?: string };

/** Анімація з повагою до reduced motion. Повертає Promise, що завершується в кінці. */
export function anim(el: Element, keyframes: Keyframe[], o: Opts): Promise<void> {
  if (reducedMotion() || !('animate' in el)) {
    const last = keyframes[keyframes.length - 1];
    for (const k in last) {
      if (k !== 'offset' && k !== 'easing') (el as HTMLElement).style.setProperty(toKebab(k), String(last[k]));
    }
    return Promise.resolve();
  }
  const a = el.animate(keyframes, { duration: o.duration, delay: o.delay ?? 0, easing: o.easing ?? EASE.out, fill: 'both' });
  return a.finished.then(() => undefined).catch(() => undefined);
}

const toKebab = (s: string) => s.replace(/[A-Z]/g, (m) => '-' + m.toLowerCase());

/* ───────────── готові рухи ───────────── */

/** Повідомлення користувача / нова бульбашка: знизу вгору 14px, 200 мс. */
export const enterBubble = (el: Element, dy = 14) =>
  anim(el, [{ transform: `translateY(${dy}px)`, opacity: 0 }, { transform: 'translateY(0)', opacity: 1 }], { duration: DURATION.base });

/** Рядки картки страви з'являються каскадом, крок 60 мс. */
export const staggerRows = (rows: Iterable<Element>, step = 60) =>
  Promise.all(
    [...rows].map((r, i) =>
      anim(r, [{ transform: 'translateY(6px)', opacity: 0 }, { transform: 'translateY(0)', opacity: 1 }], { duration: DURATION.base, delay: i * step }),
    ),
  );

/** Підскок (хом'як змінює настрій, бейдж). */
export const hop = (el: Element, h = 8) =>
  anim(el, [{ transform: 'translateY(0)' }, { transform: `translateY(-${h}px)`, offset: 0.4 }, { transform: 'translateY(0)' }], {
    duration: 300,
    easing: EASE.spring,
  });

/** Поява бейджа «записано»: scale 0 → 1.25 → 1. */
export const popIn = (el: Element) =>
  anim(el, [{ transform: 'scale(0)' }, { transform: 'scale(1.25)', offset: 0.6 }, { transform: 'scale(1)' }], {
    duration: 300,
    easing: EASE.spring,
  });

/** Помилка в полі: трусіння 300 мс, потім текст помилки з'являється. */
export const shake = (el: Element) =>
  anim(
    el,
    [
      { transform: 'translateX(0)' },
      { transform: 'translateX(-6px)' },
      { transform: 'translateX(6px)' },
      { transform: 'translateX(-4px)' },
      { transform: 'translateX(4px)' },
      { transform: 'translateX(0)' },
    ],
    { duration: 300, easing: 'linear' },
  );

/** Bottom sheet: знизу 320 мс (out), закриття 250 мс (in). Скрим — opacity. */
export const sheetOpen = (sheet: Element, scrim?: Element) => {
  if (scrim) void anim(scrim, [{ opacity: 0 }, { opacity: 1 }], { duration: DURATION.slow });
  return anim(sheet, [{ transform: 'translateY(105%)' }, { transform: 'translateY(0)' }], { duration: DURATION.slow });
};
export const sheetClose = (sheet: Element, scrim?: Element) => {
  if (scrim) void anim(scrim, [{ opacity: 1 }, { opacity: 0 }], { duration: 250 });
  return anim(sheet, [{ transform: 'translateY(0)' }, { transform: 'translateY(105%)' }], { duration: 250, easing: EASE.in });
};

/** Розкриття уточнення («суха чи варена?») по висоті, 250 мс. */
export const expand = (el: HTMLElement, open: boolean) => {
  const h = (el.firstElementChild as HTMLElement | null)?.offsetHeight ?? el.scrollHeight;
  return anim(el, open ? [{ height: '0px' }, { height: `${h + 8}px` }] : [{ height: `${h + 8}px` }, { height: '0px' }], { duration: 250 });
};

/** Кільце калорій: stroke-dasharray = C (2πr), заповнення до `ratio` за 700 мс. */
export const fillRing = (circle: SVGCircleElement, ratio: number, from = 0, duration = 700) => {
  const C = 2 * Math.PI * Number(circle.getAttribute('r'));
  return anim(circle, [{ strokeDashoffset: String(C * (1 - from)) }, { strokeDashoffset: String(C * (1 - Math.min(1, ratio))) }], { duration });
};

/** Смужки макросів: ширина від 0, каскад 80 мс після кільця (затримка 120). */
export const fillBar = (el: Element, percent: number, i = 0) =>
  anim(el, [{ width: '0%' }, { width: `${percent}%` }], { duration: 600, delay: 120 + i * 80 });

/** Лічильник чисел (ккал, кг). ease-out cubic, формат uk-UA (пробіл тисяч: «1 370»). */
export function countUp(
  el: Element,
  from: number,
  to: number,
  duration = 500,
  fmt: (v: number) => string = (v) => Math.round(v).toLocaleString('uk-UA'),
) {
  if (reducedMotion()) {
    el.textContent = fmt(to);
    return;
  }
  const t0 = performance.now();
  const step = (t: number) => {
    const p = Math.min(1, (t - t0) / duration);
    const e = 1 - Math.pow(1 - p, 3);
    el.textContent = fmt(from + (to - from) * e);
    if (p < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

/* ───────────── частинки для трьох рівнів успіху ───────────── */

type PieceType = 'dot' | 'line' | 'ring' | 'bite' | 'star';
type BurstCfg = {
  n: number;
  types: PieceType[];
  colors: string[];
  dist: number;
  dur: number;
  /** Кут розльоту [від, до] у радіанах. Без нього — коло. */
  spread?: [number, number];
  /** Падіння вниз у px (конфеті досягнення). */
  gravity?: number;
};

const BITE_SVG =
  '<svg width="100%" height="100%" viewBox="0 0 100 100"><defs><linearGradient id="kpg" x1="0.15" y1="0.1" x2="0.85" y2="0.95"><stop offset="0" stop-color="#FFB877"/><stop offset="1" stop-color="#D45F22"/></linearGradient><mask id="kpm"><rect width="100" height="100" fill="#fff"/><circle cx="91" cy="31" r="10" fill="#000"/><circle cx="83" cy="18" r="10" fill="#000"/><circle cx="70" cy="10" r="9.5" fill="#000"/></mask></defs><circle cx="50" cy="50" r="42" fill="url(#kpg)" mask="url(#kpm)"/></svg>';
const STAR_SVG = (c: string) =>
  `<svg width="100%" height="100%" viewBox="0 0 20 20"><path d="M10 0 L12.4 7.6 L20 10 L12.4 12.4 L10 20 L7.6 12.4 L0 10 L7.6 7.6Z" fill="${c}"/></svg>`;

function piece(type: PieceType, color: string) {
  const s = document.createElement('span');
  s.className = 'k-particle';
  s.setAttribute('aria-hidden', 'true');
  if (type === 'dot') s.style.cssText += `width:7px;height:7px;border-radius:50%;background:${color}`;
  if (type === 'line') s.style.cssText += `width:12px;height:3px;border-radius:2px;background:${color}`;
  if (type === 'ring') s.style.cssText += `width:11px;height:11px;border-radius:50%;border:2px solid ${color}`;
  if (type === 'bite') { s.style.cssText += 'width:14px;height:14px'; s.innerHTML = BITE_SVG; }
  if (type === 'star') { s.style.cssText += 'width:12px;height:12px'; s.innerHTML = STAR_SVG(color); }
  return s;
}

/** Розліт частинок з точки (x, y) відносно host (host має бути position: relative; overflow: visible). */
export function burst(host: HTMLElement, x: number, y: number, cfg: BurstCfg) {
  if (reducedMotion()) return;
  for (let i = 0; i < cfg.n; i++) {
    const type = cfg.types[i % cfg.types.length];
    const color = cfg.colors[i % cfg.colors.length];
    const p = piece(type, color);
    host.appendChild(p);
    const a = cfg.spread
      ? cfg.spread[0] + Math.random() * (cfg.spread[1] - cfg.spread[0])
      : (i / cfg.n) * Math.PI * 2 + Math.random() * 0.4;
    const d = cfg.dist * (0.65 + Math.random() * 0.5);
    const dx = Math.cos(a) * d;
    const dy = Math.sin(a) * d;
    const rot = type === 'line' ? (a * 180) / Math.PI : Math.random() * 240 - 120;
    const base = `translate(${x}px,${y}px) translate(-50%,-50%) `;
    const kf: Keyframe[] = cfg.gravity
      ? [
          { transform: base + 'translate(0,0) scale(.3) rotate(0deg)', opacity: 1 },
          { transform: base + `translate(${dx * 0.8}px,${dy - 20}px) scale(1) rotate(${rot / 2}deg)`, opacity: 1, offset: 0.45 },
          { transform: base + `translate(${dx}px,${dy + cfg.gravity}px) scale(.9) rotate(${rot}deg)`, opacity: 0 },
        ]
      : [
          { transform: base + `translate(0,0) scale(.3) rotate(${type === 'line' ? rot : 0}deg)`, opacity: 1 },
          { transform: base + `translate(${dx}px,${dy}px) scale(1) rotate(${rot}deg)`, opacity: 0 },
        ];
    p.animate(kf, { duration: cfg.dur * (0.8 + Math.random() * 0.4), easing: EASE.out, fill: 'both' }).finished.then(() => p.remove());
  }
}

export function centerIn(host: Element, el: Element): [number, number] {
  const h = host.getBoundingClientRect();
  const r = el.getBoundingClientRect();
  return [r.left - h.left + r.width / 2, r.top - h.top + r.height / 2];
}

/** Три рівні святкування. Частіше подія — тихіший ефект. */
export const CELEBRATE = {
  /** 1 · «Кусь» — кожен запис страви. 4 крихти вгору, 450 мс. */
  kusik: { n: 4, types: ['dot', 'dot', 'bite', 'dot'], colors: ['#E58A45', '#F2A877', '#E58A45', '#F7C59A'], dist: 30, dur: 450, spread: [-Math.PI * 0.95, -Math.PI * 0.05] },
  /** 2 · Ціль дня — раз на день. 12 частинок колом навколо кільця, 700 мс. */
  goal: { n: 12, types: ['dot', 'line', 'ring', 'line'], colors: ['#E58A45', '#F2A877', '#B9521A', '#F7C59A'], dist: 92, dur: 700 },
  /** 3 · Досягнення — рідко. 18 конфеті з пряниками й зірками, падають, 1000 мс. */
  achieve: { n: 18, types: ['bite', 'star', 'dot', 'star', 'dot', 'ring'], colors: ['#F2A877', '#E58A45', '#F5C451', '#B9521A', '#F7C59A'], dist: 120, dur: 1000, gravity: 60, spread: [-Math.PI * 0.95, -Math.PI * 0.05] },
} satisfies Record<string, BurstCfg>;

/** Сяйво кільця при закритті цілі (зелений тут доречний: це «успіх»). */
export const ringGlow = (el: Element) =>
  anim(
    el,
    [
      { transform: 'scale(1)', filter: 'drop-shadow(0 0 0 rgba(23,132,90,0))' },
      { transform: 'scale(1.07)', filter: 'drop-shadow(0 0 14px rgba(23,132,90,.55))', offset: 0.35 },
      { transform: 'scale(1)', filter: 'drop-shadow(0 0 0 rgba(23,132,90,0))' },
    ],
    { duration: 600 },
  );

/* ───────────── хук кліпання хом'яка ───────────── */


/** Додає .k-blink на svg хом'яка раз на 4–6 с (див. src/hamster/hamster.css). */
export function useBlink(ref: RefObject<SVGSVGElement | null>) {
  useEffect(() => {
    if (reducedMotion()) return;
    let t: ReturnType<typeof setTimeout>;
    const tick = () => {
      const el = ref.current;
      if (el) {
        el.classList.remove('k-blink');
        void el.getBoundingClientRect(); // restart animation
        el.classList.add('k-blink');
      }
      t = setTimeout(tick, 4000 + Math.random() * 2000);
    };
    t = setTimeout(tick, 1500);
    return () => clearTimeout(t);
  }, [ref]);
}
