import { cx } from '../lib/cx';
import { ICON_PATHS, type IconName } from './icon.generated';

// Оптична товщина лінії ~1.75px за будь-якого розміру (як у макетах: 22px → 1.9, 18px → 2.3).
const OPTICAL_STROKE_PX = 1.75;
const GRID = 24;
const MIN_STROKE = 1.6;
const MAX_STROKE = 2.4;

const getStrokeWidth = (size: number): number =>
  Math.min(MAX_STROKE, Math.max(MIN_STROKE, (OPTICAL_STROKE_PX * GRID) / size));

type IconProps = {
  name: IconName;
  /** 18 — у кнопках і полях, 22 — нижня навігація, 24 — за замовчуванням. */
  size?: number;
  /** Для іконки без тексту поруч (іконкова кнопка) — краще aria-label на самій кнопці. Без label іконка декоративна. */
  label?: string;
  className?: string;
};

/**
 * Єдина іконка інтерфейсу Kusik. Колір — з тексту (currentColor): <Icon name="camera" className="text-muted" />.
 * Список назв типізований: неіснуюча іконка не пройде typecheck. Нову додає скіл add-icon.
 */
export const Icon = ({ name, size = GRID, label, className }: IconProps) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={getStrokeWidth(size)}
    strokeLinecap="round"
    strokeLinejoin="round"
    focusable="false"
    role={label ? 'img' : undefined}
    aria-label={label}
    aria-hidden={label ? undefined : true}
    className={cx('shrink-0', className)}
    data-icon={name}
  >
    {ICON_PATHS[name]}
  </svg>
);
