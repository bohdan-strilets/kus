import type { MyFoodResponse } from '@kus/shared'
import { describe, expect, it } from 'vitest'

import type { EditMyFoodValues } from '../model/edit-my-food.schema'
import { buildUpdateRequest, formatInputNumber, isSameAsFood, toFormValues } from './my-food-form'

const food: MyFoodResponse = {
	id: '0199b3a4-0000-7000-8000-000000000001',
	name: 'Кабаноси Tarczyński',
	brand: null,
	aliases: [],
	per100g: { kcal: 280, protein: 24, fat: 20, carbs: 2, fiber: 1.5 },
	pieceGrams: 15,
	defaultGrams: 30,
	category: 'eggs',
	source: 'MANUAL',
	updatedAt: '2026-10-30T10:00:00.000Z',
}

const values: EditMyFoodValues = {
	name: food.name,
	kcal: 280,
	protein: 24,
	carbs: 2,
	fat: 20,
	pieceGrams: 15,
	portion: 2,
}

describe('toFormValues', () => {
	it('shows the portion in pieces when there is a piece, as the mockup does', () => {
		expect(toFormValues(food)).toMatchObject({ pieceGrams: '15', portion: '2', kcal: '280' })
	})

	it('shows the portion in grams without a piece and leaves empty fields empty', () => {
		expect(toFormValues({ ...food, pieceGrams: null, defaultGrams: 150 })).toMatchObject({
			pieceGrams: '',
			portion: '150',
		})
		expect(toFormValues({ ...food, pieceGrams: null, defaultGrams: null }).portion).toBe('')
	})

	it('writes decimals with a comma', () => {
		expect(formatInputNumber(24.5)).toBe('24,5')
		expect(formatInputNumber(2 / 3)).toBe('0,67')
	})
})

describe('buildUpdateRequest', () => {
	it('keeps the saved fiber, which is not on the sheet', () => {
		expect(buildUpdateRequest(values, food, { isPortionTouched: false }).per100g.fiber).toBe(1.5)
	})

	it('keeps the saved grams of the portion until the portion or the piece is touched', () => {
		const odd = { ...food, pieceGrams: 15, defaultGrams: 40 } // 2.67 pieces on the sheet
		const same = { ...values, portion: 2.67 }

		expect(buildUpdateRequest(same, odd, { isPortionTouched: false }).defaultGrams).toBe(40)
		expect(buildUpdateRequest(same, odd, { isPortionTouched: true }).defaultGrams).toBe(40.1)
	})

	it('turns pieces into grams and clears what was emptied', () => {
		expect(
			buildUpdateRequest({ ...values, portion: 3 }, food, { isPortionTouched: true }).defaultGrams,
		).toBe(45)
		expect(
			buildUpdateRequest({ ...values, pieceGrams: null, portion: null }, food, {
				isPortionTouched: true,
			}),
		).toMatchObject({ pieceGrams: null, defaultGrams: null })
	})
})

describe('isSameAsFood', () => {
	it('is true for the untouched sheet and false after any change', () => {
		const request = buildUpdateRequest(values, food, { isPortionTouched: false })

		expect(isSameAsFood(request, food)).toBe(true)
		expect(isSameAsFood({ ...request, name: 'Інше' }, food)).toBe(false)
		expect(isSameAsFood({ ...request, per100g: { ...request.per100g, fat: 21 } }, food)).toBe(false)
	})
})
