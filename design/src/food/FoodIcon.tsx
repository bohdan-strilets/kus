import type { ReactNode } from 'react';
import { cx } from '../lib/cx';
import { FOOD_CATEGORY_GROUP, FOOD_GROUP_TILE_CLASS } from './food.constants';
import { FOOD_ICON_PATHS } from './food-icons.generated';
import { FALLBACK_FOOD_CATEGORY, type FoodCategory } from './food.types';

// Тип Record<FoodCategory, …> змушує мати SVG для кожної категорії: забув файл — typecheck впаде.
const ICONS: Record<FoodCategory, ReactNode> = FOOD_ICON_PATHS;

// Іконка займає ~64% плитки: 28 у 44, як у макетах.
const ICON_TO_TILE_RATIO = 28 / 44;
const TILE_RADIUS_RATIO = 14 / 44;
const DEFAULT_TILE_SIZE = 44;

type FoodIconProps = {
  /** Невідома чи відсутня категорія показується як «тарілка». */
  category: FoodCategory | null | undefined;
  /** Розмір плитки (або самої іконки, якщо hasTile=false). */
  size?: number;
  /** Плитка з кольоровим тлом групи. Без неї — лише малюнок. */
  hasTile?: boolean;
  className?: string;
};

/**
 * Іконка категорії страви. Декоративна: назва страви завжди поруч текстом.
 *   <FoodIcon category={entry.category} />            — плитка 44, як у картці страви й на «Сьогодні»
 *   <FoodIcon category="pizza" size={24} hasTile={false} />
 */
export const FoodIcon = ({ category, size = DEFAULT_TILE_SIZE, hasTile = true, className }: FoodIconProps) => {
  const safeCategory = category && category in ICONS ? category : FALLBACK_FOOD_CATEGORY;
  const iconSize = hasTile ? Math.round(size * ICON_TO_TILE_RATIO) : size;

  const icon = (
    <svg width={iconSize} height={iconSize} viewBox="0 0 32 32" aria-hidden="true" data-food={safeCategory}>
      {ICONS[safeCategory]}
    </svg>
  );

  if (!hasTile) return <span className={cx('inline-flex shrink-0', className)}>{icon}</span>;

  return (
    <span
      className={cx(
        'inline-flex shrink-0 items-center justify-center',
        FOOD_GROUP_TILE_CLASS[FOOD_CATEGORY_GROUP[safeCategory]],
        className,
      )}
      style={{ width: size, height: size, borderRadius: size * TILE_RADIUS_RATIO }}
      aria-hidden="true"
    >
      {icon}
    </span>
  );
};
