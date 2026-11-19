import { describe, expect, it } from 'vitest'

import { evalCaseSchema } from './case.types.js'
import { REPO_CASES } from './index.js'
import { getSavedRecipeKcal, RECIPE_CASES, SAVED_BORSCHT } from './recipe.cases.js'

const byId = (id: string) => {
	const found = RECIPE_CASES.find((item) => item.id === id)
	if (!found) throw new Error(`no case ${id}`)
	return found
}

describe('recipe cases', () => {
	it('are the ten cases of stage 0.13.0, valid, with ids unique across the repo set', () => {
		expect(RECIPE_CASES).toHaveLength(10)
		const ids = REPO_CASES.map(({ id }) => id)
		expect(new Set(ids).size).toBe(ids.length)
		for (const evalCase of RECIPE_CASES) {
			expect(evalCaseSchema.safeParse(evalCase).success, evalCase.id).toBe(true)
		}
	})

	it('hold no personal data: made-up names only, no emails or phones', () => {
		expect(JSON.stringify(RECIPE_CASES)).not.toMatch(/@|\+\d{6,}/)
	})

	it('send «Новий рецепт» as the intent, and only the cases of that screen', () => {
		const withIntent = RECIPE_CASES.filter(({ context }) => context?.intent === 'new_recipe')
		expect(withIntent.map(({ id }) => id).sort()).toEqual([
			'recipe-new-intent',
			'recipe-new-intent-no-ingredients',
		])
	})

	it('log nothing and save nothing for a bare word of «Новий рецепт»', () => {
		expect(byId('recipe-new-intent-no-ingredients').expect).toMatchObject({
			decision: 'reply',
			recipe: { saved: null, noLoggedPot: true },
		})
		expect(byId('recipe-new-intent').expect.recipe).toMatchObject({ noLoggedPot: true })
	})

	it('judge the pots of the pot cases by what the user said about the water', () => {
		expect(byId('soup-pot-recipe-field').expect.recipe?.logged?.waterMl).toEqual({ exact: 5000 })
		expect(byId('soup-pot-weighed-recipe').expect.recipe?.logged?.cookedGrams).toEqual({
			exact: 3200,
		})
		expect(byId('soup-pot-plates-recipe').expect.recipe?.logged?.servings).toBe(6)
		expect(byId('soup-pot-no-water-clarify').expect).toMatchObject({
			decision: 'clarify',
			recipe: { clarifyWater: { hasUnknown: true } },
		})
	})

	it('count the saved portion range by the shared recipe-values from the fixture', () => {
		const { kcal } = byId('recipe-again-other-day').expect
		const mid = getSavedRecipeKcal(SAVED_BORSCHT, SAVED_BORSCHT.portionGrams ?? 0)
		expect(kcal).toMatchObject({ min: expect.any(Number) as number })
		expect('min' in (kcal ?? {}) && (kcal as { min: number; max: number }).min < mid).toBe(true)
		expect('max' in (kcal ?? {}) && (kcal as { min: number; max: number }).max > mid).toBe(true)
	})

	it('give the saved-recipe cases the r1 of the «Saved recipes» block and the composition for find_food', () => {
		for (const id of ['recipe-again-other-day', 'recipe-show-saved']) {
			const evalCase = byId(id)
			expect(evalCase.context?.recipes?.[0]?.ref).toBe('r1')
			expect(evalCase.savedRecipes).toHaveLength(1)
		}
	})
})
