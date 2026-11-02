import { describe, expect, it } from 'vitest'

import { programExerciseResponseSchema } from './programs-api.js'
import { workoutStatsOverviewSchema } from './workout-stats.js'
import { workoutResponseSchema } from './workouts.js'

const UUID = '00000000-0000-4000-8000-000000000001'

const oldWorkout = (): Record<string, unknown> => ({
	id: UUID,
	localDate: '2026-10-30',
	startedAt: null,
	durationMin: 45,
	place: null,
	kcalBurned: null,
	kcalSource: null,
	exercises: [
		{
			id: UUID,
			name: 'Присідання',
			kind: 'STRENGTH',
			muscleGroup: null,
			durationMin: null,
			distanceM: null,
			sets: [{ reps: 5, weightKg: 100, durationSec: null, distanceM: null, isWarmup: false }],
		},
	],
})

describe('workoutResponseSchema compatibility', () => {
	it('parses a response of the old API and fills the defaults', () => {
		const parsed = workoutResponseSchema.parse(oldWorkout())
		expect(parsed.source).toBe('CHAT')
		expect(parsed.kcal).toBeNull()
		const exercise = parsed.exercises[0]
		expect(exercise?.clientKey).toBeNull()
		expect(exercise?.templateExerciseId).toBeNull()
		expect(exercise?.isBodyweight).toBeNull()
		expect(exercise?.sets[0]?.doneAt).toBeNull()
	})

	it('keeps known source and kcal', () => {
		const parsed = workoutResponseSchema.parse({
			...oldWorkout(),
			source: 'LIVE',
			kcal: { value: 300, source: 'ESTIMATE' },
		})
		expect(parsed.source).toBe('LIVE')
		expect(parsed.kcal).toEqual({ value: 300, source: 'ESTIMATE' })
	})

	it('reads an unknown kcal source as null', () => {
		const parsed = workoutResponseSchema.parse({
			...oldWorkout(),
			kcal: { value: 300, source: 'WATCH' },
		})
		expect(parsed.kcal).toBeNull()
	})

	it('reads an unknown workout source as CHAT', () => {
		expect(workoutResponseSchema.parse({ ...oldWorkout(), source: 'IMPORT' }).source).toBe('CHAT')
	})
})

describe('workoutStatsOverviewSchema compatibility', () => {
	it('defaults burned to null when the old API omits it', () => {
		const { burned } = workoutStatsOverviewSchema.shape
		expect(burned.parse(undefined)).toBeNull()
		expect(burned.parse({ kcal: 250, isEstimate: true })).toEqual({ kcal: 250, isEstimate: true })
	})
})

describe('programExerciseResponseSchema compatibility', () => {
	it('defaults isBodyweight and progressHintKg to null', () => {
		const parsed = programExerciseResponseSchema.parse({
			id: UUID,
			exerciseId: null,
			name: 'Тяга',
			kind: 'STRENGTH',
			muscleGroup: null,
			position: 0,
			target: {
				sets: null,
				repsMin: null,
				repsMax: null,
				weightKg: null,
				progressStepKg: null,
				restSec: null,
				durationMin: null,
				distanceM: null,
			},
			lastSets: null,
			lastPerformedAt: null,
		})
		expect(parsed.isBodyweight).toBeNull()
		expect(parsed.progressHintKg).toBeNull()
	})
})
