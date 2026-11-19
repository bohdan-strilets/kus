import { describe, expect, it } from 'vitest'

import { filterClarifications } from './clarifications.js'
import { withPotWaterValues } from './clarify-pot-values.js'
import { clarifyInputSchema, logFoodInputSchema } from './tools.js'

const ingredient = (name: string, grams: number, kcal: number) => ({
	name,
	grams,
	kcal,
	protein: 0,
	fat: 0,
	carbs: kcal / 4,
	fiber: null,
})

// 855 g of ingredients, 1432 kcal in all
const recipe = {
	ingredients: [
		ingredient('Курка', 400, 700),
		ingredient('Картопля', 300, 400),
		ingredient('Крупа', 155, 332),
	],
	waterMl: 3000,
	cookedGrams: null,
	servings: null,
}

const log = logFoodInputSchema.parse({
	items: [
		{
			name: 'Суп',
			grams: 600,
			quantity: null,
			kcal: 268,
			protein: 0,
			fat: 0,
			carbs: 67,
			fiber: null,
			category: 'soup',
			source: 'ESTIMATE',
			confidence: 0.4,
			assumption: '≈ 3 л води',
			memoryRef: null,
			recipe,
		},
	],
	mealType: null,
	reply: 'Ок',
})

const water = (liters: number, kcal: number) => ({
	label: `${liters} л`,
	kcal,
	protein: 0,
	fat: 0,
	carbs: kcal / 4,
	fiber: null,
	grams: null,
	name: null,
	waterMl: liters * 1000,
})

const dontKnow = {
	label: 'Не знаю',
	kcal: 268,
	protein: 0,
	fat: 0,
	carbs: 67,
	fiber: null,
	grams: null,
	name: null,
	waterMl: null,
}

const question = (options: unknown[]) =>
	clarifyInputSchema.parse({ question: 'Скільки води?', itemIndexes: [0], options, kind: 'value' })

describe('withPotWaterValues', () => {
	it('counts every water option from the recipe and keeps "Не знаю"', () => {
		// flat values of the model: 268 / 232 / 204 / 268
		const counted = withPotWaterValues(
			log,
			question([water(2, 268), water(3, 232), water(4, 204), dontKnow]),
		)
		expect(counted.options.map((option) => option.kcal)).toEqual([300.9, 222.9, 177, 268])
		expect(counted.options[0]?.protein).toBe(0)
	})

	it('leaves a question about an item without a recipe as it is', () => {
		const plain = logFoodInputSchema.parse({
			items: [{ ...log.items[0], recipe: null }],
			mealType: null,
			reply: 'Ок',
		})
		const clarify = question([water(2, 268), water(4, 204)])
		expect(withPotWaterValues(plain, clarify)).toEqual(clarify)
	})
})

describe('pot water question against the thresholds', () => {
	it('passes: the counted options differ by 154.2 kcal while the flat ones by 64', () => {
		const flat = question([water(2, 268), water(3, 232), water(4, 204), water(5, 204)])
		expect(filterClarifications(log, [flat])).toEqual([])
		const [selected] = filterClarifications(log, [withPotWaterValues(log, flat)])
		expect(selected?.impactKcal).toBeCloseTo(154.2, 1)
	})

	it('drops options that really differ below the threshold', () => {
		// the model's 120 vs 350 would pass; 2 л vs 2,2 л differ by ~20 kcal
		const close = question([water(2, 120), water(2.2, 350)])
		expect(filterClarifications(log, [close])).toHaveLength(1)
		expect(filterClarifications(log, [withPotWaterValues(log, close)])).toEqual([])
	})
})

describe('pot water question: the share is counted from the backend value of the entry', () => {
	// 1800 g of the 3 l pot: the backend counts 668.7 kcal, whatever the model wrote in `kcal`
	const bigPot = (kcal: number) =>
		logFoodInputSchema.parse({
			items: [{ ...log.items[0], grams: 1800, kcal }],
			mealType: null,
			reply: 'Ок',
		})
	const counted = (pot: ReturnType<typeof bigPot>, options: unknown[]) =>
		filterClarifications(pot, [withPotWaterValues(pot, question(options))])

	it('keeps a question the model kcal would drop (share of 150 kcal vs 1000 kcal)', () => {
		// 3 l vs 4 l: 137.7 kcal, 15 % of 668.7 is 100.3, but 15 % of the model 1000 is 150
		const [selected] = counted(bigPot(1000), [water(3, 0), water(4, 0)])
		expect(selected?.impactKcal).toBeCloseTo(137.7, 1)
	})

	it('drops a question the model kcal would keep', () => {
		// 3 l vs 3,6 l: 90 kcal passes 80 and 15 % of the model 150, but not 15 % of 668.7
		expect(counted(bigPot(150), [water(3, 0), water(3.6, 0)])).toEqual([])
	})

	it('a pot without water in the recipe keeps the model kcal', () => {
		const dry = logFoodInputSchema.parse({
			items: [{ ...bigPot(1000).items[0], recipe: { ...recipe, waterMl: null } }],
			mealType: null,
			reply: 'Ок',
		})
		const plain = question([water(3, 100), water(4, 240)])
		expect(filterClarifications(dry, [plain])).toEqual([])
	})
})
