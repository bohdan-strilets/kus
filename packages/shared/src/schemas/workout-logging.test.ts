import { describe, expect, it } from 'vitest'

import {
	MAX_EXERCISES_PER_WORKOUT,
	MAX_SET_REPS,
	MAX_SET_WEIGHT_KG,
	MAX_SETS_PER_EXERCISE,
	MAX_WORKOUT_MINUTES,
} from '../ai/workout-tools.js'
import {
	liveExerciseInputSchema,
	liveWorkoutFinishSchema,
	liveWorkoutUpdateSchema,
	workoutDiscardedSchema,
	workoutFinishedSchema,
	workoutFinishResponseSchema,
	workoutFormSchema,
} from './workout-logging.js'

const UUID = '00000000-0000-4000-8000-000000000001'

const exercise = (overrides: Record<string, unknown> = {}): Record<string, unknown> => ({
	name: 'Жим лежачи',
	kind: 'STRENGTH',
	sets: [{ reps: 10, weightKg: 60 }],
	...overrides,
})

const form = (overrides: Record<string, unknown> = {}): Record<string, unknown> => ({
	clientRequestId: UUID,
	templateId: null,
	localDate: '2026-11-02',
	startTime: '18:30',
	durationMin: 60,
	exercises: [exercise()],
	...overrides,
})

const isFormValid = (overrides: Record<string, unknown> = {}): boolean =>
	workoutFormSchema.safeParse(form(overrides)).success

