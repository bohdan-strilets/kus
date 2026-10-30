import type { MyFoodResponse } from '@kus/shared'

/** The search field appears past this many foods (mockups/memory-products.html). */
export const MY_FOODS_SEARCH_THRESHOLD = 15

const COMBINING_MARKS = /\p{M}/gu
// «ł» has no decomposition, so «tarczynski» finds «Tarczyński» but «lodz» would not find «Łódź» without it
const LETTER_FALLBACKS: Readonly<Record<string, string>> = { ł: 'l', đ: 'd', ø: 'o' }
const FALLBACK_LETTERS = /[łđø]/g

/** Case- and diacritic-insensitive form of a name or a query. */
export const normalizeForSearch = (text: string): string =>
	text
		.normalize('NFD')
		.replace(COMBINING_MARKS, '')
		.toLowerCase()
		.replace(FALLBACK_LETTERS, (letter) => LETTER_FALLBACKS[letter] ?? letter)
		.trim()

const NAME_COLLATOR = new Intl.Collator('uk', { sensitivity: 'base' })

/** By name, as the list shows them; a copy, the cache is not touched. */
export const sortMyFoodsByName = (foods: readonly MyFoodResponse[]): MyFoodResponse[] =>
	[...foods].sort((a, b) => NAME_COLLATOR.compare(a.name, b.name))

export const shouldShowSearch = (foodsCount: number): boolean =>
	foodsCount > MY_FOODS_SEARCH_THRESHOLD

/** An empty query keeps everything. */
export const filterMyFoods = (
	foods: readonly MyFoodResponse[],
	query: string,
): MyFoodResponse[] => {
	const needle = normalizeForSearch(query)
	if (needle === '') return [...foods]
	return foods.filter((food) => normalizeForSearch(food.name).includes(needle))
}
