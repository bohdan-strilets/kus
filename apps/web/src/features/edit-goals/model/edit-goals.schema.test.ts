import { describe, expect, it } from 'vitest'

import { i18n } from '@/shared/i18n'
import { formatInteger } from '@/shared/lib'

import { createEditGoalsSchema } from './edit-goals.schema'

const schema = createEditGoalsSchema(i18n.t.bind(i18n))
const valid = { kcal: '2000', protein: '150', carbs: '190', fat: '70' }

const getMessages = (input: Record<string, string>): Record<string, string> => {
	const result = schema.safeParse(input)
	if (result.success) return {}
	return Object.fromEntries(
		result.error.issues.map((issue) => [String(issue.path[0]), issue.message]),
	)
}

describe('createEditGoalsSchema', () => {
	it('turns the typed digits into numbers when the macros add up (1 990 of 2 000)', () => {
		expect(schema.parse(valid)).toMatchObject({ kcal: 2000, protein: 150, carbs: 190, fat: 70 })
	})

	it('says what is wrong with each field', () => {
		expect(getMessages({ kcal: '500', protein: '', carbs: '12,5', fat: '700' })).toEqual({
			kcal: `Від 800 до ${formatInteger(6000)} ккал`,
			protein: 'Вкажи число',
			carbs: 'Лише ціле число, без коми',
			fat: 'Від 0 до 600 г',
		})
	})

	it('blocks macros that are far from the kcal, on the macros key', () => {
		const messages = getMessages({ kcal: '2000', protein: '100', carbs: '100', fat: '50' })
		expect(Object.keys(messages)).toEqual(['macros'])
		expect(messages.macros).toContain('менше за ціль')
	})
})
