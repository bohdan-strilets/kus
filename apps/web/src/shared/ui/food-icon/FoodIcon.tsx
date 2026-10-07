import type { ReactNode } from 'react'

import { cn } from '@/shared/lib'

import { FOOD_CATEGORY_GROUP, FOOD_GROUP_TILE_CLASS, FOOD_ICON_SIZE } from './food-icon.constants'
import { FALLBACK_FOOD_CATEGORY, type FoodCategory, type FoodIconSize } from './food-icon.types'
import { FOOD_ICON_PATHS } from './food-icons.generated'

// Record<FoodCategory, …> makes every category need an SVG: a missing file fails typecheck
const ICONS: Record<FoodCategory, ReactNode> = FOOD_ICON_PATHS

export interface FoodIconProps {
	/** Unknown or missing category shows the plate. */
	category: FoodCategory | null | undefined
	size?: FoodIconSize
	className?: string
}

const isFoodCategory = (value: string): value is FoodCategory => value in ICONS

/**
 * A dish category icon on its group's tile (design/src/food). Always decorative: the dish name
 * is next to it as text.
 */
export const FoodIcon = ({ category, size = 'row', className }: FoodIconProps) => {
	const safeCategory = category && isFoodCategory(category) ? category : FALLBACK_FOOD_CATEGORY
	const { tileClassName, iconPx, hasGroupTile } = FOOD_ICON_SIZE[size]

	return (
		<span
			aria-hidden="true"
			className={cn(
				'flex shrink-0 items-center justify-center',
				hasGroupTile && FOOD_GROUP_TILE_CLASS[FOOD_CATEGORY_GROUP[safeCategory]],
				tileClassName,
				className,
			)}
		>
			<svg width={iconPx} height={iconPx} viewBox="0 0 32 32" data-food={safeCategory}>
				{ICONS[safeCategory]}
			</svg>
		</span>
	)
}
