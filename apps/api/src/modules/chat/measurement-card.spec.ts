import { describe, expect, it } from 'vitest'

import type { MeasurementValue } from '../measurements/measurements.mapper'
import type { WeightGoal } from '../profile/profile.types'
import { buildMeasurementCard } from './measurement-card'

const TIMEZONE = 'Europe/Warsaw'
const NO_GOAL: WeightGoal = { goalType: null, targetWeightKg: null, paceKgPerWeek: null }
const LOSE_GOAL: WeightGoal = { goalType: 'LOSE', targetWeightKg: 78, paceKgPerWeek: 0.5 }

const toValue = (
	date: string,
	value: number,
	kind: MeasurementValue['kind'] = 'WEIGHT',
): MeasurementValue => ({
	id: `${kind}-${date}`,
	kind,
	value,
	localDate: new Date(`${date}T00:00:00Z`),
	measuredAt: new Date(`${date}T08:00:00Z`),
	source: 'CHAT',
	messageId: null,
	createdAt: new Date(`${date}T08:00:00Z`),
	deletedAt: null,
})

describe('buildMeasurementCard', () => {
	const start = toValue('2026-08-01', 90)
	const history = [
		toValue('2026-08-01', 90),
		toValue('2026-09-12', 86), // 30 days before
		toValue('2026-09-20', 85), // week 3 window (22..28 days back is 09-14..09-20)
		toValue('2026-09-21', 84.8),
		toValue('2026-10-03', 83.4), // 9 days back
		toValue('2026-10-06', 82.8), // 6 days back
		toValue('2026-10-12', 82.4),
	]
	const row = toValue('2026-10-12', 82.4)

	it('compares with the start, the target and the plan', () => {
		const card = buildMeasurementCard({ row, start, history, goal: LOSE_GOAL, timezone: TIMEZONE })

		expect(card).toMatchObject({
			id: row.id,
			kind: 'WEIGHT',
			value: 82.4,
			localDate: '2026-10-12',
			source: 'CHAT',
			fromStart: -7.6,
			toGoal: 4.4,
			isGoalReached: false,
			planPaceKgPerWeek: 0.5,
		})
	})

	it('takes weekChange from the value nearest to 7 days back within 5–9 days', () => {
		// 10-06 is 6 days back, 10-03 is 9: 6 is nearer to 7
		expect(
			buildMeasurementCard({ row, start, history, goal: NO_GOAL, timezone: TIMEZONE }).weekChange,
		).toBe(-0.4)
	})

	it('takes the later day when two are equally far from 7 days back', () => {
		const tied = [toValue('2026-10-04', 83), toValue('2026-10-06', 82.6), row]
		// 8 days back and 6 days back are both one away from 7
		expect(
			buildMeasurementCard({ row, start, history: tied, goal: NO_GOAL, timezone: TIMEZONE })
				.weekChange,
		).toBe(-0.2)
	})

	it('has no weekChange without a value 5–9 days back', () => {
		const sparse = [toValue('2026-10-09', 83), toValue('2026-09-30', 84), row]
		expect(
			buildMeasurementCard({ row, start, history: sparse, goal: NO_GOAL, timezone: TIMEZONE })
				.weekChange,
		).toBeNull()
	})

	it('draws up to 5 weekly points ending on the card day, oldest first', () => {
		const { chart } = buildMeasurementCard({
			row,
			start,
			history,
			goal: NO_GOAL,
			timezone: TIMEZONE,
		})

		// weeks: 10-06..10-12, 09-29..10-05, 09-22..09-28, 09-15..09-21, 09-08..09-14
		expect(chart).toEqual([
			{ localDate: '2026-09-12', value: 86 },
			{ localDate: '2026-09-21', value: 84.8 },
			{ localDate: '2026-10-03', value: 83.4 },
			{ localDate: '2026-10-12', value: 82.4 },
		])
	})

	it('is a snapshot: a later weight does not change an earlier card', () => {
		const later = [...history, toValue('2026-10-20', 80)]
		const card = buildMeasurementCard({
			row,
			start,
			history: later,
			goal: NO_GOAL,
			timezone: TIMEZONE,
		})

		expect(card.chart.at(-1)).toEqual({ localDate: '2026-10-12', value: 82.4 })
	})

	it('has no fromStart for the very first value', () => {
		const first = toValue('2026-08-01', 90)
		const card = buildMeasurementCard({
			row: first,
			start,
			history: [first],
			goal: NO_GOAL,
			timezone: TIMEZONE,
		})

		expect(card.fromStart).toBeNull()
		expect(card.chart).toEqual([{ localDate: '2026-08-01', value: 90 }])
	})

	it('has no distance to the goal without a goal or for MAINTAIN', () => {
		const maintain: WeightGoal = { goalType: 'MAINTAIN', targetWeightKg: 82, paceKgPerWeek: null }

		for (const goal of [NO_GOAL, maintain]) {
			const card = buildMeasurementCard({ row, start, history, goal, timezone: TIMEZONE })
			expect(card.toGoal).toBeNull()
			expect(card.isGoalReached).toBeNull()
			expect(card.planPaceKgPerWeek).toBeNull()
		}
	})

	it('reports a reached target', () => {
		const reached = toValue('2026-10-12', 77.8)
		const card = buildMeasurementCard({
			row: reached,
			start,
			history: [reached],
			goal: LOSE_GOAL,
			timezone: TIMEZONE,
		})

		expect(card.isGoalReached).toBe(true)
		expect(card.toGoal).toBe(0)
	})

	it('leaves the goal fields empty for a waist', () => {
		const waist = toValue('2026-10-12', 94, 'WAIST')
		const card = buildMeasurementCard({
			row: waist,
			start: toValue('2026-09-01', 98, 'WAIST'),
			history: [waist],
			goal: LOSE_GOAL,
			timezone: TIMEZONE,
		})

		expect(card).toMatchObject({
			fromStart: -4,
			toGoal: null,
			isGoalReached: null,
			planPaceKgPerWeek: null,
		})
	})

	describe('measuredAt and isDeleted', () => {
		it('shows the moment of a value written for its own day', () => {
			const card = buildMeasurementCard({ row, start, history, goal: NO_GOAL, timezone: TIMEZONE })

			expect(card.measuredAt).toBe(row.measuredAt.toISOString())
			expect(card.isDeleted).toBe(false)
		})

		it('has no moment for a value written later for an earlier day', () => {
			const backdated = { ...row, createdAt: new Date('2026-10-14T08:00:00Z') }

			const card = buildMeasurementCard({
				row: backdated,
				start,
				history,
				goal: NO_GOAL,
				timezone: TIMEZONE,
			})

			expect(card.measuredAt).toBeNull()
		})

		it('compares the days in the timezone of the user', () => {
			// 23:30 UTC on 10-11 is already 10-12 in Warsaw
			const lateEvening = { ...row, createdAt: new Date('2026-10-11T23:30:00Z') }

			const card = buildMeasurementCard({
				row: lateEvening,
				start,
				history,
				goal: NO_GOAL,
				timezone: TIMEZONE,
			})

			expect(card.measuredAt).not.toBeNull()
		})

		it('marks a deleted value', () => {
			const deleted = { ...row, deletedAt: new Date() }

			const card = buildMeasurementCard({
				row: deleted,
				start,
				history,
				goal: NO_GOAL,
				timezone: TIMEZONE,
			})

			expect(card.isDeleted).toBe(true)
		})
	})
})
