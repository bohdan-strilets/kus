// Recipes (0.13.0): a pot is logged with item.recipe (the backend counts the portion from the
// ingredients, the water, the weight or the plates), «Зберегти рецепт?» → save_recipe, recipeRef for
// a saved dish, correct_entry.recipe for another water, find_food for the saved composition. The
// kcal of a logged pot are counted by the eval with recipe-values.ts, like the backend does.
// Fixtures are made up. Clock: Wed 2026-10-07.
import { getRecipeKcalPerGram } from '@kus/shared'

import { entry, NO_MEMORY_CALLS, range } from './case-builders.js'
import type { EvalCase, SavedRecipe } from './case.types.js'
import { savedRecipe, toRecipeContext } from '../read-fixtures.js'

const GRAMS_PER_100 = 100

const ingredient = (name: string, grams: number, kcalPer100g: number, macros: number[]) => {
	const factor = grams / GRAMS_PER_100
	const [protein = 0, fat = 0, carbs = 0] = macros
	return {
		name,
		grams,
		kcal: Math.round(kcalPer100g * factor),
		protein: Math.round(protein * factor),
		fat: Math.round(fat * factor),
		carbs: Math.round(carbs * factor),
	}
}

/** The borscht of the saved-recipe cases: ≈ 1400 kcal in a pot of 3 l of water. */
export const SAVED_BORSCHT: SavedRecipe = savedRecipe({
	name: 'Борщ',
	portionGrams: 400,
	waterMl: 3000,
	ingredients: [
		ingredient('Яловичина', 500, 200, [20, 14, 0]),
		ingredient('Капуста', 300, 25, [1.8, 0.1, 4.7]),
		ingredient('Буряк', 200, 43, [1.6, 0.2, 9.6]),
		ingredient('Картопля', 200, 77, [2, 0.1, 17]),
		ingredient('Морква', 100, 41, [0.9, 0.2, 9.6]),
	],
	usageCount: 4,
})

/** Kcal of `grams` of a saved recipe, as the backend counts them (kcal per gram × grams). */
export const getSavedRecipeKcal = (recipe: SavedRecipe, grams: number): number =>
	getRecipeKcalPerGram(recipe) * grams

const BORSCHT_PORTION_KCAL = {
	min: Math.round(getSavedRecipeKcal(SAVED_BORSCHT, 350)),
	max: Math.round(getSavedRecipeKcal(SAVED_BORSCHT, 450)),
}

const POT_ENTRY = {
	...entry('e1', 'Борщ', 'LUNCH', 850, 183, 'borscht'),
	pot: 'unsaved' as const,
}

const POT_HISTORY = [
	{
		role: 'user' as const,
		content:
			"Зварив борщ: 500 г яловичини, 300 г капусти, 200 г буряка, 200 г картоплі, 100 г моркви, 5 л води. З'їв 850 г",
		loggedRefs: ['e1'],
	},
	{ role: 'assistant' as const, content: 'Записав борщ, 850 г. Зберегти рецепт?' },
]

const SAVE_QUESTION = ['зберегти рецепт']

