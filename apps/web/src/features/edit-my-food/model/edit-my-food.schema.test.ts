import type { TFunction } from 'i18next'
import { describe, expect, it } from 'vitest'

import { i18n } from '@/shared/i18n'

import { createEditMyFoodSchema, getPortionGrams } from './edit-my-food.schema'

const t = i18n.t.bind(i18n) as TFunction

const VALID = {
	name: 'Кабаноси Tarczyński',
	kcal: '280',
	protein: '24',
	carbs: '2',
	fat: '20',
	pieceGrams: '15',
	portion: '2',
}

const getErrors = (
	input: Record<string, string>,
	options?: { fiber?: number | null },
): Record<string, string> => {
	const result = createEditMyFoodSchema(t, options).safeParse({ ...VALID, ...input })
	if (result.success) return {}
	// the form shows the first message of a field
	const errors: Record<string, string> = {}
	for (const issue of result.error.issues) errors[String(issue.path[0])] ??= issue.message
	return errors
}

describe('createEditMyFoodSchema', () => {
	it('turns the typed text into numbers, with a comma or a dot', () => {
		const values = createEditMyFoodSchema(t).parse({ ...VALID, protein: '24,5', fat: '20.5' })

		expect(values).toMatchObject({
			kcal: 280,
			protein: 24.5,
			fat: 20.5,
			pieceGrams: 15,
			portion: 2,
		})
	})

	it('collapses the spaces of the name', () => {
		expect(createEditMyFoodSchema(t).parse({ ...VALID, name: '  Кабаноси   Krakus ' }).name).toBe(
			'Кабаноси Krakus',
		)
	})

	it('treats an empty piece and portion as null', () => {
		const values = createEditMyFoodSchema(t).parse({ ...VALID, pieceGrams: ' ', portion: '' })

		expect(values.pieceGrams).toBeNull()
		expect(values.portion).toBeNull()
	})

	it('asks for the name and for the numbers per 100 g', () => {
		expect(getErrors({ name: '   ' }).name).toBe('Напиши назву')
		expect(getErrors({ kcal: '' }).kcal).toBe('Вкажи число')
		expect(getErrors({ fat: 'abc' }).fat).toBe('Лише число')
	})

	it('rejects a negative number and an optional text that is not a number', () => {
		expect(getErrors({ protein: '-1' }).protein).toBe('Лише число')
		expect(getErrors({ pieceGrams: 'abc' }).pieceGrams).toBe('Лише число')
	})

	it('rejects more than 9.5 kcal per gram', () => {
		expect(getErrors({ kcal: '951' }).kcal).toBe('Не більше 950')
		expect(getErrors({ kcal: '950' }).kcal).toBeUndefined()
	})

	it('rejects macros over 100 g, with the saved fiber counted', () => {
		expect(getErrors({ protein: '50', carbs: '40', fat: '20' }).protein).toBe('Разом понад 100 г')
		expect(getErrors({ protein: '50', carbs: '30', fat: '15' }, { fiber: 10 }).protein).toBe(
			'Разом понад 100 г',
		)
		expect(getErrors({ protein: '50', carbs: '30', fat: '15' }).protein).toBeUndefined()
	})

	it('checks the grams of the portion, counted in pieces when there is a piece', () => {
		// 400 pieces x 15 g = 6000 g
		expect(getErrors({ portion: '400' }).portion).toBe('Від 1 до 5000 г')
		expect(getErrors({ pieceGrams: '', portion: '0,5' }).portion).toBe('Від 1 до 5000 г')
	})

	it('checks the grams of a piece', () => {
		expect(getErrors({ pieceGrams: '6000', portion: '' }).pieceGrams).toBe('Від 1 до 5000 г')
	})
})

describe('getPortionGrams', () => {
	it('multiplies pieces by the piece weight and rounds to a tenth', () => {
		expect(getPortionGrams(2, 15)).toBe(30)
		expect(getPortionGrams(1.5, 12.3)).toBe(18.5)
	})

	it('takes the portion as grams without a piece', () => {
		expect(getPortionGrams(150, null)).toBe(150)
	})
})
