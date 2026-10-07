import type { ReactNode } from 'react'

/** Pictograms drawn in the chat and «Сьогодні» mockups; `plate` is the neutral fallback. */
export type FoodIconKind =
	'egg' | 'buckwheat' | 'coffee' | 'chickenBuckwheat' | 'soup' | 'banana' | 'pizza' | 'plate'

/** row — meal card line (36 tile, chat); meal — day list (44 tile, today); recipe — tip (52 white). */
export type FoodIconSize = 'row' | 'meal' | 'recipe'

export interface FoodArtwork {
	/** Square viewBox side, as drawn in the mockup. */
	viewBox: number
	/** Tile colour behind the pictogram (illustration palette, not a UI token). */
	tile: string
	body: ReactNode
}
