import type { LiveExerciseInput, LivePlanExercise, LiveWorkoutResponse } from '@kus/shared'

import { makeWorkout } from './workout.fixture'

export const LIVE_WORKOUT_ID = '0199b3a4-0000-7000-8000-0000000000f1'
export const LIVE_EDITED_AT = '2026-11-02T10:00:00.000Z'
export const LIVE_STARTED_AT = '2026-11-02T09:00:00.000Z'

/** Tests only: a template exercise of a live plan (3 × 8–10 · 50 кг). */
export const makePlanExercise = (overrides: Partial<LivePlanExercise> = {}): LivePlanExercise => ({
	templateExerciseId: '0199b3a4-0000-7000-8000-0000000000b1',
	exerciseId: null,
	name: 'Жим лежачи',
	kind: 'STRENGTH',
	muscleGroup: 'CHEST',
	isBodyweight: null,
	sets: 3,
	repsMin: 8,
	repsMax: 10,
	weightKg: 50,
	progressStepKg: 2.5,
	restSec: 90,
	durationMin: null,
	distanceM: null,
	lastSets: null,
	progressHintKg: null,
	...overrides,
})

/** Tests only: an open live session without a plan and without exercises. */
export const makeLiveResponse = (
	overrides: Partial<LiveWorkoutResponse> = {},
): LiveWorkoutResponse => ({
	workout: makeWorkout({
		id: LIVE_WORKOUT_ID,
		source: 'LIVE',
		startedAt: LIVE_STARTED_AT,
		durationMin: null,
		exercises: [],
	}),
	editedAt: LIVE_EDITED_AT,
	templateName: null,
	plan: [],
	...overrides,
})

/** Tests only: a live exercise as the PUT sends it. */
export const makeLiveInput = (overrides: Partial<LiveExerciseInput> = {}): LiveExerciseInput => ({
	clientKey: '0199b3a4-0000-7000-8000-0000000000c1',
	exerciseId: null,
	templateExerciseId: null,
	name: 'Жим лежачи',
	kind: 'STRENGTH',
	muscleGroup: 'CHEST',
	isBodyweight: null,
	durationMin: null,
	distanceM: null,
	sets: [
		{
			reps: 8,
			weightKg: 50,
			durationSec: null,
			distanceM: null,
			isWarmup: false,
			doneAt: null,
		},
	],
	...overrides,
})
