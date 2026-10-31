import { describe, expect, it } from 'vitest'

import { getEstimatedDurationMin, getMuscleGroup, toWorkoutResponse } from './workouts.mapper'
import type { WorkoutWithExercises } from './workouts.repository'

const at = (time: string): Date => new Date(`2026-10-27T${time}:00Z`)

type ExerciseRow = WorkoutWithExercises['exercises'][number]

const makeEntry = (overrides: Partial<ExerciseRow> = {}): ExerciseRow => ({
	id: '0199b3a4-0000-7000-8000-0000000000e1',
	userId: '0199b3a4-0000-7000-8000-0000000000a1',
	workoutId: '0199b3a4-0000-7000-8000-0000000000f1',
	exerciseId: null,
	name: 'Жим лежачи',
	kind: 'STRENGTH',
	muscleGroup: null,
	position: 0,
	durationMin: null,
	distanceM: null,
	kcalBurned: null,
	source: 'MANUAL',
	performedAt: at('17:30'),
	localDate: new Date('2026-10-27T00:00:00Z'),
	sourceMessageId: null,
	createdAt: at('17:30'),
	updatedAt: at('17:30'),
	deletedAt: null,
	sets: [],
	exercise: null,
	...overrides,
})

const makeWorkout = (overrides: Partial<WorkoutWithExercises> = {}): WorkoutWithExercises => ({
	id: '0199b3a4-0000-7000-8000-0000000000f1',
	userId: '0199b3a4-0000-7000-8000-0000000000a1',
	localDate: new Date('2026-10-27T00:00:00Z'),
	startedAt: at('17:30'),
	durationMin: null,
	place: 'GYM',
	kcalBurned: null,
	kcalSource: null,
	note: null,
	records: null,
	editedAt: null,
	finishedAt: null,
	finishedMessageId: null,
	sourceMessageId: null,
	createdAt: at('17:30'),
	updatedAt: at('17:30'),
	deletedAt: null,
	exercises: [makeEntry()],
	...overrides,
})

describe('getMuscleGroup', () => {
	it('takes the dictionary row first, then the snapshot, then the dictionary of names', () => {
		expect(
			getMuscleGroup(makeEntry({ muscleGroup: 'ARMS', exercise: { muscleGroup: 'BACK' } })),
		).toBe('BACK')
		expect(
			getMuscleGroup(makeEntry({ muscleGroup: 'ARMS', exercise: { muscleGroup: null } })),
		).toBe('ARMS')
		expect(getMuscleGroup(makeEntry({ muscleGroup: null, exercise: null }))).toBe('CHEST')
		expect(getMuscleGroup(makeEntry({ name: 'Зарядка' }))).toBeNull()
	})

	it('has no group for cardio, whatever the rows say', () => {
		expect(
			getMuscleGroup(
				makeEntry({
					kind: 'CARDIO',
					name: 'Біг',
					muscleGroup: 'LEGS',
					exercise: { muscleGroup: 'LEGS' },
				}),
			),
		).toBeNull()
	})
})

describe('getEstimatedDurationMin', () => {
	const M1 = '0199b3a4-0000-7000-8000-0000000000d1'
	const M2 = '0199b3a4-0000-7000-8000-0000000000d2'
	const entry = (time: string, sourceMessageId: string | null) => ({
		performedAt: at(time),
		sourceMessageId,
	})
	const estimate = (overrides: Partial<Parameters<typeof getEstimatedDurationMin>[0]>) =>
		getEstimatedDurationMin({
			durationMin: null,
			finishedAt: null,
			finishedMessageId: null,
			entries: [],
			...overrides,
		})

	it('is null for one message, even with different times and its own finish', () => {
		expect(
			estimate({
				finishedAt: at('18:30'),
				finishedMessageId: M1,
				entries: [entry('17:30', M1), entry('17:50', M1)],
			}),
		).toBeNull()
	})

	it('counts the minutes from the first exercise to the finish of a later message', () => {
		expect(
			estimate({
				finishedAt: at('18:32'),
				finishedMessageId: M2,
				entries: [entry('17:30', M1)],
			}),
		).toBe(62)
	})

	it('takes the last exercise when the session is not finished', () => {
		expect(estimate({ entries: [entry('17:30', M1), entry('17:40', M2)] })).toBe(10)
	})

	it('is null for two messages less than 10 minutes apart', () => {
		expect(estimate({ entries: [entry('17:30', M1), entry('17:39', M2)] })).toBeNull()
	})

	it('is null when the duration was named', () => {
		expect(
			estimate({
				durationMin: 55,
				entries: [entry('17:30', M1), entry('18:30', M2)],
			}),
		).toBeNull()
	})

	it('is null for a past day logged in one message: noon and the finish are one moment', () => {
		expect(
			estimate({
				finishedAt: new Date('2026-10-27T15:00:00Z'),
				finishedMessageId: M1,
				entries: [entry('12:00', M1)],
			}),
		).toBeNull()
	})

	it('does not count entries without a message as messages', () => {
		expect(estimate({ entries: [entry('17:30', M1), entry('18:30', null)] })).toBeNull()
	})
})

describe('toWorkoutResponse', () => {
	it('adds the group, the times, the estimate and a REPS record', () => {
		const pullUps = makeEntry({
			id: '0199b3a4-0000-7000-8000-0000000000e2',
			name: 'Підтягування',
			performedAt: at('17:50'),
			sourceMessageId: '0199b3a4-0000-7000-8000-0000000000d2',
			exercise: { muscleGroup: 'BACK' },
		})
		const response = toWorkoutResponse(
			makeWorkout({
				finishedAt: at('18:32'),
				finishedMessageId: '0199b3a4-0000-7000-8000-0000000000d2',
				records: [{ exerciseEntryId: pullUps.id, type: 'REPS' }],
				exercises: [
					makeEntry({ sourceMessageId: '0199b3a4-0000-7000-8000-0000000000d1' }),
					pullUps,
				],
			}),
		)

		expect(response).toMatchObject({
			finishedAt: at('18:32').toISOString(),
			estimatedDurationMin: 62,
		})
		expect(response.exercises.map((exercise) => [exercise.muscleGroup, exercise.record])).toEqual([
			['CHEST', null],
			['BACK', 'REPS'],
		])
		expect(response.exercises[1]?.performedAt).toBe(at('17:50').toISOString())
	})
})
