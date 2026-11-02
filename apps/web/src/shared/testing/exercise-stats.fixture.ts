import type { ExerciseStatsResponse } from '@kus/shared'

import { BENCH_ID, PULLUP_ID } from './workout-stats.fixture'

const WORKOUT_A = '0199b3a4-0000-7000-8000-0000000000c1'
const WORKOUT_B = '0199b3a4-0000-7000-8000-0000000000c2'

const BASE = { period: 'month', from: '2026-10-01', to: '2026-10-31' } as const

/** Tests only: a bench press over October with two workouts and a warm-up in the newest. */
export const makeWeightedStats = (
	overrides: Partial<ExerciseStatsResponse> = {},
): ExerciseStatsResponse => ({
	...BASE,
	exercise: {
		id: BENCH_ID,
		name: 'Жим лежачи',
		kind: 'STRENGTH',
		muscleGroup: 'CHEST',
		isBodyweight: false,
	},
	best: {
		topSet: { weightKg: 70, reps: 5, localDate: '2026-10-26' },
		maxReps: { weightKg: 70, reps: 6, localDate: '2026-10-21' },
		maxSessionReps: null,
	},
	change: 10,
	changeReps: -3,
	points: [
		{ localDate: '2026-10-05', workoutId: WORKOUT_A, topWeightKg: 60, maxReps: 8 },
		{ localDate: '2026-10-26', workoutId: WORKOUT_B, topWeightKg: 70, maxReps: 5 },
	],
	history: [
		{
			workoutId: WORKOUT_B,
			localDate: '2026-10-26',
			record: null,
			sets: [
				{
					reps: 10,
					weightKg: 40,
					durationSec: null,
					distanceM: null,
					isWarmup: true,
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
		},
		{
			workoutId: WORKOUT_A,
			localDate: '2026-10-05',
			record: null,
			sets: [
				{
					reps: 8,
					weightKg: 60,
					durationSec: null,
					distanceM: null,
					isWarmup: false,
					doneAt: null,
				},
			],
		},
	],
	...overrides,
})

/** Tests only: pull-ups, reps only. */
export const makeBodyweightStats = (): ExerciseStatsResponse => ({
	...BASE,
	exercise: {
		id: PULLUP_ID,
		name: 'Підтягування',
		kind: 'STRENGTH',
		muscleGroup: 'BACK',
		isBodyweight: true,
	},
	best: {
		topSet: { weightKg: null, reps: 9, localDate: '2026-10-21' },
		maxReps: { weightKg: null, reps: 9, localDate: '2026-10-21' },
		maxSessionReps: { reps: 21, localDate: '2026-10-26' },
	},
	change: 1,
	changeReps: 1,
	points: [
		{ localDate: '2026-10-05', workoutId: WORKOUT_A, topWeightKg: null, maxReps: 8 },
		{ localDate: '2026-10-26', workoutId: WORKOUT_B, topWeightKg: null, maxReps: 9 },
	],
	history: [
		{
			workoutId: WORKOUT_B,
			localDate: '2026-10-26',
			record: null,
			sets: [
				{
					reps: 8,
					weightKg: null,
					durationSec: null,
					distanceM: null,
					isWarmup: false,
					doneAt: null,
				},
				{
					reps: 7,
					weightKg: null,
					durationSec: null,
					distanceM: null,
					isWarmup: false,
					doneAt: null,
				},
			],
		},
	],
})
