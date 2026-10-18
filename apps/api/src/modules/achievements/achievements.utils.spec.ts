import { describe, expect, it } from 'vitest'

import {
	getFoodStreak,
	getKgLostBaseline,
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

describe('getKgLostBaseline', () => {
	it.each([
		['the first weight when no step is big', [84, 82, 81.9], 84],
		['the weight after a big step in the middle (a correction)', [90, 85, 84.8], 85],
		['the first weight: the steps 3.0 and 0.1 are not big', [88, 85, 84.9], 88],
		['the weight after the last big step in the middle', [90, 70, 69.5], 70],
		['the weight after a compromise step of 4 kg', [90, 86, 85.5], 86],
		['the first weight: a step of exactly 3.0 kg is not big', [90, 87, 86.9], 90],
	])('is %s', (_name, chainKg, expected) => {
		expect(getKgLostBaseline({ chainKg })).toBe(expected)
	})

	it('is null when the last step is big (a typo)', () => {
		expect(getKgLostBaseline({ chainKg: [84, 82, 78] })).toBeNull()
	})

	it('is null for a chain of one weight or none', () => {
		expect(getKgLostBaseline({ chainKg: [90] })).toBeNull()
		expect(getKgLostBaseline({ chainKg: [] })).toBeNull()
	})

	it('does not change the chain it reads', () => {
		const chainKg = [90, 85, 84.8]

		getKgLostBaseline({ chainKg })

		expect(chainKg).toEqual([90, 85, 84.8])
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
