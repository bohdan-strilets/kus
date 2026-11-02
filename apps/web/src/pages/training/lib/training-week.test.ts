import type { ProgramResponse } from '@kus/shared'
import { describe, expect, it } from 'vitest'

import { i18n } from '@/shared/i18n'
import { makeExercise, makeProgram, makeWorkout } from '@/shared/testing'

import { getProgramWeekdays } from './get-program-weekdays'
import { getTrainingWeekDays } from './get-training-week-days'
import { getWeekSubtitle } from './get-week-subtitle'
import { getWeekMonday, getWeekSummary } from './get-week-summary'

const t = i18n.t.bind(i18n)

// the week 26.10 – 01.11: Monday, Wednesday, Sunday
const MONDAY = '2026-10-26'
const WEDNESDAY = '2026-10-28'
const SUNDAY = '2026-11-01'

describe('getWeekMonday', () => {
	it('is the same day for a Monday', () => {
		expect(getWeekMonday(MONDAY)).toBe(MONDAY)
	})

	it('goes back to Monday from the middle of the week', () => {
		expect(getWeekMonday(WEDNESDAY)).toBe(MONDAY)
	})

	it('goes back six days from a Sunday, not forward', () => {
		expect(getWeekMonday(SUNDAY)).toBe(MONDAY)
	})

	it('crosses a month boundary', () => {
		expect(getWeekMonday('2026-11-03')).toBe('2026-11-02')
		expect(getWeekMonday('2026-10-01')).toBe('2026-09-28')
	})
})

describe('getWeekSummary for an arbitrary date', () => {
	it('takes the week of a mid-week date and leaves the neighbours out', () => {
		const summary = getWeekSummary(
			[
				makeWorkout({ localDate: '2026-10-25', durationMin: 10 }),
				makeWorkout({ localDate: MONDAY, durationMin: 20 }),
				makeWorkout({ localDate: SUNDAY, durationMin: 30 }),
				makeWorkout({ localDate: '2026-11-02', durationMin: 40 }),
			],
			WEDNESDAY,
		)

		expect(summary.weekStart).toBe(MONDAY)
		expect(summary.weekEnd).toBe(SUNDAY)
		expect(summary.count).toBe(2)
		expect(summary.minutes).toBe(50)
		expect(summary.days.map((day) => day.isoWeekday)).toEqual([1, 2, 3, 4, 5, 6, 7])
		expect(summary.days[6]?.hasTraining).toBe(true)
	})

	it('keeps several trainings of one day together', () => {
		const summary = getWeekSummary(
			[
				makeWorkout({ id: 'a', localDate: WEDNESDAY }),
				makeWorkout({ id: 'b', localDate: WEDNESDAY }),
			],
			SUNDAY,
		)

		expect(summary.days[2]?.workouts.map((workout) => workout.id)).toEqual(['a', 'b'])
	})

	it('is empty for no workouts', () => {
		expect(getWeekSummary([], WEDNESDAY)).toMatchObject({ count: 0, minutes: 0 })
	})
})

describe('getProgramWeekdays', () => {
	const makeTemplate = (id: string, weekdays: number[]): ProgramResponse['templates'][number] => ({
		id,
		key: id,
		name: id,
		position: 0,
		weekdays,
		estimatedMin: 55,
		muscleGroups: ['CHEST'],
		hasCardio: false,
		exercises: [],
	})
	const makeProgramOf = (mode: ProgramResponse['mode']): ProgramResponse =>
		makeProgram({ mode, templates: [makeTemplate('a', [1, 3]), makeTemplate('b', [5])] })

	it('collects the days of every template in the mode «За днями тижня»', () => {
		expect([...getProgramWeekdays(makeProgramOf('WEEKDAYS'))].sort()).toEqual([1, 3, 5])
	})

	it('ignores the weekdays in other modes', () => {
		expect(getProgramWeekdays(makeProgramOf('ROTATE')).size).toBe(0)
	})

	it('is empty without a program', () => {
		expect(getProgramWeekdays(null).size).toBe(0)
		expect(getProgramWeekdays(undefined).size).toBe(0)
	})
})

