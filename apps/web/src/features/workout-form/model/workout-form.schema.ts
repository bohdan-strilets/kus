import {
	FORM_MAX_DAYS_BACK,
	MAX_EXERCISES_PER_WORKOUT,
	MAX_SET_REPS,
	MAX_SET_WEIGHT_KG,
	MAX_SETS_PER_EXERCISE,
	MAX_WORKOUT_MINUTES,
	PROGRAM_DISTANCE_M_MAX,
	PROGRAM_NAME_MAX_LENGTH,
	exerciseKindSchema,
	muscleGroupSchema,
} from '@kus/shared'
import type { TFunction } from 'i18next'
import { z } from 'zod'

import { shiftLocalDate } from '@/shared/lib'

import type { FormNow } from '../lib/workout-form.types'

const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/
const MIN_IN_HOUR = 60
/** Same tolerance as the server: a clock a little ahead is not «in the future». */
export const FORM_FUTURE_TOLERANCE_MIN = 5
const MAX_SET_DURATION_SEC = MAX_WORKOUT_MINUTES * 60

const toMinutes = (time: string): number => {
	const [hours = 0, minutes = 0] = time.split(':').map(Number)
	return hours * MIN_IN_HOUR + minutes
}

const createRangeMessage = (t: TFunction, min: number, max: number): string =>
	t('training.form.validation.range', { min, max })

const createSetSchema = (t: TFunction) =>
	z.object({
		reps: z
			.number()
			.int()
			.min(1, createRangeMessage(t, 1, MAX_SET_REPS))
			.max(MAX_SET_REPS, createRangeMessage(t, 1, MAX_SET_REPS))
			.nullable(),
		weightKg: z
			.number()
			.min(0, createRangeMessage(t, 0, MAX_SET_WEIGHT_KG))
			.max(MAX_SET_WEIGHT_KG, createRangeMessage(t, 0, MAX_SET_WEIGHT_KG))
			.nullable(),
		durationSec: z
			.number()
			.int()
			.min(1, createRangeMessage(t, 1, MAX_SET_DURATION_SEC))
			.max(MAX_SET_DURATION_SEC, createRangeMessage(t, 1, MAX_SET_DURATION_SEC))
			.nullable(),
		distanceM: z
			.number()
			.int()
			.min(1, createRangeMessage(t, 1, PROGRAM_DISTANCE_M_MAX))
			.max(PROGRAM_DISTANCE_M_MAX, createRangeMessage(t, 1, PROGRAM_DISTANCE_M_MAX))
			.nullable(),
		isWarmup: z.boolean(),
	})

/** Only the shape of a set; its values are checked at the root, and only if the exercise is not skipped. */
const looseSetSchema = z.object({
	rowKey: z.string(),
	reps: z.number().nullable(),
	weightKg: z.number().nullable(),
	durationSec: z.number().nullable(),
	distanceM: z.number().nullable(),
	isWarmup: z.boolean(),
})

const planSchema = z.object({
	sets: z.array(looseSetSchema),
	durationMin: z.number().nullable(),
	distanceM: z.number().nullable(),
	isBodyweight: z.boolean().nullable(),
})

const createExerciseSchema = (t: TFunction) =>
	z.object({
		key: z.string(),
		exerciseId: z.uuid().nullable(),
		templateExerciseId: z.uuid().nullable(),
		name: z.string().trim().min(1).max(PROGRAM_NAME_MAX_LENGTH),
		kind: exerciseKindSchema,
		muscleGroup: muscleGroupSchema.nullable(),
		isBodyweight: z.boolean().nullable(),
		durationMin: z.number().nullable(),
		distanceM: z.number().nullable(),
		sets: z.array(looseSetSchema).max(MAX_SETS_PER_EXERCISE, {
			error: createRangeMessage(t, 1, MAX_SETS_PER_EXERCISE),
		}),
		isSkipped: z.boolean(),
		plan: planSchema.nullable(),
	})

/**
 * The form «Заповнити» with translated messages. `now` is the user's current moment: the day must
 * be today or up to three days back, and the start is not in the future.
 */
export const createWorkoutFormSchema = (t: TFunction, now: FormNow) => {
	const setSchema = createSetSchema(t)
	const exerciseSchema = createExerciseSchema(t)
	const oldest = shiftLocalDate(now.localDate, -FORM_MAX_DAYS_BACK)
	return z
		.object({
			localDate: z.string().refine((date) => date >= oldest && date <= now.localDate, {
				error: t('training.form.validation.dateOutOfRange'),
			}),
			startTime: z
				.string()
				.regex(TIME_PATTERN, { error: t('training.form.validation.startTimeInvalid') }),
			durationMin: z
				.number()
				.nullable()
				.superRefine((minutes, ctx) => {
					if (minutes === null || !Number.isInteger(minutes)) {
						ctx.addIssue({
							code: 'custom',
							message: t('training.form.validation.durationRequired'),
						})
					} else if (minutes < 1 || minutes > MAX_WORKOUT_MINUTES) {
						ctx.addIssue({ code: 'custom', message: createRangeMessage(t, 1, MAX_WORKOUT_MINUTES) })
					}
				}),
			exercises: z.array(exerciseSchema).max(MAX_EXERCISES_PER_WORKOUT, {
				error: createRangeMessage(t, 1, MAX_EXERCISES_PER_WORKOUT),
			}),
		})
		.superRefine((values, ctx) => {
			if (
				values.localDate === now.localDate &&
				toMinutes(values.startTime) > toMinutes(now.time) + FORM_FUTURE_TOLERANCE_MIN
			) {
				ctx.addIssue({
					code: 'custom',
					path: ['startTime'],
					message: t('training.form.validation.startInFuture'),
				})
			}
			const active = values.exercises.flatMap((exercise, index) =>
				exercise.isSkipped ? [] : [{ exercise, index }],
			)
			if (active.length === 0) {
				ctx.addIssue({ code: 'custom', path: ['exercises'], message: t('training.form.pickOne') })
			}
			active.forEach(({ exercise, index }) => {
				exercise.sets.forEach((set, setIndex) => {
					const parsed = setSchema.safeParse(set)
					if (parsed.success) return
					parsed.error.issues.forEach((issue) => {
						ctx.addIssue({
							code: 'custom',
							path: ['exercises', index, 'sets', setIndex, ...issue.path],
							message: issue.message,
						})
					})
				})
			})
		})
}

export type WorkoutFormSchema = ReturnType<typeof createWorkoutFormSchema>
