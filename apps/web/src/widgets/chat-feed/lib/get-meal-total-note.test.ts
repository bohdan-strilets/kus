import { describe, expect, it } from 'vitest'

import { i18n } from '@/shared/i18n'

import { getMealTotalNote } from './get-meal-total-note'

const t = i18n.t.bind(i18n)

describe('getMealTotalNote', () => {
	it('tells the whole meal when it holds food of other messages too', () => {
		expect(getMealTotalNote({ type: 'DINNER', mealTotalKcal: 917 }, t)).toBe(
			'Вечеря разом: 917 ккал',
		)
	})

	it('groups thousands like the rest of the numbers', () => {
		expect(getMealTotalNote({ type: 'LUNCH', mealTotalKcal: 1240 }, t)).toBe(
			'Обід разом: 1 240 ккал',
		)
	})

	it('stays silent when the card is the whole meal', () => {
		expect(getMealTotalNote({ type: 'DINNER', mealTotalKcal: null }, t)).toBeNull()
	})
})
