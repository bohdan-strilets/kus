import { describe, expect, it } from 'vitest'

import { getMealEatenAt, getMealEatenAtForDay, getMealTypeByHour } from './meal-type'

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

describe('getMealEatenAtForDay', () => {
	const timezone = 'Europe/Warsaw'
	// 14:20 on 2026-10-07 in Warsaw (UTC+2)
	const now = new Date('2026-10-07T12:20:00Z')
	const day = (date: string): Date => new Date(`${date}T00:00:00Z`)

	it('follows getMealEatenAt for today', () => {
		const params = { mealType: 'BREAKFAST', isNamed: true, now, timezone } as const
		expect(getMealEatenAtForDay({ ...params, localDate: day('2026-10-07') })).toEqual(
			getMealEatenAt(params),
		)
		expect(
			getMealEatenAtForDay({
				mealType: 'LUNCH',
				isNamed: false,
				localDate: day('2026-10-07'),
				now,
				timezone,
			}),
		).toBe(now)
	})

	it('puts a past day at the typical hour of the meal, even if the meal is the current one', () => {
		const eatenAt = getMealEatenAtForDay({
			mealType: 'LUNCH',
			isNamed: false,
			localDate: day('2026-10-06'),
			now,
			timezone,
		})
		expect(eatenAt.toISOString()).toBe('2026-10-06T11:00:00.000Z')
	})

	it('puts tomorrow at the typical hour of the meal — in the future on purpose', () => {
		const eatenAt = getMealEatenAtForDay({
			mealType: 'DINNER',
			isNamed: true,
			localDate: day('2026-10-08'),
			now,
			timezone,
		})
		expect(eatenAt.toISOString()).toBe('2026-10-08T17:00:00.000Z')
		expect(eatenAt.getTime()).toBeGreaterThan(now.getTime())
	})

	it('uses the user day, not the UTC day, to tell today from tomorrow', () => {
		// 00:30 on Oct 8 in Warsaw is still Oct 7 in UTC
		const lateNow = new Date('2026-10-07T22:30:00Z')
		const eatenAt = getMealEatenAtForDay({
			mealType: 'BREAKFAST',
			isNamed: false,
			localDate: day('2026-10-08'),
			now: lateNow,
			timezone,
		})
		expect(eatenAt).toBe(lateNow)
	})
})
