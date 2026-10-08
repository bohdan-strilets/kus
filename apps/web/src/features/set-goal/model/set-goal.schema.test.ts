import { describe, expect, it } from 'vitest'

import { i18n } from '@/shared/i18n'
import { formatInteger } from '@/shared/lib'

import { createSetGoalSchema } from './set-goal.schema'

const schema = createSetGoalSchema(i18n.t.bind(i18n))
const valid = { kcal: '2200', protein: '140', carbs: '225', fat: '80' }

describe('createSetGoalSchema', () => {
	it('turns the typed digits into the API body', () => {
		expect(schema.parse(valid)).toEqual({ kcal: 2200, protein: 140, carbs: 225, fat: 80 })
	})

	it('says what is wrong with each field', () => {
		const result = schema.safeParse({ kcal: '500', protein: '', carbs: '12,5', fat: '700' })
		expect(result.success).toBe(false)
		if (result.success) return
		const messages: Record<string, string> = Object.fromEntries(
			result.error.issues.map((issue) => [String(issue.path[0]), issue.message]),
		)
		expect(messages).toEqual({
			kcal: `Від 800 до ${formatInteger(6000)} ккал`,
			protein: 'Вкажи число',
			carbs: 'Лише ціле число, без коми',
			fat: 'Від 0 до 600 г',
		})
	})
})
