import type { ReactNode } from 'react';
import { HAMSTER_COLORS as C } from './hamster.constants';
import type { HamsterHeadMood } from './hamster.types';

// Обличчя голови (viewBox 0 0 100 100). Розмітка 1:1 з аватарів у mockups/chat*.html — не спрощувати.

const strokeProps = (width: number) => ({
  stroke: C.eye,
  strokeWidth: width,
  strokeLinecap: 'round' as const,
  fill: 'none',
});

// Ліве відкрите око з відблиском (спільне для smile і smileOpen)
const LeftEye = () => (
  <>
    <ellipse className="k-eye" cx="38" cy="47" rx="4.4" ry="5.4" fill={C.eye} />
    <circle cx="39.5" cy="45" r="1.6" fill={C.white} />
  </>
);

const RightEye = () => (
  <>
    <ellipse className="k-eye" cx="62" cy="47" rx="4.4" ry="5.4" fill={C.eye} />
    <circle cx="63.5" cy="45" r="1.6" fill={C.white} />
  </>
);

// Посмішка із двома зубками
const ToothySmile = () => (
  <>
    <path d="M44 63 Q47 66 50 63 Q53 66 56 63" {...strokeProps(2.4)} strokeLinejoin="round" />
    <rect x="47.2" y="64.4" width="2.6" height="3.6" rx="0.8" fill={C.white} />
    <rect x="50.2" y="64.4" width="2.6" height="3.6" rx="0.8" fill={C.white} />
  </>
);

export const HEAD_FACES: Record<HamsterHeadMood, ReactNode> = {
  /** Основний у чаті (Chat-v2 і більшість станів): підморгує правим оком, відблиск у лівому. */
  smile: (
    <>
      <LeftEye />
      <path d="M57.5 48 Q62 42.5 66.5 48" {...strokeProps(3)} />
      <ToothySmile />
    </>
  ),
  /** Обидва ока відкриті з відблисками: новий день, підсумок тижня, онбординг «активність». */
  smileOpen: (
    <>
      <LeftEye />
      <RightEye />
      <ToothySmile />
    </>
  ),
  /** Радіє: очі-дужки, відкритий рот. */
  happy: (
    <>
      <path d="M33.5 48 Q38 42 42.5 48" {...strokeProps(3)} />
      <path d="M57.5 48 Q62 42 66.5 48" {...strokeProps(3)} />
      <path d="M43 62 Q50 74 57 62 Z" fill={C.eye} />
    </>
  ),
  /** Думає / друкує / уточнює: очі вгору з відблисками, рот «о». */
  think: (
    <>
      <ellipse className="k-eye" cx="39.5" cy="45" rx="4.4" ry="5.4" fill={C.eye} />
      <circle cx="41" cy="43" r="1.6" fill={C.white} />
      <ellipse className="k-eye" cx="63.5" cy="45" rx="4.4" ry="5.4" fill={C.eye} />
      <circle cx="65" cy="43" r="1.6" fill={C.white} />
      <ellipse cx="51" cy="65" rx="2.6" ry="3" fill={C.eye} />
    </>
  ),
  /** Гордий: очі-дужки, брови вгору, напівусмішка (вага, прогрес). */
  proud: (
    <>
      <path d="M33.5 47 Q38 42 42.5 47" {...strokeProps(3)} />
      <path d="M57.5 47 Q62 42 66.5 47" {...strokeProps(3)} />
      <path d="M33 37 l9 -2 M58 35 l9 2" stroke={C.brow} strokeWidth="2" strokeLinecap="round" />
      <path d="M44 63 Q50 67 57 61" {...strokeProps(2.4)} />
    </>
  ),
  /** Задоволений: очі-дужки, хвиляста усмішка (новий рецепт). */
  content: (
    <>
      <path d="M33.5 48 Q38 42 42.5 48" {...strokeProps(3)} />
      <path d="M57.5 48 Q62 42 66.5 48" {...strokeProps(3)} />
      <path d="M44 63 Q47 61 50 63 Q53 65 56 63" {...strokeProps(2.4)} />
    </>
  ),
  /** Ой: збентежені брови, хвилястий рот (помилка зв'язку). */
  oops: (
    <>
      <ellipse className="k-eye" cx="38" cy="48" rx="4.4" ry="5.4" fill={C.eye} />
      <circle cx="39.5" cy="46" r="1.6" fill={C.white} />
      <ellipse className="k-eye" cx="62" cy="48" rx="4.4" ry="5.4" fill={C.eye} />
      <circle cx="63.5" cy="46" r="1.6" fill={C.white} />
      <path d="M30 37 l9 3 M70 37 l-9 3" stroke={C.brow} strokeWidth="2.4" strokeLinecap="round" />
      <path d="M43 65 q2.3 -2 4.6 0 q2.3 2 4.6 0 q2.3 -2 4.6 0" {...strokeProps(2.4)} />
    </>
  ),
  /** Голодний: погляд униз, язичок (онбординг «їжа», порада на вечерю). */
  hungry: (
    <>
      <ellipse className="k-eye" cx="38" cy="49" rx="4.4" ry="5.4" fill={C.eye} />
      <circle cx="39" cy="51" r="1.5" fill={C.white} />
      <ellipse className="k-eye" cx="62" cy="49" rx="4.4" ry="5.4" fill={C.eye} />
      <circle cx="63" cy="51" r="1.5" fill={C.white} />
      <path d="M44 63 Q50 67 56 63" {...strokeProps(2.4)} />
      <path d="M52 64.5 q4 0 4 4 q0 3 -3 3 q-3 0 -3 -4z" fill={C.blush} />
    </>
  ),
};
