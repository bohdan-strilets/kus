import { describe, expect, it } from 'vitest'

import { i18n } from '@/shared/i18n'
import { makeExercise, makeWorkout } from '@/shared/testing'

import {
	getSessionGroups,
	getTrainingStripView,
	sortWorkoutsByTime,
} from './get-training-strip-view'

const t = i18n.t.bind(i18n)

const cardio = makeExercise({ kind: 'CARDIO', muscleGroup: null, name: 'Біг' })
const legs = makeExercise({ muscleGroup: 'LEGS', name: 'Присідання' })
const chest = makeExercise({ muscleGroup: 'CHEST' })
const unknown = makeExercise({ muscleGroup: null, name: 'Щось своє' })

describe('getSessionGroups', () => {
	it('lists the groups once, in the fixed order, cardio by kind', () => {
		const workout = makeWorkout({ exercises: [legs, chest, cardio, chest] })

		expect(getSessionGroups(workout)).toEqual(['CARDIO', 'CHEST', 'LEGS'])
	})

	it('skips a strength exercise without a group', () => {
		expect(getSessionGroups(makeWorkout({ exercises: [unknown] }))).toEqual([])
	})
})

describe('sortWorkoutsByTime', () => {
	it('orders by the start and puts a session without one last', () => {
		const late = makeWorkout({ id: 'late', startedAt: '2026-10-26T18:30:00.000Z' })
		const early = makeWorkout({ id: 'early', startedAt: '2026-10-26T07:10:00.000Z' })
		const untimed = makeWorkout({ id: 'untimed', startedAt: null })

		expect(sortWorkoutsByTime([untimed, late, early]).map(({ id }) => id)).toEqual([
			'early',
			'late',
			'untimed',
		])
	})
})

describe('getTrainingStripView', () => {
	it('links to the session and says duration and groups in the label', () => {
		const view = getTrainingStripView(
			makeWorkout({ id: 'w1', durationMin: 62, exercises: [cardio, chest] }),
			t,
			false,
		)

		expect(view.href).toBe('/app/training/w1')
		expect(view.time).toBeNull()
		expect(view.ariaLabel).toBe('Тренування, 62 хв: кардіо, груди — відкрити')
	})

	it('says an estimate as approximate and leaves out what it does not know', () => {
		const view = getTrainingStripView(
			makeWorkout({ durationMin: null, estimatedDurationMin: 62, exercises: [unknown] }),
			t,
			false,
		)

		expect(view.duration).toBe('≈ 62 хв')
		expect(view.ariaLabel).toBe('Тренування, приблизно 62 хв — відкрити')
	})

	it('adds the start time only next to other trainings', () => {
		const workout = makeWorkout({ startedAt: '2026-10-26T07:10:00.000Z', exercises: [cardio] })

		expect(getTrainingStripView(workout, t, false).time).toBeNull()
		expect(getTrainingStripView(workout, t, true).time).toMatch(/^\d{2}:\d{2}$/)
	})
})