export const RECIPE_CASES: EvalCase[] = [
	{
		id: 'soup-pot-recipe-field',
		text: "Зварив борщ: 500 г яловичини, 300 г капусти, 200 г буряка, 200 г картоплі, 100 г моркви, 5 л води. З'їв 850 г",
		expect: {
			decision: 'log',
			kcal: range(150, 230),
			categories: ['borscht'],
			replyIncludesAny: SAVE_QUESTION,
			recipe: {
				logged: {
					ingredientStems: ['яловичин', 'капуст', 'буряк', 'картоп', 'морк'],
					minIngredients: 5,
					waterMl: { exact: 5000 },
				},
				saved: null,
			},
			memory: NO_MEMORY_CALLS,
		},
		reference:
			'The whole pot goes into item.recipe with waterMl 5000 (the water is named, no question); the backend counts the portion: ≈ 1350–1550 kcal in ≈ 6.3 kg → ≈ 21–25 kcal/100 g × 850 g ≈ 180–210 kcal (150–230 for the beef the model picks). The reply asks «Зберегти рецепт?», nothing is saved yet',
	},
	{
		id: 'soup-pot-weighed-recipe',
		text: "Готую гороховий суп: 300 г сухого гороху, 200 г копчених ребер, 150 г картоплі, 100 г моркви, 100 г цибулі. Каструля готова: 3200 г. З'їла 450 г",
		context: { addressForm: 'NEUTRAL' },
		expect: {
			decision: 'log',
			kcal: range(210, 300),
			recipe: {
				logged: {
					ingredientStems: ['горох', 'реб'],
					minIngredients: 5,
					cookedGrams: { exact: 3200 },
				},
				saved: null,
			},
		},
		reference:
			'The weighed finished pot is cookedGrams 3200 (the water is not needed, no question): ≈ 1700–1900 kcal (peas ≈ 1000, smoked ribs ≈ 500–700, vegetables ≈ 200) / 3200 g × 450 g ≈ 230–265 kcal',
	},
	{
		id: 'soup-pot-plates-recipe',
		text: "Зварив щі: 400 г курячого філе, 400 г кислої капусти, 200 г картоплі, 100 г моркви, 100 г цибулі. Виходить 6 тарілок, з'їв одну",
		expect: {
			decision: 'log',
			kcal: range(100, 190),
			recipe: {
				logged: {
					ingredientStems: ['капуст', 'філе'],
					minIngredients: 5,
					servings: 6,
				},
				saved: null,
			},
		},
		reference:
			'6 plates → servings 6 (the water is not needed, no question); the pot ≈ 700–850 kcal (fillet ≈ 480, sauerkraut ≈ 80, potato ≈ 150, vegetables ≈ 80), one plate is a sixth ≈ 115–145 kcal',
	},
	{
		id: 'soup-pot-no-water-clarify',
		text: "Варю гороховий суп: 250 г гороху, 300 г копченої курки, 200 г картоплі, 100 г моркви. З'їв 600 г",
		expect: {
			decision: 'clarify',
			kcal: range(150, 420),
			categories: ['soup'],
			clarifyAbout: ['суп'],
			replyIncludesAny: ['вод'],
			recipe: {
				logged: { minIngredients: 4, waterMl: { min: 1000, max: 5000 } },
				clarifyWater: { options: 3, hasUnknown: true },
			},
		},
		reference:
			'No water, no weight, no plates: the portion depends on the water (1.5 l ≈ 400 kcal, 3 l ≈ 250, 5 l ≈ 170 for the pot of ≈ 1650 kcal). The model logs the most likely water (waterMl 1–5 l) and asks about it with options that carry waterMl, «Не знаю» with null',
	},
	{
		id: 'recipe-save-after-yes',
		text: 'так',
		context: { entries: [POT_ENTRY], history: POT_HISTORY },
		expect: {
			decision: 'reply',
			replyIncludesAny: ['збер'],
			recipe: { saved: { entryRef: 'e1' }, noLoggedPot: true },
			memory: NO_MEMORY_CALLS,
		},
		reference:
			'The last turn ended with «Зберегти рецепт?» and e1 is marked as a pot: «так» → save_recipe with entryRef e1 and a reply, nothing logged again',
	},
	{
		id: 'recipe-new-intent',
		text: 'Борщ: 500 г яловичини, 300 г капусти, 200 г буряка, 200 г картоплі, 100 г моркви, 4 л води. Виходить 8 тарілок по 400 г',
		context: { intent: 'new_recipe' },
		expect: {
			decision: 'reply',
			recipe: {
				saved: {
					entryRef: null,
					recipe: {
						ingredientStems: ['яловичин', 'капуст', 'буряк', 'картоп', 'морк'],
						minIngredients: 5,
					},
					portionGrams: { exact: 400 },
				},
				noLoggedPot: true,
			},
			memory: NO_MEMORY_CALLS,
		},
		reference:
			'The message comes from «Новий рецепт»: save_recipe with the ingredients and the portion (400 g, 8 plates), nothing is eaten, so no log_food',
	},
	{
		id: 'recipe-new-intent-no-ingredients',
		text: 'тест',
		context: { intent: 'new_recipe' },
		expect: {
			decision: 'reply',
			replyIncludesAny: ['що входить', 'скільки', 'склад', 'інгредієнт', 'продукт'],
			recipe: { saved: null, noLoggedPot: true },
			memory: NO_MEMORY_CALLS,
		},
		reference:
			'«Новий рецепт» with a word that is no recipe: the model asks what goes into the dish and how much; nothing is saved and nothing is logged',
	},
	{
		id: 'recipe-again-other-day',
		text: "з'їв тарілку борщу як минулого разу",
		context: { recipes: [toRecipeContext(SAVED_BORSCHT, 'r1')] },
		savedRecipes: [SAVED_BORSCHT],
		expect: {
			decision: 'log',
			kcal: range(BORSCHT_PORTION_KCAL.min, BORSCHT_PORTION_KCAL.max),
			maxItems: 1,
			recipe: { recipeRef: 'r1', saved: null },
			copyRefs: [],
			memory: NO_MEMORY_CALLS,
		},
		reference: `The saved Борщ is r1 (portion 400 g): recipeRef r1, the backend takes its kcal per 100 g (${BORSCHT_PORTION_KCAL.min}–${BORSCHT_PORTION_KCAL.max} kcal for 350–450 g); no new recipe, no question to save it again`,
	},
	{
		id: 'recipe-water-correction',
		text: 'там було 4 л',
		context: { entries: [POT_ENTRY], history: POT_HISTORY },
		expect: {
			decision: 'edit',
			edits: { corrected: [{ ref: 'e1', recipe: { waterMl: 4000 } }] },
			recipe: { noLoggedPot: true },
		},
		reference:
			'The pot e1 was logged with 5 l of water; «там було 4 л» → correct_entry with recipe { waterMl 4000 } only (no grams or values: the backend recounts the pot and its portions)',
	},
	{
		id: 'recipe-show-saved',
		text: 'покажи рецепт борщу',
		context: { recipes: [toRecipeContext(SAVED_BORSCHT, 'r1')] },
		savedRecipes: [SAVED_BORSCHT],
		expect: {
			decision: 'reply',
			findFoodCalled: true,
			replyIncludesAny: ['яловичин'],
			replyIncludes: ['500'],
			replyExcludes: ['квасол', 'часник', 'томат', 'лавров'],
			recipe: { noLoggedPot: true, saved: null },
			memory: NO_MEMORY_CALLS,
		},
		reference:
			'«Saved recipes» has no composition: the model reads it with find_food and lists exactly beef 500 g, cabbage 300 g, beet 200 g, potato 200 g, carrot 100 g — no beans, garlic, tomato or bay leaf of its own',
	},
]
