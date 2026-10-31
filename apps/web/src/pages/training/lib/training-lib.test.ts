import { describe, expect, it } from 'vitest'

import { i18n } from '@/shared/i18n'
import { makeExercise, makeWorkout } from '@/shared/testing'

import { getJournalRow, getRecordCount, getWorkoutGroups } from './get-journal-row'
import { getTrainingRange } from './get-training-range'
import { getWeekSummary } from './get-week-summary'
import { groupWorkoutsByDay, groupWorkoutsByMonth } from './group-workouts'

const t = i18n.t.bind(i18n)
// Monday
const TODAY = '2026-10-26'

const cardio = makeExercise({ id: 'c', kind: 'CARDIO', muscleGroup: null, sets: [] })
const exerciseOf = (group: 'CHEST' | 'BACK' | 'LEGS' | 'SHOULDERS' | 'ARMS' | 'CORE') =>
	makeExercise({ id: group, muscleGroup: group })

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

describe('groupWorkoutsByMonth', () => {
	it('puts the newest month first with its days newest first', () => {
		const months = groupWorkoutsByMonth([
			makeWorkout({ id: 'a', localDate: '2026-09-30' }),
			makeWorkout({ id: 'b', localDate: '2026-10-02' }),
			makeWorkout({ id: 'c', localDate: '2026-10-26' }),
		])

		expect(months.map((month) => month.monthKey)).toEqual(['2026-10', '2026-09'])
		expect(months[0]?.days.map((day) => day.localDate)).toEqual(['2026-10-26', '2026-10-02'])
	})

	it('is empty for no workouts', () => {
		expect(groupWorkoutsByMonth([])).toEqual([])
	})
})

describe('getWeekSummary', () => {
	it('marks the days of this week Monday to Sunday and counts the trainings', () => {
		const summary = getWeekSummary(
			[
				makeWorkout({ localDate: '2026-10-26', durationMin: 55 }),
				makeWorkout({ localDate: '2026-10-25', durationMin: 40 }),
			],
			TODAY,
		)

		expect(summary.days.map((day) => day.localDate)).toEqual([
			'2026-10-26',
			'2026-10-27',
			'2026-10-28',
			'2026-10-29',
			'2026-10-30',
			'2026-10-31',
			'2026-11-01',
		])
		expect(summary.days.map((day) => day.hasTraining)).toEqual([
			true,
			false,
			false,
			false,
			false,
			false,
			false,
		])
		expect(summary.count).toBe(1)
	})

	it('sums the named minutes, otherwise the estimate, and nothing when neither is there', () => {
		const summary = getWeekSummary(
			[
				makeWorkout({ localDate: '2026-10-26', durationMin: 55 }),
				makeWorkout({ localDate: '2026-10-26', durationMin: null, estimatedDurationMin: 20 }),
				makeWorkout({ localDate: '2026-10-26', durationMin: null, estimatedDurationMin: null }),
			],
			TODAY,
		)

		expect(summary).toMatchObject({ count: 3, minutes: 75 })
	})

	it('starts the week on Monday when today is Sunday', () => {
		const summary = getWeekSummary(
			[makeWorkout({ localDate: '2026-10-26' }), makeWorkout({ localDate: '2026-10-25' })],
			'2026-11-01',
		)

		expect(summary.count).toBe(1)
		expect(summary.days[0]?.localDate).toBe('2026-10-26')
	})
})

describe('getWorkoutGroups', () => {
	it('lists the groups in the fixed order, cardio by its kind, without repeats', () => {
		const workout = makeWorkout({
			exercises: [exerciseOf('LEGS'), exerciseOf('CHEST'), cardio, exerciseOf('CHEST')],
		})

		expect(getWorkoutGroups(workout)).toEqual(['CARDIO', 'CHEST', 'LEGS'])
	})

	it('leaves out a strength exercise without a group', () => {
		const workout = makeWorkout({ exercises: [makeExercise({ muscleGroup: null })] })

		expect(getWorkoutGroups(workout)).toEqual([])
	})
})

describe('getRecordCount', () => {
	it('counts the exercises with a record', () => {
		const workout = makeWorkout({
			exercises: [
				makeExercise({ record: 'WEIGHT' }),
				makeExercise(),
				makeExercise({ record: 'REPS' }),
			],
		})

		expect(getRecordCount(workout)).toBe(2)
	})
})

describe('getJournalRow', () => {
	const many = [
		cardio,
		exerciseOf('CHEST'),
		exerciseOf('BACK'),
		exerciseOf('LEGS'),
		exerciseOf('ARMS'),
	]

	it('shows up to three groups and the rest as a number', () => {
		const row = getJournalRow(makeWorkout({ localDate: '2026-10-23', exercises: many }), t)

		expect(row.groups).toEqual(['CARDIO', 'CHEST', 'BACK'])
		expect(row.hiddenGroupCount).toBe(2)
		expect(row.recordCount).toBe(0)
		expect(row.weekday).toBe('Пт')
		expect(row.day).toBe('23')
		expect(row.title).toBe('Зал · 55 хв')
		expect(row.href).toBe(`/app/training/${row.id}`)
	})

	it('shows two groups when there is a record, and counts the records', () => {
		const row = getJournalRow(
			makeWorkout({ exercises: [...many, makeExercise({ record: 'WEIGHT' })] }),
			t,
		)

		expect(row.groups).toEqual(['CARDIO', 'CHEST'])
		expect(row.hiddenGroupCount).toBe(3)
		expect(row.recordCount).toBe(1)
	})

	it('marks an estimated duration and leaves the place alone without a duration', () => {
		const estimated = getJournalRow(makeWorkout({ durationMin: null, estimatedDurationMin: 62 }), t)
		const unknown = getJournalRow(makeWorkout({ durationMin: null, estimatedDurationMin: null }), t)

		expect(estimated.title).toBe('Зал · ≈ 62 хв')
		expect(estimated.ariaLabel).toContain('приблизно 62 хв')
		expect(unknown.title).toBe('Зал')
	})

	it('reads as one sentence for a screen reader', () => {
		const row = getJournalRow(
			makeWorkout({
				localDate: '2026-10-23',
				exercises: [
					exerciseOf('CHEST'),
					makeExercise({ id: 'r', muscleGroup: 'BACK', record: 'REPS' }),
				],
			}),
			t,
		)

		expect(row.ariaLabel).toBe("П'ятниця, 23 жовтня. Зал · 55 хв. Груди, Спина. 1 рекорд")
	})
})
