import { describe, expect, it } from 'vitest'

import { i18n } from '@/shared/i18n'
import { formatInteger } from '@/shared/lib'

import { createEditEntrySchema } from './edit-entry.schema'

const t = i18n.t.bind(i18n)
const schema = createEditEntrySchema(t, { unit: 'g' })

const getMessages = (input: unknown): Record<string, string> => {
	const result = schema.safeParse(input)
	if (result.success) return {}
	return Object.fromEntries(
		result.error.issues.map((issue) => [String(issue.path[0]), issue.message]),
	)
}

describe('createEditEntrySchema', () => {
	it('turns the typed digits into the API body', () => {
		expect(schema.parse({ grams: ' 150 ', mealType: 'LUNCH' })).toEqual({
			grams: 150,
			mealType: 'LUNCH',
		})
	})

	it('says what is wrong with the weight', () => {
		expect(getMessages({ grams: '', mealType: 'LUNCH' })).toEqual({ grams: 'Вкажи вагу' })
		expect(getMessages({ grams: '12,5', mealType: 'LUNCH' })).toEqual({
			grams: 'Лише ціле число, без коми',
		})
		expect(getMessages({ grams: '0', mealType: 'LUNCH' })).toEqual({
			grams: `Від 1 до ${formatInteger(5000)} г`,
		})
		expect(getMessages({ grams: '5001', mealType: 'LUNCH' })).toEqual({
			grams: `Від 1 до ${formatInteger(5000)} г`,
		})
	})

	it('reads the range in ml for a drink', () => {
		const forDrinks = createEditEntrySchema(t, { unit: 'ml' })
		const result = forDrinks.safeParse({ grams: '0', mealType: 'SNACK' })
		expect(result.success).toBe(false)
		if (result.success) return
		expect(result.error.issues[0]?.message).toBe(`Від 1 до ${formatInteger(5000)} мл`)
	})

	it('never moves an entry into OTHER and asks for a meal when none is chosen', () => {
		expect(getMessages({ grams: '100', mealType: 'OTHER' })).toEqual({
			mealType: 'Обери прийом їжі',
		})
		expect(getMessages({ grams: '100', mealType: undefined })).toEqual({
			mealType: 'Обери прийом їжі',
		})
	})
})
