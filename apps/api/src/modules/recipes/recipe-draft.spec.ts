import type { RecipeBody } from '@kus/shared'
import { describe, expect, it } from 'vitest'

import {
	applyPotCorrection,
	getRecipePortionGrams,
	isPotPortionValid,
	parseRecipeDraft,
	toPotDraft,
	toRecipeAliases,
} from './recipe-draft'

const body = (overrides: Partial<RecipeBody> = {}): RecipeBody => ({
	ingredients: [
		{ name: 'Філе', grams: 410, kcal: 450, protein: 90, fat: 6, carbs: 0, fiber: null },
		{ name: 'Картопля', grams: 500, kcal: 440, protein: 10, fat: 1, carbs: 100, fiber: null },
	],
	waterMl: null,
	cookedGrams: null,
	servings: null,
	...overrides,
})

describe('parseRecipeDraft', () => {
	it('reads a stored composition', () => {
		expect(parseRecipeDraft(body({ waterMl: 3000 }))?.waterMl).toBe(3000)
	})

	it.each([[null], [undefined], ['soup'], [{ ingredients: [] }], [{ waterMl: 3000 }]])(
		'treats %j as no composition',
		(value) => {
			expect(parseRecipeDraft(value)).toBeNull()
		},
	)
})

describe('toPotDraft', () => {
	it('keeps a pot that has water or a weight', () => {
		const withWater = body({ waterMl: 3000 })
		const weighed = body({ cookedGrams: 3200, servings: 8 })

		expect(toPotDraft(withWater, 350)).toBe(withWater)
		expect(toPotDraft(weighed, 350)).toBe(weighed)
	})

	it('turns plates alone into a weight: servings × the portion eaten', () => {
		expect(toPotDraft(body({ servings: 6 }), 350).cookedGrams).toBe(2100)
	})

	it('keeps a pot with no size at all (the parser asks for one before)', () => {
		const bare = body()

		expect(toPotDraft(bare, 350)).toBe(bare)
	})
})

describe('applyPotCorrection', () => {
	it('takes the new water and drops the stated weight, which would hide it', () => {
		const draft = applyPotCorrection(body({ waterMl: 3000, cookedGrams: 3900 }), {
			waterMl: 4000,
			cookedGrams: null,
		})

		expect(draft.waterMl).toBe(4000)
		expect(draft.cookedGrams).toBeNull()
	})

	it('takes a new weight and keeps the water', () => {
		const draft = applyPotCorrection(body({ waterMl: 3000 }), { waterMl: null, cookedGrams: 3000 })

		expect(draft.waterMl).toBe(3000)
		expect(draft.cookedGrams).toBe(3000)
	})
})

describe('getRecipePortionGrams', () => {
	it('prefers the weight the model said', () => {
		expect(getRecipePortionGrams(body({ servings: 6 }), 350)).toBe(350)
	})

	it('divides the pot by its servings otherwise', () => {
		expect(getRecipePortionGrams(body({ cookedGrams: 3000, servings: 6 }), null)).toBe(500)
		expect(getRecipePortionGrams(body({ waterMl: 3090, servings: 10 }), null)).toBe(400)
	})

	it('has no portion without either', () => {
		expect(getRecipePortionGrams(body({ cookedGrams: 3000 }), null)).toBeNull()
	})
})

describe('isPotPortionValid', () => {
	it('accepts a portion of a normal pot', () => {
		expect(isPotPortionValid(body({ waterMl: 3000 }), 350)).toBe(true)
	})

	it('rejects a portion over 5000 g and under 0.1 g', () => {
		expect(isPotPortionValid(body({ cookedGrams: 20000 }), 5001)).toBe(false)
		expect(isPotPortionValid(body({ cookedGrams: 20000 }), 0.05)).toBe(false)
	})

	it('rejects a pot denser than 9.5 kcal/g', () => {
		expect(isPotPortionValid(body({ cookedGrams: 50 }), 30)).toBe(false)
	})
})

describe('toRecipeAliases', () => {
	it('normalizes, dedupes and drops the name itself', () => {
		expect(toRecipeAliases(['  Борщик ', 'борщик', 'борщ', ''], 'борщ')).toEqual(['борщик'])
	})
})
