import { getRecipePortionValues } from './recipe-values.js'
import type { ClarifyInput, ClarifyOption, LogFoodInput } from './tools.js'

const round1 = (value: number): number => Math.round(value * 10) / 10

/**
 * A question about the water of a pot: the model's flat values for the options are ignored, each
 * option with `waterMl` gets the portion the backend counts from the item's recipe. "Не знаю"
 * (no waterMl) keeps its values. Only for a question about one item that carries a recipe.
 */
export const withPotWaterValues = (log: LogFoodInput, clarify: ClarifyInput): ClarifyInput => {
	const [index] = clarify.itemIndexes
	const item =
		clarify.itemIndexes.length === 1 && index !== undefined ? log.items[index] : undefined
	if (!item?.recipe) return clarify
	const { recipe } = item
	const options = clarify.options.map((option): ClarifyOption => {
		if (option.waterMl === null) return option
		const values = getRecipePortionValues(
			{ ...recipe, waterMl: option.waterMl, cookedGrams: null },
			item.grams,
		)
		return {
			...option,
			kcal: round1(values.kcal),
			protein: round1(values.protein),
			fat: round1(values.fat),
			carbs: round1(values.carbs),
			fiber: null,
			grams: null,
		}
	})
	return { ...clarify, options }
}
