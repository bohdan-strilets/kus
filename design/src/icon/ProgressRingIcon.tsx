import { cx } from '../lib/cx';

// Неактивна: трек тієї ж оптичної ваги, що й контури інших вкладок, прогрес — товща дуга поверх.
// Активна: суцільний диск (як chat-filled), прогрес — кремове кільце-виріз усередині.
// Понад ціль: друге коло всередині (неактивна) / кремова точка в центрі (активна). Росте до +50%, далі не змінюється.

const GRID = 24;
const OPTICAL_STROKE_PX = 1.75;
const CUTOUT = 'var(--icon-cutout, #FFFFFF)';

const TRACK_RADIUS = 8.5;
const PROGRESS_STROKE = 3.6;
const SECOND_LAP_RADIUS = 4.6;
const SECOND_LAP_STROKE = 2.6;

const DISC_RADIUS = 9.6;
const CUT_RADIUS = 5.6;
const CUT_TRACK_STROKE = 1.6;
const CUT_TRACK_OPACITY = 0.55;
const CUT_PROGRESS_STROKE = 3;
const OVER_DOT_MIN = 1.2;
const OVER_DOT_GROWTH = 1.2;
const MAX_OVER = 0.5;

const circumference = (radius: number): number => 2 * Math.PI * radius;

type ArcProps = { radius: number; share: number; strokeWidth: number; color?: string };

// Дуга від 12-ї години за годинниковою стрілкою
const Arc = ({ radius, share, strokeWidth, color = 'currentColor' }: ArcProps) => {
  const length = circumference(radius);
  return (
    <circle
      cx="12"
      cy="12"
      r={radius}
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeDasharray={`${length * share} ${length}`}
      transform="rotate(-90 12 12)"
    />
  );
};

type ProgressRingIconProps = {
  /** Частка дня: з'їдено / ціль. 0 — порожньо, 1 — ціль, > 1 — понад ціль. */
  progress: number;
  /** Активна вкладка «Сьогодні». */
  isActive?: boolean;
  size?: number;
  className?: string;
};

/** Іконка вкладки «Сьогодні». Колір — currentColor, виріз — var(--icon-cutout) (на капсулі вкладки — primary-soft або білий). */
export const ProgressRingIcon = ({ progress, isActive = false, size = 22, className }: ProgressRingIconProps) => {
  const day = Math.min(1, Math.max(0, progress));
  const over = Math.min(MAX_OVER, Math.max(0, progress - 1));
  const trackStroke = (OPTICAL_STROKE_PX * GRID) / size;

  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true" className={cx('shrink-0', className)}>
      {isActive ? (
        <>
          <circle cx="12" cy="12" r={DISC_RADIUS} fill="currentColor" />
          <circle cx="12" cy="12" r={CUT_RADIUS} stroke={CUTOUT} strokeWidth={CUT_TRACK_STROKE} opacity={CUT_TRACK_OPACITY} />
          {day > 0 && <Arc radius={CUT_RADIUS} share={day} strokeWidth={CUT_PROGRESS_STROKE} color={CUTOUT} />}
          {over > 0 && <circle cx="12" cy="12" r={OVER_DOT_MIN + (OVER_DOT_GROWTH * over) / MAX_OVER} fill={CUTOUT} />}
        </>
      ) : (
        <>
          <circle cx="12" cy="12" r={TRACK_RADIUS} stroke="currentColor" strokeWidth={trackStroke} />
          {day > 0 && <Arc radius={TRACK_RADIUS} share={day} strokeWidth={PROGRESS_STROKE} />}
          {over > 0 && <Arc radius={SECOND_LAP_RADIUS} share={over} strokeWidth={SECOND_LAP_STROKE} />}
        </>
      )}
    </svg>
  );
};
