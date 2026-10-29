import { describe, expect, it } from 'vitest'

import { i18n } from '@/shared/i18n'
import { makeWorkout } from '@/shared/testing'

import { getGroupLabel } from './get-group-label'
import { getTrainingRange } from './get-training-range'
import { getWeekSummary } from './get-week-summary'
import { groupWorkoutsByDay } from './group-workouts'

const t = i18n.t.bind(i18n)
// Monday
const TODAY = '2026-10-26'

describe('getTrainingRange', () => {
	it('is the last eight weeks up to today', () => {
		expect(getTrainingRange(TODAY)).toEqual({ from: '2026-09-01', to: TODAY })
	})
})

describe('groupWorkoutsByDay', () => {
	it('puts the newest day first and orders a day by start time', () => {
		const early = makeWorkout({
			id: 'a',
			localDate: '2026-10-23',
			startedAt: '2026-10-23T05:00:00Z',
		})
		const late = makeWorkout({
			id: 'b',
			localDate: '2026-10-23',
			startedAt: '2026-10-23T17:00:00Z',
		})
		const newest = makeWorkout({ id: 'c', localDate: '2026-10-26' })

		const groups = groupWorkoutsByDay([late, newest, early])

		expect(groups.map((group) => group.localDate)).toEqual(['2026-10-26', '2026-10-23'])
		expect(groups[1]?.workouts.map((workout) => workout.id)).toEqual(['a', 'b'])
	})

	it('is empty for no workouts', () => {
		expect(groupWorkoutsByDay([])).toEqual([])
	})
})

describe('getWeekSummary', () => {
	it('counts this week from Monday and sums the known minutes', () => {
		const summary = getWeekSummary(
			[
				makeWorkout({ localDate: '2026-10-26', durationMin: 55 }),
				makeWorkout({ localDate: '2026-10-25', durationMin: 40 }),
				makeWorkout({ localDate: '2026-10-26', durationMin: null }),
			],
			TODAY,
		)

		expect(summary).toEqual({ count: 2, minutes: 55 })
	})

	it('starts the week on Monday when today is Sunday', () => {
		const summary = getWeekSummary(
			[makeWorkout({ localDate: '2026-10-26' }), makeWorkout({ localDate: '2026-10-25' })],
			'2026-11-01',
		)

		expect(summary.count).toBe(1)
	})
})

describe('getGroupLabel', () => {
	it('names today and yesterday, otherwise the weekday', () => {
		expect(getGroupLabel('2026-10-26', TODAY, t)).toBe('Сьогодні · 26 жовтня')
		expect(getGroupLabel('2026-10-25', TODAY, t)).toBe('Вчора · 25 жовтня')
		expect(getGroupLabel('2026-10-23', TODAY, t)).toBe("П'ятниця · 23 жовтня")
	})
})
