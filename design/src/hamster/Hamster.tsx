/**
 * Kusik — хом'як-маскот.
 *
 * Перенесено один в один з mockups/brand-hamster.html (повне тіло, viewBox 120)
 * та interactive/motion.html (голова для аватара в чаті, viewBox 100).
 *
 *   <Hamster mood="happy" size={120} />        — порожні екрани, онбординг, успіх
 *   <HamsterHead mood="think" size={34} />     — аватар біля бульбашки Kusik у чаті
 *
 * Кольори хутра навмисно не з токенів UI: це «ілюстрація», вона не змінюється з темою.
 */
import { useId, useRef, type ReactNode, type SVGProps } from 'react';
import { useBlink } from '../motion/motion';
import './hamster.css';

export type HamsterMood =
  | 'wave'      // Привіт — перший запуск, ранок
  | 'happy'     // Радіє — ціль дня закрита
  | 'think'     // Думає — уточнює порцію, Kusik друкує
  | 'logged'    // Записав — страву додано (із зеленою галочкою)
  | 'support'   // Підтримує — перебір без докорів
  | 'surprised' // Здивований — «Ого, 900 ккал у салаті?»
  | 'yum'       // Ласує — улюблений рецепт
  | 'hungry'    // Голодний — нагадування про обід
  | 'proud'     // Гордий — серія днів, мінус кілограм
  | 'remind'    // Нагадує — сповіщення
  | 'oops'      // Ой — помилка, немає зв'язку
  | 'sleepy';   // Вечір — підсумок дня

export const HAMSTER_LABEL: Record<HamsterMood, string> = {
  wave: "Хом'як махає лапкою",
  happy: "Хом'як радіє",
  think: "Хом'як думає",
  logged: "Хом'як записав і підморгує",
  support: "Хом'як підтримує",
  surprised: "Хом'як здивований",
  yum: "Хом'як ласує",
  hungry: "Хом'як голодний",
  proud: "Хом'як гордий",
  remind: "Хом'як нагадує",
  oops: "Хом'як збентежений",
  sleepy: "Хом'як сонний",
};

const C = {
  fur: '#F6B98A',
  furDark: '#E89A68',
  cheek: '#F9C7A0',
  belly: '#FFEBD8',
  earInner: '#F7B3A2',
  blush: '#F28E7A',
  nose: '#D96B5C',
  eye: '#2B1D14',
  brow: '#C97F52',
  whisker: '#D7A27C',
  accent: '#E58A45',
  accentLight: '#F2A877',
  bubble: '#F2B987',
  success: '#17845A',
};

/** Спільні пропси для ліній обличчя. */
const line = (w = 3): SVGProps<SVGPathElement> => ({
  stroke: C.eye,
  strokeWidth: w,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  fill: 'none',
});

/* ───────────────────────── повне тіло (viewBox 0 0 120 120) ───────────────────────── */

function Body() {
  return (
    <>
      <ellipse cx="42" cy="111" rx="10" ry="5" fill={C.furDark} />
      <ellipse cx="78" cy="111" rx="10" ry="5" fill={C.furDark} />
      <circle cx="35" cy="30" r="11" fill={C.furDark} />
      <circle cx="35" cy="31" r="6" fill={C.earInner} />
      <circle cx="85" cy="30" r="11" fill={C.furDark} />
      <circle cx="85" cy="31" r="6" fill={C.earInner} />
      <ellipse cx="60" cy="68" rx="45" ry="43" fill={C.fur} />
      <circle cx="29" cy="74" r="15" fill={C.cheek} />
      <circle cx="91" cy="74" r="15" fill={C.cheek} />
      <ellipse cx="60" cy="84" rx="30" ry="25" fill={C.belly} />
      <path d="M46 34 Q60 28 74 34" stroke={C.furDark} strokeWidth="3" strokeLinecap="round" fill="none" />
      <ellipse cx="31" cy="72" rx="7" ry="4" fill={C.blush} opacity="0.55" />
      <ellipse cx="89" cy="72" rx="7" ry="4" fill={C.blush} opacity="0.55" />
      <ellipse cx="60" cy="67" rx="3.6" ry="2.6" fill={C.nose} />
      <g stroke={C.whisker} strokeWidth="1.4" strokeLinecap="round">
        <path d="M22 66 l-10 -2" />
        <path d="M22 71 l-10 1" />
        <path d="M98 66 l10 -2" />
        <path d="M98 71 l10 1" />
      </g>
    </>
  );
}

