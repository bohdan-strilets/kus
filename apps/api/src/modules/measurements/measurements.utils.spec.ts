import { describe, expect, it } from 'vitest'

import type { MeasurementValue } from './measurements.mapper'
import {
	findWeekAgo,
	getChangeFromStart,
	getDayDistance,
	getKgToGoal,
	subtractTenths,
} from './measurements.utils'

const weight = (localDate: string, value = 80): MeasurementValue => ({
	id: localDate,
	kind: 'WEIGHT',
	value,
	localDate: new Date(`${localDate}T00:00:00Z`),
	measuredAt: new Date(`${localDate}T08:00:00Z`),
	source: 'CHAT',
	messageId: null,
	createdAt: new Date(),
	deletedAt: null,
})

describe('subtractTenths', () => {
	it('carries no float noise', () => {
		expect(subtractTenths(83.3, 82.1)).toBe(1.2)
		expect(subtractTenths(0.3, 0.1)).toBe(0.2)
		expect(subtractTenths(82, 83.4)).toBe(-1.4)
	})
})

describe('getChangeFromStart', () => {
	it('is the current value minus the start', () => {
		expect(
			getChangeFromStart({ current: { id: 'c', value: 99 }, start: { id: 's', value: 102 } }),
		).toBe(-3)
	})

	it('is null without a start', () => {
		expect(getChangeFromStart({ current: { id: 'c', value: 99 }, start: null })).toBeNull()
	})

	it('is null when the start is the same row', () => {
		expect(
			getChangeFromStart({ current: { id: 's', value: 99 }, start: { id: 's', value: 99 } }),
		).toBeNull()
	})
})

describe('getDayDistance', () => {
	it('counts whole days between local dates', () => {
		expect(getDayDistance(new Date('2026-10-12T00:00:00Z'), new Date('2026-10-05T00:00:00Z'))).toBe(
			7,
		)
		expect(getDayDistance(new Date('2026-10-12T00:00:00Z'), new Date('2026-10-12T00:00:00Z'))).toBe(
			0,
		)
	})
})

describe('findWeekAgo', () => {
	const row = weight('2026-10-12')

	it('takes rows exactly 5 and 9 days back, not 4 or 10', () => {
		expect(findWeekAgo(row, [weight('2026-10-07')])?.id).toBe('2026-10-07')
		expect(findWeekAgo(row, [weight('2026-10-03')])?.id).toBe('2026-10-03')
		expect(findWeekAgo(row, [weight('2026-10-08')])).toBeNull()
		expect(findWeekAgo(row, [weight('2026-10-02')])).toBeNull()
	})

	it('ignores the row itself and later rows', () => {
		expect(findWeekAgo(row, [row, weight('2026-10-13')])).toBeNull()
	})

	it('is null for an empty history', () => {
		expect(findWeekAgo(row, [])).toBeNull()
	})
})

describe('getKgToGoal', () => {
	it('is null without a target', () => {
		expect(getKgToGoal({ goalType: 'LOSE', current: 80, target: null })).toBeNull()
	})

	it('LOSE counts down to the target and stops at 0', () => {
		expect(getKgToGoal({ goalType: 'LOSE', current: 82.4, target: 78 })).toBe(4.4)
		expect(getKgToGoal({ goalType: 'LOSE', current: 78, target: 78 })).toBe(0)
		expect(getKgToGoal({ goalType: 'LOSE', current: 77, target: 78 })).toBe(0)
	})

	it('GAIN counts up to the target and stops at 0', () => {
		expect(getKgToGoal({ goalType: 'GAIN', current: 70.2, target: 75 })).toBe(4.8)
		expect(getKgToGoal({ goalType: 'GAIN', current: 76, target: 75 })).toBe(0)
	})
})
