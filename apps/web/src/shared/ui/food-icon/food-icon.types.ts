// Dish categories for icons (design/src/food). The same list becomes the FoodCategory enum in
// packages/shared and Prisma — keep them in sync (CLAUDE.md §5).
export const FOOD_CATEGORIES = [
	'eggs',
	'porridge',
	'cereal',
	'pancakes',
	'toast',
	'bread',
	'pastry',
	'dumplings',
	'pasta',
	'pizza',
	'soup',
	'borscht',
	'meat',
	'poultry',
	'sausage',
	'fish',
	'seafood',
	'potatoes',
	'salad',
	'vegetables',
	'legumes',
	'milk',
	'yogurt',
	'cottage_cheese',
	'cheese',
	'fruit',
	'banana',
	'berries',
	'dried_fruit',
	'nuts',
	'snacks',
	'protein_bar',
	'chocolate',
	'cake',
	'ice_cream',
	'cookies',
	'coffee',
	'tea',
	'juice',
	'soda',
	'alcohol',
	'protein_shake',
	'fast_food',
	'sauce',
	'plate',
] as const

export type FoodCategory = (typeof FOOD_CATEGORIES)[number]

/** The group picks the tile colour (bg-food-*). */
export type FoodGroup =
	'grain' | 'soup' | 'protein' | 'plant' | 'dairy' | 'sweet' | 'drink' | 'neutral'

/** row — food line in the chat card (36); meal — «Сьогодні» list (44); recipe — white tip tile (52). */
export type FoodIconSize = 'row' | 'meal' | 'recipe'