describe('getTrainingWeekDays', () => {
	const chest = makeExercise({ id: 'e1', muscleGroup: 'CHEST' })
	const legs = makeExercise({ id: 'e2', muscleGroup: 'LEGS' })
	const cardio = makeExercise({ id: 'e3', kind: 'CARDIO', muscleGroup: null, sets: [] })
	const noGroup = makeExercise({ id: 'e4', muscleGroup: null })

	const build = (
		workouts: Parameters<typeof getWeekSummary>[0],
		{ weekdays = [] as number[] } = {},
	) =>
		getTrainingWeekDays({
			summary: getWeekSummary(workouts, WEDNESDAY),
			today: WEDNESDAY,
			programWeekdays: new Set(weekdays),
			t,
		})

	it('gives seven days Monday to Sunday', () => {
		const days = build([])

		expect(days).toHaveLength(7)
		expect(days[0]?.localDate).toBe(MONDAY)
		expect(days[6]?.localDate).toBe(SUNDAY)
	})

	it('marks today as current and selected, later days as upcoming, earlier ones not', () => {
		const days = build([])

		expect(days.map((day) => day.isToday)).toEqual([false, false, true, false, false, false, false])
		expect(days.map((day) => day.isSelected)).toEqual(days.map((day) => day.isToday))
		expect(days.map((day) => day.isUpcoming)).toEqual([false, false, false, true, true, true, true])
	})

	it('disables a day without a training and enables one with it', () => {
		const days = build([makeWorkout({ localDate: MONDAY })])

		expect(days[0]?.isDisabled).toBe(false)
		expect(days[1]?.isDisabled).toBe(true)
	})

	it('names the groups of a trained day in the fixed order, lower case', () => {
		const days = build([makeWorkout({ localDate: MONDAY, exercises: [legs, cardio, chest] })])

		expect(days[0]?.groups).toEqual(['CARDIO', 'CHEST', 'LEGS'])
		expect(days[0]?.ariaLabel).toMatch(/: тренування — кардіо, груди, ноги$/)
	})

	it('names a trained day without groups by its place', () => {
		const days = build([makeWorkout({ localDate: MONDAY, place: 'HOME', exercises: [noGroup] })])

		expect(days[0]?.groups).toEqual([])
		expect(days[0]?.ariaLabel).toMatch(/: тренування — вдома$/)
	})

	it('merges the groups of two trainings of one day once', () => {
		const days = build([
			makeWorkout({ id: 'a', localDate: MONDAY, exercises: [chest] }),
			makeWorkout({ id: 'b', localDate: MONDAY, exercises: [chest, legs] }),
		])

		expect(days[0]?.groups).toEqual(['CHEST', 'LEGS'])
		expect(days[0]?.workouts).toHaveLength(2)
	})

	it('plans a program day that is today or later and has no training', () => {
		// Mon(1) is past, Wed(3) is today, Fri(5) is ahead
		const days = build([], { weekdays: [1, 3, 5] })

		expect(days.map((day) => day.isPlanned)).toEqual([
			false,
			false,
			true,
			false,
			true,
			false,
			false,
		])
		expect(days[2]?.ariaLabel).toMatch(/: день за програмою$/)
		expect(days[1]?.ariaLabel).toMatch(/: тренувань не було$/)
	})

	it('does not plan a program day that already has a training', () => {
		const days = build([makeWorkout({ localDate: WEDNESDAY })], { weekdays: [3] })

		expect(days[2]?.isPlanned).toBe(false)
		expect(days[2]?.ariaLabel).toMatch(/: тренування — /)
	})

	it('does not plan a missed program day in the past', () => {
		expect(build([], { weekdays: [1] })[0]?.isPlanned).toBe(false)
	})
})

describe('getWeekSubtitle', () => {
	it('says an empty week plainly', () => {
		expect(getWeekSubtitle({ count: 0, minutes: 0 }, t)).toBe('ще без тренувань')
	})

	it('joins the count and the time', () => {
		expect(getWeekSubtitle({ count: 4, minutes: 204 }, t)).toBe('4 тренування · 3 год 24 хв')
	})

	it('declines the count', () => {
		expect(getWeekSubtitle({ count: 1, minutes: 55 }, t)).toBe('1 тренування · 55 хв')
		expect(getWeekSubtitle({ count: 5, minutes: 55 }, t)).toBe('5 тренувань · 55 хв')
	})

	it('leaves out the time when no minutes are known', () => {
		expect(getWeekSubtitle({ count: 2, minutes: 0 }, t)).toBe('2 тренування')
	})
})
