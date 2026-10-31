import type { WorkoutExerciseResponse, WorkoutResponse } from '@kus/shared'

const EXERCISE_ID = '0199b3a4-0000-7000-8000-0000000000e1'

/** Tests only: «Жим лежачи · 80 кг · 3×8». */
export const makeExercise = (
	overrides: Partial<WorkoutExerciseResponse> = {},
): WorkoutExerciseResponse => ({
	id: EXERCISE_ID,
	name: 'Жим лежачи',
	kind: 'STRENGTH',
	durationMin: null,
	distanceM: null,
	muscleGroup: 'CHEST',
	performedAt: '2026-10-26T17:30:00.000Z',
	sets: [1, 2, 3].map(() => ({
		reps: 8,
		weightKg: 80,
		durationSec: null,
		distanceM: null,
		isWarmup: false,
	})),
	record: null,
	...overrides,
})

/** Tests only: the mockup's «Зал · 18:30», 55 хв, with one strength exercise. */
export const makeWorkout = (overrides: Partial<WorkoutResponse> = {}): WorkoutResponse => ({
	id: '0199b3a4-0000-7000-8000-0000000000f1',
	localDate: '2026-10-26',
	startedAt: '2026-10-26T17:30:00.000Z',
	durationMin: 55,
	place: 'GYM',
	kcalBurned: null,
	kcalSource: null,
	isEdited: false,
	isDeleted: false,
	finishedAt: null,
	estimatedDurationMin: null,
	exercises: [makeExercise()],
	...overrides,
})