/** Пряник-логотип у лапках (з укусом і літерою k) + права лапка. */
function Cookie({ gradId, maskId }: { gradId: string; maskId: string }) {
  return (
    <>
      <circle cx="60" cy="98" r="15" fill={`url(#${gradId})`} mask={`url(#${maskId})`} />
      <text x="58.5" y="104" textAnchor="middle" fontFamily="Manrope, sans-serif" fontWeight={800} fontSize="16" fill="#FFF4E6">
        k
      </text>
      <ellipse cx="76" cy="98" rx="6.5" ry="5.5" fill={C.furDark} />
    </>
  );
}

const PawL = () => <ellipse cx="45" cy="97" rx="6.5" ry="5.5" fill={C.furDark} />;

const Eyes = () => (
  <>
    <ellipse className="k-eye" cx="47" cy="57" rx="4.6" ry="5.6" fill={C.eye} />
    <circle cx="48.6" cy="55" r="1.7" fill="#FFFFFF" />
    <ellipse className="k-eye" cx="73" cy="57" rx="4.6" ry="5.6" fill={C.eye} />
    <circle cx="74.6" cy="55" r="1.7" fill="#FFFFFF" />
  </>
);

const Smile = () => (
  <>
    <path d="M54 72 Q57 75 60 72 Q63 75 66 72" {...line(2.2)} />
    <rect x="57" y="73.6" width="2.8" height="3.8" rx="0.8" fill="#FFFFFF" stroke="#E2CDBD" strokeWidth="0.6" />
    <rect x="60.2" y="73.6" width="2.8" height="3.8" rx="0.8" fill="#FFFFFF" stroke="#E2CDBD" strokeWidth="0.6" />
  </>
);

type Parts = {
  /** Декор позаду хом'яка (зірочки, бульбашки думок, місяць). */
  back?: ReactNode;
  /** Щось між тілом і пряником (повні щоки). */
  over?: ReactNode;
  /** Ліва лапка: стандартна, махає або немає. */
  paw?: 'down' | 'wave';
  face: ReactNode;
  /** Декор поверх (зелена галочка). */
  front?: ReactNode;
};