describe('workoutFormSchema', () => {
	it('accepts a minimal payload and fills defaults', () => {
		const parsed = workoutFormSchema.parse(form())
		expect(parsed.exercises[0]).toMatchObject({
			exerciseId: null,
			templateExerciseId: null,
			muscleGroup: null,
			isBodyweight: null,
			durationMin: null,
			distanceM: null,
		})
		expect(parsed.exercises[0]?.sets[0]).toMatchObject({
			reps: 10,
			weightKg: 60,
			durationSec: null,
			distanceM: null,
			isWarmup: false,
		})
	})

	it('accepts an empty exercise list', () => {
		expect(isFormValid({ exercises: [] })).toBe(true)
	})

	it.each(['00:00', '09:05', '23:59'])('accepts startTime %s', (startTime) => {
		expect(isFormValid({ startTime })).toBe(true)
	})

	it.each(['24:00', '9:30', '12:60', '12:5', '1230', '12:30:00', ''])(
		'rejects startTime "%s"',
		(startTime) => {
			expect(isFormValid({ startTime })).toBe(false)
		},
	)

	it('checks durationMin bounds', () => {
		expect(isFormValid({ durationMin: 0 })).toBe(false)
		expect(isFormValid({ durationMin: 1 })).toBe(true)
		expect(isFormValid({ durationMin: MAX_WORKOUT_MINUTES })).toBe(true)
		expect(isFormValid({ durationMin: MAX_WORKOUT_MINUTES + 1 })).toBe(false)
		expect(isFormValid({ durationMin: 30.5 })).toBe(false)
	})

	it('rejects a bad localDate and clientRequestId', () => {
		expect(isFormValid({ localDate: '2026-13-01' })).toBe(false)
		expect(isFormValid({ clientRequestId: 'x' })).toBe(false)
	})

	it('limits the number of exercises', () => {
		const many = (n: number): unknown[] => Array.from({ length: n }, () => exercise())
		expect(isFormValid({ exercises: many(MAX_EXERCISES_PER_WORKOUT) })).toBe(true)
		expect(isFormValid({ exercises: many(MAX_EXERCISES_PER_WORKOUT + 1) })).toBe(false)
	})

	it('limits the number of sets', () => {
		const sets = (n: number): unknown[] => Array.from({ length: n }, () => ({ reps: 5 }))
		expect(isFormValid({ exercises: [exercise({ sets: sets(MAX_SETS_PER_EXERCISE) })] })).toBe(true)
		expect(isFormValid({ exercises: [exercise({ sets: sets(MAX_SETS_PER_EXERCISE + 1) })] })).toBe(
			false,
		)
	})

	describe('set limits', () => {
		const withSet = (set: Record<string, unknown>): boolean =>
			isFormValid({ exercises: [exercise({ sets: [set] })] })

		it('checks reps', () => {
			expect(withSet({ reps: 0 })).toBe(false)
			expect(withSet({ reps: 1 })).toBe(true)
			expect(withSet({ reps: MAX_SET_REPS })).toBe(true)
			expect(withSet({ reps: MAX_SET_REPS + 1 })).toBe(false)
			expect(withSet({ reps: -1 })).toBe(false)
		})

		it('checks weight', () => {
			expect(withSet({ weightKg: -0.5 })).toBe(false)
			expect(withSet({ weightKg: 0 })).toBe(true)
			expect(withSet({ weightKg: MAX_SET_WEIGHT_KG })).toBe(true)
			expect(withSet({ weightKg: MAX_SET_WEIGHT_KG + 0.5 })).toBe(false)
		})

		it('checks set duration', () => {
			expect(withSet({ durationSec: 0 })).toBe(false)
			expect(withSet({ durationSec: MAX_WORKOUT_MINUTES * 60 })).toBe(true)
			expect(withSet({ durationSec: MAX_WORKOUT_MINUTES * 60 + 1 })).toBe(false)
		})
	})

	describe('bodyweight', () => {
		it('rejects a weighted set of a bodyweight exercise', () => {
			const result = workoutFormSchema.safeParse(
				form({ exercises: [exercise({ isBodyweight: true })] }),
			)
			expect(result.success).toBe(false)
			expect(result.error?.issues[0]?.message).toBe('BODYWEIGHT_HAS_WEIGHT')
		})

		it('accepts a bodyweight exercise without weights', () => {
			const sets = [{ reps: 12 }, { reps: 10 }]
			expect(isFormValid({ exercises: [exercise({ isBodyweight: true, sets })] })).toBe(true)
		})

		it('accepts a weight when isBodyweight is false or unknown', () => {
			expect(isFormValid({ exercises: [exercise({ isBodyweight: false })] })).toBe(true)
			expect(isFormValid({ exercises: [exercise({ isBodyweight: null })] })).toBe(true)
		})
	})

	it('rejects an empty or too long exercise name', () => {
		expect(isFormValid({ exercises: [exercise({ name: '   ' })] })).toBe(false)
		expect(isFormValid({ exercises: [exercise({ name: 'a'.repeat(81) })] })).toBe(false)
	})
})

describe('liveExerciseInputSchema', () => {
	const live = (overrides: Record<string, unknown> = {}): Record<string, unknown> => ({
		clientKey: UUID,
		...exercise(),
		...overrides,
	})

	it('accepts a minimal payload with default doneAt', () => {
		const parsed = liveExerciseInputSchema.parse(live())
		expect(parsed.sets[0]?.doneAt).toBeNull()
	})

	it('requires clientKey', () => {
		expect(liveExerciseInputSchema.safeParse(live({ clientKey: undefined })).success).toBe(false)
	})

	it('rejects a weight with isBodyweight true', () => {
		expect(liveExerciseInputSchema.safeParse(live({ isBodyweight: true })).success).toBe(false)
	})

	it('validates doneAt as an ISO datetime', () => {
		const ok = live({ sets: [{ reps: 5, doneAt: '2026-11-02T10:00:00Z' }] })
		const bad = live({ sets: [{ reps: 5, doneAt: 'yesterday' }] })
		expect(liveExerciseInputSchema.safeParse(ok).success).toBe(true)
		expect(liveExerciseInputSchema.safeParse(bad).success).toBe(false)
	})
})

describe('liveWorkoutUpdateSchema', () => {
	it('requires knownEditedAt but allows null', () => {
		expect(liveWorkoutUpdateSchema.safeParse({ exercises: [] }).success).toBe(false)
		expect(liveWorkoutUpdateSchema.safeParse({ knownEditedAt: null, exercises: [] }).success).toBe(
			true,
		)
	})
})

