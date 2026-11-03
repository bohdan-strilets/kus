import type { WorkoutSetResponse } from '@kus/shared'
import { describe, expect, it } from 'vitest'

import { i18n } from '@/shared/i18n'
import { makeExercise, makeWorkout } from '@/shared/testing'

import { getSessionSummary } from './get-session-summary'

const t = i18n.t.bind(i18n)

const sets = (count: number, overrides: Partial<WorkoutSetResponse> = {}): WorkoutSetResponse[] =>
	Array.from({ length: count }, () => ({
		reps: 10,
		weightKg: 50,
		durationSec: null,
		distanceM: null,
		isWarmup: false,
		doneAt: null,
		...overrides,
	}))

const cardio = (id: string, name: string, durationMin: number | null) =>
	makeExercise({ id, name, kind: 'CARDIO', muscleGroup: null, sets: [], durationMin })

describe('getSessionSummary', () => {
	it('counts strength exercises and working sets, cardio apart, groups in the fixed order', () => {
		const workout = makeWorkout({
			exercises: [
				cardio('c1', 'Доріжка', 15),
				makeExercise({
					id: 'e1',
					muscleGroup: 'CHEST',
					sets: [...sets(1, { isWarmup: true, doneAt: null, weightKg: 40 }), ...sets(3)],
				}),
				makeExercise({ id: 'e2', name: 'Присід', muscleGroup: 'LEGS', sets: sets(3) }),
				makeExercise({ id: 'e3', name: 'Підтягування', muscleGroup: 'BACK', sets: sets(2) }),
				cardio('c2', 'Вело', 10),
			],
		})

		const view = getSessionSummary(workout, t)

		expect(view.counts).toBe('3 вправи · 8 підходів · кардіо 25 хв')
		expect(view.groups).toEqual([
			{ group: 'CARDIO', detail: '25 хв' },
			{ group: 'CHEST', detail: '3' },
			{ group: 'BACK', detail: '2' },
			{ group: 'LEGS', detail: '3' },
		])
	})

	it('cardio alone: no strength counts; cardio without minutes is just «кардіо»', () => {
		const timed = getSessionSummary(makeWorkout({ exercises: [cardio('c1', 'Вело', 20)] }), t)
		expect(timed.counts).toBe('кардіо 20 хв')

		const bare = getSessionSummary(makeWorkout({ exercises: [cardio('c1', 'Вело', null)] }), t)
		expect(bare.counts).toBe('кардіо')
		expect(bare.groups).toEqual([{ group: 'CARDIO', detail: undefined }])
	})

	it('a strength exercise without a group counts but has no plate', () => {
		const view = getSessionSummary(
			makeWorkout({ exercises: [makeExercise({ muscleGroup: null, sets: sets(2) })] }),
			t,
		)

		expect(view.counts).toBe('1 вправа · 2 підходи')
		expect(view.groups).toEqual([])
	})

	it('names a record with its value; a distance record shows the distance', () => {
		const view = getSessionSummary(
			makeWorkout({
				exercises: [
					makeExercise({
						name: 'Жим лежачи',
						record: 'WEIGHT',
						sets: [
							{
								reps: 8,
								weightKg: 60,
								durationSec: null,
								distanceM: null,
								isWarmup: false,
								doneAt: null,
							},
							{
								reps: 5,
								weightKg: 70,
								durationSec: null,
								distanceM: null,
								isWarmup: false,
								doneAt: null,
							},
						],
					}),
					makeExercise({
						id: 'c1',
						name: 'Біг',
						kind: 'CARDIO',
						sets: [],
						durationMin: 30,
						distanceM: 5000,
						record: 'DISTANCE',
					}),
				],
			}),
			t,
		)

		expect(view.records).toEqual(['Рекорд: жим лежачи 70×5', 'Рекорд: біг 5,0 км'])
	})

	it('no records without a record', () => {
		expect(getSessionSummary(makeWorkout(), t).records).toEqual([])
	})
})

describe('getSessionSummary: live sessions', () => {
	const DONE_AT = '2026-11-02T10:00:00.000Z'

	it('counters, group chips and records come from the same done-only selection', () => {
		const workout = makeWorkout({
			exercises: [
				makeExercise({
					id: 'e1',
					clientKey: 'k1',
					muscleGroup: 'CHEST',
					record: 'WEIGHT',
					sets: [...sets(2, { doneAt: DONE_AT }), ...sets(1)],
				}),
				makeExercise({
					id: 'e2',
					name: 'Присід',
					clientKey: 'k2',
					muscleGroup: 'LEGS',
					record: 'WEIGHT',
					sets: sets(3),
				}),
				makeExercise({
					id: 'c1',
					name: 'Вело',
					kind: 'CARDIO',
					muscleGroup: null,
					sets: [],
					clientKey: 'k3',
					durationMin: null,
				}),
			],
		})

		const view = getSessionSummary(workout, t)

		expect(view.counts).toBe('1 вправа · 2 підходи')
		expect(view.groups).toEqual([{ group: 'CHEST', detail: '2' }])
		expect(view.records).toEqual(['Рекорд: жим лежачи 50×10'])
	})

	it('chat exercises with doneAt null count entirely', () => {
		const view = getSessionSummary(
			makeWorkout({ exercises: [makeExercise({ clientKey: null, sets: sets(3) })] }),
			t,
		)

		expect(view.counts).toBe('1 вправа · 3 підходи')
	})
})