const MOODS: Record<HamsterMood, Parts> = {
  wave: {
    back: <path d="M8 36 q-3 4 0 8 M4 30 q-5 8 0 16" stroke={C.furDark} strokeWidth="1.8" strokeLinecap="round" fill="none" />,
    paw: 'wave',
    face: (
      <>
        <Eyes />
        <Smile />
      </>
    ),
  },
  happy: {
    back: (
      <>
        <path d="M12 16 l2 5 5 2 -5 2 -2 5 -2 -5 -5 -2 5 -2z" fill={C.accent} />
        <path d="M104 18 l1.4 3.4 3.4 1.4 -3.4 1.4 -1.4 3.4 -1.4 -3.4 -3.4 -1.4 3.4 -1.4z" fill={C.accentLight} />
      </>
    ),
    face: (
      <>
        <path d="M42 58 Q47 51 52 58" {...line()} />
        <path d="M68 58 Q73 51 78 58" {...line()} />
        <path d="M52 71 Q60 85 68 71 Z" fill={C.eye} />
        <rect x="57" y="71" width="2.8" height="3.6" rx="0.8" fill="#FFFFFF" />
        <rect x="60.2" y="71" width="2.8" height="3.6" rx="0.8" fill="#FFFFFF" />
        <ellipse cx="60" cy="79" rx="4" ry="2" fill={C.blush} />
      </>
    ),
  },
  think: {
    back: (
      <>
        <circle cx="88" cy="20" r="3" fill={C.bubble} />
        <circle cx="97" cy="13" r="4" fill={C.bubble} />
        <circle cx="108" cy="8" r="5" fill={C.bubble} />
      </>
    ),
    face: (
      <>
        <ellipse className="k-eye" cx="48" cy="55" rx="4.6" ry="5.6" fill={C.eye} />
        <circle cx="49.8" cy="52.6" r="1.7" fill="#FFFFFF" />
        <ellipse className="k-eye" cx="74" cy="55" rx="4.6" ry="5.6" fill={C.eye} />
        <circle cx="75.8" cy="52.6" r="1.7" fill="#FFFFFF" />
        <path d="M42 46 Q47 43 52 45" stroke={C.brow} strokeWidth="2" strokeLinecap="round" fill="none" />
        <ellipse cx="61" cy="74" rx="2.8" ry="3.2" fill={C.eye} />
      </>
    ),
  },
  logged: {
    face: (
      <>
        <ellipse className="k-eye" cx="47" cy="57" rx="4.6" ry="5.6" fill={C.eye} />
        <circle cx="48.6" cy="55" r="1.7" fill="#FFFFFF" />
        <path d="M68 58 Q73 53 78 58" {...line()} />
        <Smile />
      </>
    ),
    front: (
      <>
        <circle cx="102" cy="96" r="11" fill={C.success} />
        <path d="M97 96 l3.5 3.5 6.5 -7" stroke="#FFFFFF" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      </>
    ),
  },
  support: {
    back: <path d="M18 28 C10 22 8 14 14 11 C17 10 19 12 20 14 C21 12 23 10 26 11 C32 14 29 22 18 28 Z" fill={C.accentLight} />,
    face: (
      <>
        <path d="M42 57 Q47 61 52 57" {...line()} />
        <path d="M68 57 Q73 61 78 57" {...line()} />
        <path d="M55 73 Q60 76 65 73" {...line(2.2)} />
      </>
    ),
  },
  surprised: {
    back: (
      <text x="96" y="30" fontFamily="Manrope, sans-serif" fontWeight={800} fontSize="24" fill={C.accentLight}>
        !
      </text>
    ),
    face: (
      <>
        <ellipse className="k-eye" cx="47" cy="56" rx="6" ry="7.2" fill={C.eye} />
        <circle cx="49" cy="53.4" r="2.2" fill="#FFFFFF" />
        <ellipse className="k-eye" cx="73" cy="56" rx="6" ry="7.2" fill={C.eye} />
        <circle cx="75" cy="53.4" r="2.2" fill="#FFFFFF" />
        <path d="M41 44 Q47 40 52 43" stroke={C.brow} strokeWidth="2" strokeLinecap="round" fill="none" />
        <path d="M68 43 Q73 40 79 44" stroke={C.brow} strokeWidth="2" strokeLinecap="round" fill="none" />
        <ellipse cx="60" cy="75" rx="3.6" ry="4.4" fill={C.eye} />
      </>
    ),
  },
  yum: {
    over: (
      <>
        <circle cx="27" cy="75" r="19" fill={C.cheek} />
        <circle cx="93" cy="75" r="19" fill={C.cheek} />
        <ellipse cx="29" cy="72" rx="8" ry="4.5" fill={C.blush} opacity="0.55" />
        <ellipse cx="91" cy="72" rx="8" ry="4.5" fill={C.blush} opacity="0.55" />
      </>
    ),
    face: (
      <>
        <path d="M42 58 Q47 52 52 58" {...line()} />
        <path d="M68 58 Q73 52 78 58" {...line()} />
        <path d="M54 73 Q57 71 60 73 Q63 75 66 73" {...line(2.2)} />
        <g fill={C.accent}>
          <circle cx="50" cy="80" r="1.2" />
          <circle cx="69" cy="80" r="1" />
          <circle cx="64" cy="83" r="0.9" />
        </g>
      </>
    ),
  },
  hungry: {
    face: (
      <>
        <ellipse className="k-eye" cx="47" cy="59" rx="4.6" ry="5.6" fill={C.eye} />
        <circle cx="48.2" cy="61" r="1.6" fill="#FFFFFF" />
        <ellipse className="k-eye" cx="73" cy="59" rx="4.6" ry="5.6" fill={C.eye} />
        <circle cx="74.2" cy="61" r="1.6" fill="#FFFFFF" />
        <path d="M53 72 Q60 77 67 72" {...line(2.2)} />
        <path d="M62 74 q4 0 4 4 q0 3 -3 3 q-3 0 -3 -4z" fill={C.blush} />
      </>
    ),
  },
  proud: {
    back: (
      <>
        <circle cx="102" cy="28" r="12" fill={C.accentLight} />
        <text x="102" y="33.5" textAnchor="middle" fontFamily="Manrope, sans-serif" fontWeight={800} fontSize="15" fill="#FFFFFF">
          7
        </text>
      </>
    ),
    face: (
      <>
        <path d="M42 57 Q47 52 52 57" {...line()} />
        <path d="M68 57 Q73 52 78 57" {...line()} />
        <path d="M42 47 l9 -2 M69 45 l9 2" stroke={C.brow} strokeWidth="2" strokeLinecap="round" />
        <path d="M54 72 Q60 76 67 70" {...line(2.2)} />
      </>
    ),
  },
  remind: {
    back: (
      <>
        <path d="M14 30 q0 -12 10 -12 q10 0 10 12 l3 5 h-26z" fill="#F5C451" />
        <circle cx="24" cy="38" r="2.6" fill="#F5C451" />
        <path d="M8 20 q-3 4 -1 9 M40 20 q3 4 1 9" stroke="#F5C451" strokeWidth="1.8" strokeLinecap="round" fill="none" />
      </>
    ),
    face: (
      <>
        <Eyes />
        <Smile />
      </>
    ),
  },
  oops: {
    back: <path d="M96 36 q-5 7 0 10 q5 -3 0 -10z" fill="#8FCBF2" />,
    face: (
      <>
        <Eyes />
        <path d="M41 46 l10 3 M79 46 l-10 3" stroke={C.brow} strokeWidth="2" strokeLinecap="round" />
        <path d="M53 74 q2.3 -2 4.6 0 q2.3 2 4.6 0 q2.3 -2 4.6 0" {...line(2.2)} />
      </>
    ),
  },
  sleepy: {
    back: (
      <>
        <path d="M108 32 a11 11 0 1 1 -3 -16 a9 9 0 0 0 3 16z" fill="#F8D9A8" />
        <text x="12" y="28" fontFamily="Manrope, sans-serif" fontWeight={800} fontSize="11" fill={C.bubble}>
          z
        </text>
        <text x="20" y="17" fontFamily="Manrope, sans-serif" fontWeight={800} fontSize="15" fill={C.bubble}>
          z
        </text>
      </>
    ),
    face: (
      <>
        <path d="M42 57 Q47 61 52 57" {...line()} />
        <path d="M68 57 Q73 61 78 57" {...line()} />
        <ellipse cx="60" cy="74" rx="2.6" ry="2.2" fill={C.eye} />
      </>
    ),
  },
};

