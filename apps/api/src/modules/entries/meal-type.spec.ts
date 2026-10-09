import { describe, expect, it } from 'vitest'

import { getMealEatenAt, getMealTypeByHour } from './meal-type'

describe('getMealTypeByHour', () => {
	it.each([
		[3, 'SNACK'],
		[4, 'BREAKFAST'],
		[10, 'BREAKFAST'],
		[11, 'LUNCH'],
		[15, 'LUNCH'],
		[16, 'DINNER'],
		[21, 'DINNER'],
		[22, 'SNACK'],
		[0, 'SNACK'],
	])('hour %i → %s', (hour, type) => {
		expect(getMealTypeByHour(hour)).toBe(type)
	})
})

describe('getMealEatenAt', () => {
	const timezone = 'Europe/Warsaw'
	// 14:20 in Warsaw (UTC+2), lunch by the clock
	const now = new Date('2026-10-07T12:20:00Z')

	it('keeps the moment of sending for a meal picked by the clock', () => {
		expect(getMealEatenAt({ mealType: 'LUNCH', isNamed: false, now, timezone })).toBe(now)
	})

	it('keeps the moment of sending when the named meal is the current one', () => {
		expect(getMealEatenAt({ mealType: 'LUNCH', isNamed: true, now, timezone })).toBe(now)
	})

	it('moves an earlier named meal to its typical time', () => {
		const eatenAt = getMealEatenAt({ mealType: 'BREAKFAST', isNamed: true, now, timezone })
		expect(eatenAt.toISOString()).toBe('2026-10-07T06:00:00.000Z')
	})

	it('never puts a later named meal in the future', () => {
		expect(getMealEatenAt({ mealType: 'DINNER', isNamed: true, now, timezone })).toBe(now)
	})
})
