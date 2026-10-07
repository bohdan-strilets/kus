import type { FoodIconSize } from './food-icon.types'

/** Tile and pictogram sizes per place (mockups: chat card 36/26, today list 44/28, tip 52/38). */
export const FOOD_ICON_SIZE: Record<FoodIconSize, { tileClassName: string; iconPx: number }> = {
	row: { tileClassName: 'size-9 rounded-icon', iconPx: 26 },
	meal: { tileClassName: 'size-11 rounded-tile-sm', iconPx: 28 },
	recipe: { tileClassName: 'size-13 rounded-tile', iconPx: 38 },
}

/** The tip tile is white whatever the dish (chat: «Курка з гречкою»). */
export const RECIPE_TILE_COLOR = '#FFFFFF'