const NO_REF = { current: null };

/** useId дає «:r1:», а двокрапки ламають url(#…) у частині браузерів. */
function useSvgId(prefix: string) {
  return prefix + useId().replace(/:/g, '');
}

export type HamsterProps = {
  mood?: HamsterMood;
  size?: number;
  /** Перевизнач текст для скрінрідера. Передай '' якщо хом'як суто декоративний. */
  label?: string;
  /** Кліпати очима раз на 4–6 с. Вимикається при reduced motion. */
  blink?: boolean;
  className?: string;
};

export function Hamster({ mood = 'wave', size = 120, label, blink = true, className }: HamsterProps) {
  const ref = useRef<SVGSVGElement>(null);
  useBlink(blink ? ref : NO_REF);
  const gradId = useSvgId('kg');
  const maskId = useSvgId('kb');
  const p = MOODS[mood];
  const text = label ?? HAMSTER_LABEL[mood];
  const decorative = text === '';

  return (
    <svg
      ref={ref}
      width={size}
      height={size}
      viewBox="0 0 120 120"
      className={['k-hamster', className].filter(Boolean).join(' ')}
      data-mood={mood}
      role={decorative ? undefined : 'img'}
      aria-label={decorative ? undefined : text}
      aria-hidden={decorative || undefined}
    >
      <defs>
        <linearGradient id={gradId} x1="0.15" y1="0.1" x2="0.85" y2="0.95">
          <stop offset="0" stopColor="#FFB877" />
          <stop offset="1" stopColor="#D45F22" />
        </linearGradient>
        <mask id={maskId}>
          <rect width="120" height="120" fill="#FFFFFF" />
          <circle cx="74.6" cy="91.2" r="3.6" fill="#000000" />
          <circle cx="71.8" cy="86.6" r="3.6" fill="#000000" />
          <circle cx="67.1" cy="83.7" r="3.4" fill="#000000" />
        </mask>
      </defs>
      {p.back}
      <Body />
      {p.over}
      <Cookie gradId={gradId} maskId={maskId} />
      {p.paw === 'wave' ? (
        <ellipse className="k-paw-wave" cx="18" cy="46" rx="6.5" ry="7.5" fill={C.furDark} />
      ) : (
        <PawL />
      )}
      {p.face}
      {p.front}
    </svg>
  );
}

