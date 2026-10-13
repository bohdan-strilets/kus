import { describe, expect, it } from 'vitest'

import {
	getFoodStreak,
	getKgThresholds,
	getWholeKgLost,
	isBigWeightStep,
} from './achievements.utils'

const TODAY = new Date('2026-10-12T00:00:00Z')

describe('getWholeKgLost', () => {
	it.each([
		[84.0, 83.0, 1],
		[84.0, 83.1, 0],
		[84.0, 82.9, 1],
		[84.1, 82.1, 2],
		[84.0, 85.0, 0],
		[84.0, 84.0, 0],
		// 0.1 steps do not drift: 0.3 + 0.7 style sums stay exact in tenths
		[83.3, 82.3, 1],
		[100.0, 90.0, 10],
	])('from %s to %s is %s kg', (startKg, currentKg, expected) => {
		expect(getWholeKgLost({ startKg, currentKg })).toBe(expected)
	})
})

describe('isBigWeightStep', () => {
	it.each([
		[90, 87, false],
		[90, 86.9, true],
		[90, 93, false],
		[90, 93.1, true],
		[83.3, 80.3, false],
		[80, 80, false],
	])('from %s to %s is big: %s', (previousKg, currentKg, expected) => {
		expect(isBigWeightStep({ previousKg, currentKg })).toBe(expected)
	})
})

describe('getKgThresholds', () => {
	it('lists every whole kg up to the current one', () => {
		expect(getKgThresholds({ from: 0, to: 3 })).toEqual([1, 2, 3])
		expect(getKgThresholds({ from: 20, to: 21 })).toEqual([21])
		expect(getKgThresholds({ from: 20, to: 20 })).toEqual([])
		expect(getKgThresholds({ from: 5, to: 3 })).toEqual([])
	})
})

describe('getFoodStreak', () => {
	const run = (days: string[], maxDays = 100): number =>
		getFoodStreak({ loggedDays: new Set(days), today: TODAY, maxDays })

	it('counts the days in a row back from today', () => {
		expect(run(['2026-10-12', '2026-10-11', '2026-10-10'])).toBe(3)
	})

	it('stops at the first gap', () => {
		expect(run(['2026-10-12', '2026-10-11', '2026-10-09'])).toBe(2)
	})

	it('is 0 when today has no food, even after a long run', () => {
		expect(run(['2026-10-11', '2026-10-10', '2026-10-09'])).toBe(0)
	})

	it('does not look past the window', () => {
		const days = Array.from(
			{ length: 10 },
			(_, index) => `2026-10-${String(12 - index).padStart(2, '0')}`,
		)
		expect(run(days, 5)).toBe(5)
	})
})
