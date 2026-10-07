// The category list lives in packages/shared (zod enum mirrored by Prisma) — never duplicated here
export { FALLBACK_FOOD_CATEGORY, FOOD_CATEGORIES, type FoodCategory } from '@kus/shared'

/** The group picks the tile colour (bg-food-*). */
export type FoodGroup =
	'grain' | 'soup' | 'protein' | 'plant' | 'dairy' | 'sweet' | 'drink' | 'neutral'

/** row — food line in the chat card (36); meal — «Сьогодні» list (44); recipe — white tip tile (52). */
export type FoodIconSize = 'row' | 'meal' | 'recipe'