/* ───────────────────────── голова для чату (viewBox 0 0 100 100) ───────────────────────── */

export type HeadMood = 'smile' | 'happy' | 'think' | 'proud';

const HEAD_FACES: Record<HeadMood, ReactNode> = {
  smile: (
    <>
      <ellipse className="k-eye" cx="38" cy="47" rx="4.4" ry="5.4" fill={C.eye} />
      <ellipse className="k-eye" cx="62" cy="47" rx="4.4" ry="5.4" fill={C.eye} />
      <path d="M44 63 Q47 66 50 63 Q53 66 56 63" {...line(2.4)} />
      <rect x="47.2" y="64.4" width="2.6" height="3.6" rx="0.8" fill="#FFFFFF" />
      <rect x="50.2" y="64.4" width="2.6" height="3.6" rx="0.8" fill="#FFFFFF" />
    </>
  ),
  happy: (
    <>
      <path d="M33.5 48 Q38 42 42.5 48" {...line()} />
      <path d="M57.5 48 Q62 42 66.5 48" {...line()} />
      <path d="M43 62 Q50 74 57 62 Z" fill={C.eye} />
    </>
  ),
  think: (
    <>
      <ellipse className="k-eye" cx="39.5" cy="45" rx="4.4" ry="5.4" fill={C.eye} />
      <ellipse className="k-eye" cx="63.5" cy="45" rx="4.4" ry="5.4" fill={C.eye} />
      <ellipse cx="51" cy="65" rx="2.6" ry="3" fill={C.eye} />
    </>
  ),
  proud: (
    <>
      <path d="M33.5 47 Q38 42 42.5 47" {...line()} />
      <path d="M57.5 47 Q62 42 66.5 47" {...line()} />
      <path d="M44 63 Q50 67 57 61" {...line(2.4)} />
    </>
  ),
};

export type HamsterHeadProps = { mood?: HeadMood; size?: number; className?: string };

/** Аватар Kusik біля його повідомлень. Завжди декоративний: поруч є текст. */
export function HamsterHead({ mood = 'smile', size = 34, className }: HamsterHeadProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      aria-hidden="true"
      className={['k-hamster-head', className].filter(Boolean).join(' ')}
      data-mood={mood}
      style={{ flex: 'none' }}
    >
      <circle cx="27" cy="24" r="10" fill={C.furDark} />
      <circle cx="27" cy="25" r="5.5" fill={C.earInner} />
      <circle cx="73" cy="24" r="10" fill={C.furDark} />
      <circle cx="73" cy="25" r="5.5" fill={C.earInner} />
      <ellipse cx="50" cy="56" rx="41" ry="38" fill={C.fur} />
      <circle cx="22" cy="64" r="13" fill={C.cheek} />
      <circle cx="78" cy="64" r="13" fill={C.cheek} />
      <ellipse cx="50" cy="72" rx="25" ry="20" fill={C.belly} />
      <ellipse cx="24" cy="61" rx="6" ry="3.5" fill={C.blush} opacity="0.55" />
      <ellipse cx="76" cy="61" rx="6" ry="3.5" fill={C.blush} opacity="0.55" />
      <ellipse cx="50" cy="58" rx="3.6" ry="2.6" fill={C.nose} />
      {HEAD_FACES[mood]}
    </svg>
  );
}

export default Hamster;
