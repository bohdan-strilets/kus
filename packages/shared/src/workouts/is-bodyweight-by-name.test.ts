import { describe, expect, it } from 'vitest'

import { isBodyweightByName } from './is-bodyweight-by-name.js'

describe('isBodyweightByName', () => {
	it.each([
		'Підтягування',
		'Підтягування широким хватом',
		'Віджимання',
		'Віджимання на брусах',
		'Скручування',
		'Планка',
		'Підйом ніг у висі',
		'Бурпі',
		'Pull-ups',
		'Pull up',
		'Push-up',
		'Plank',
		'Burpees',
		'Crunches',
		'Dips',
	])('%s is bodyweight', (name) => {
		expect(isBodyweightByName(name)).toBe(true)
	})

	it.each(['Жим лежачи', 'Присідання зі штангою', 'Біг', 'Bench press', ''])(
		'%s is not bodyweight',
		(name) => {
			expect(isBodyweightByName(name)).toBe(false)
		},
	)

	it('matches by the start of a word, not by a substring', () => {
		expect(isBodyweightByName('Hipdips')).toBe(false)
		expect(isBodyweightByName('Overplank')).toBe(false)
	})

	it('needs every stem of a multi-word rule', () => {
		expect(isBodyweightByName('Підйом на носки')).toBe(false)
		expect(isBodyweightByName('Підйом ніг лежачи')).toBe(false)
	})

	it('ignores the case', () => {
		expect(isBodyweightByName('ПЛАНКА')).toBe(true)
	})
})