describe('liveWorkoutFinishSchema', () => {
	const live = { clientKey: UUID, ...exercise() }

	it('accepts an empty body', () => {
		expect(liveWorkoutFinishSchema.safeParse({}).success).toBe(true)
		expect(liveWorkoutFinishSchema.parse(undefined)).toEqual({})
	})

	it('accepts the tap time, the edit stamp (also null) and the snapshot', () => {
		const body = {
			finishedAt: '2026-11-02T10:00:00Z',
			knownEditedAt: null,
			exercises: [live],
		}
		expect(liveWorkoutFinishSchema.safeParse(body).success).toBe(true)
	})

	it('requires knownEditedAt (null allowed) when exercises are sent', () => {
		const noStamp = liveWorkoutFinishSchema.safeParse({ exercises: [live] })
		expect(noStamp.success).toBe(false)
		expect(noStamp.error?.issues[0]?.path).toEqual(['knownEditedAt'])
		expect(
			liveWorkoutFinishSchema.safeParse({ exercises: [live], knownEditedAt: null }).success,
		).toBe(true)
		expect(liveWorkoutFinishSchema.safeParse({ finishedAt: '2026-11-02T10:00:00Z' }).success).toBe(
			true,
		)
		expect(liveWorkoutFinishSchema.safeParse({ knownEditedAt: null }).success).toBe(true)
	})

	it('rejects a bad datetime', () => {
		expect(liveWorkoutFinishSchema.safeParse({ finishedAt: 'now' }).success).toBe(false)
		expect(liveWorkoutFinishSchema.safeParse({ knownEditedAt: 'x' }).success).toBe(false)
	})

	it('reuses the exercise rules of the PUT', () => {
		const stamp = { knownEditedAt: null }
		expect(
			liveWorkoutFinishSchema.safeParse({ ...stamp, exercises: [{ name: 'x' }] }).success,
		).toBe(false)
		const tooMany = Array.from({ length: MAX_EXERCISES_PER_WORKOUT + 1 }, () => live)
		expect(liveWorkoutFinishSchema.safeParse({ ...stamp, exercises: tooMany }).success).toBe(false)
	})

	it('strips unknown keys like the PUT schema', () => {
		expect(liveWorkoutFinishSchema.parse({ extra: 1 })).toEqual({})
	})
})

describe('finish responses', () => {
	const workout = {
		id: UUID,
		localDate: '2026-11-02',
		startedAt: null,
		durationMin: 40,
		place: null,
		kcalBurned: null,
		kcalSource: null,
		exercises: [],
	}
	const oldShape = { workout, messageId: UUID, hasNewRecord: false }

	it('an old-shaped finish (no `discarded`) still parses as finished and as the union', () => {
		expect(workoutFinishedSchema.safeParse(oldShape).success).toBe(true)
		expect(workoutFinishResponseSchema.safeParse(oldShape).success).toBe(true)
	})

	it('a finish with `discarded: false` parses as finished', () => {
		expect(workoutFinishedSchema.safeParse({ ...oldShape, discarded: false }).success).toBe(true)
	})

	it('{ discarded: true } is the discarded shape and not the finished one', () => {
		expect(workoutDiscardedSchema.safeParse({ discarded: true }).success).toBe(true)
		expect(workoutFinishResponseSchema.safeParse({ discarded: true }).success).toBe(true)
		expect(workoutFinishedSchema.safeParse({ discarded: true }).success).toBe(false)
	})

	it('rejects the discarded shape with false', () => {
		expect(workoutDiscardedSchema.safeParse({ discarded: false }).success).toBe(false)
	})

	it('a finished-looking body with discarded: true reads as the discarded shape, not as finished', () => {
		expect(workoutFinishedSchema.safeParse({ ...oldShape, discarded: true }).success).toBe(false)
	})
})
