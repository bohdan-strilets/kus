import { cn } from '@/shared/lib'

import { FOOD_ARTWORK } from './food-icon.artwork'
import { FOOD_ICON_SIZE, RECIPE_TILE_COLOR } from './food-icon.constants'
import type { FoodIconKind, FoodIconSize } from './food-icon.types'

export interface FoodIconProps {
	/** Unknown dishes get `plate`. */
	kind?: FoodIconKind
	size?: FoodIconSize
	className?: string
}

/**
 * A food pictogram on its coloured tile. Always decorative: the dish name sits next to it.
 * In the day list a pictogram drawn larger than 28 (soup, 30) keeps its own size, as in today.
 */
export const FoodIcon = ({ kind = 'plate', size = 'row', className }: FoodIconProps) => {
	const artwork = FOOD_ARTWORK[kind]
	const { tileClassName, iconPx } = FOOD_ICON_SIZE[size]
	const pictogramPx = size === 'meal' ? Math.max(iconPx, artwork.viewBox) : iconPx
	const tileColor = size === 'recipe' ? RECIPE_TILE_COLOR : artwork.tile

	return (
		<span
			aria-hidden="true"
			className={cn('flex shrink-0 items-center justify-center', tileClassName, className)}
			// illustration palette per dish, so it is a dynamic value rather than a token class
			style={{ backgroundColor: tileColor }}
		>
			<svg
				width={pictogramPx}
				height={pictogramPx}
				viewBox={`0 0 ${artwork.viewBox} ${artwork.viewBox}`}
			>
				{artwork.body}
			</svg>
		</span>
	)
}
