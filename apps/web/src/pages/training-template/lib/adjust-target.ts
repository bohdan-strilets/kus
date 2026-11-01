import {
	DEFAULT_PROGRESS_STEP_KG,
	PROGRAM_DISTANCE_M_MAX,
	PROGRAM_DURATION_MIN_MAX,
	PROGRAM_REPS_MAX,
	PROGRAM_REPS_MIN,
	PROGRAM_SETS_MAX,
	PROGRAM_SETS_MIN,
	PROGRAM_WEIGHT_KG_MAX,
	type TemplateExerciseTarget,
} from '@kus/shared'

import {
	CARDIO_DISTANCE_STEP_M,
	CARDIO_MIN_STEP,
	DEFAULT_CARDIO_MIN,
	DEFAULT_REPS_MAX,
	DEFAULT_REPS_MIN,
	DEFAULT_SETS,
} from './template.constants'

export type StepDirection = -1 | 1

const WEIGHT_PRECISION = 10
const METERS_IN_KM = 1000

const clamp = (value: number, min: number, max: number): number =>
	Math.min(max, Math.max(min, value))

interface IntStepOptions {
	min: number
	max: number
	/** Where the first tap lands when the field is empty. */
	start: number
	step?: number
}

/** A step of a whole-number field; an empty one only grows (to `start`). */
const stepInt = (
	value: number | null,
	direction: StepDirection,
	{ min, max, start, step = 1 }: IntStepOptions,
): number | null => {
	if (value === null) return direction === 1 ? start : null
	return clamp(value + direction * step, min, max)
}

export const adjustSets = (
	target: TemplateExerciseTarget,
	direction: StepDirection,
): TemplateExerciseTarget => ({
	...target,
	sets: stepInt(target.sets, direction, {
		min: PROGRAM_SETS_MIN,
		max: PROGRAM_SETS_MAX,
		start: DEFAULT_SETS,
	}),
})

/** «від» can't pass «до»: pushing it up drags «до» along. */
export const adjustRepsMin = (
	target: TemplateExerciseTarget,
	direction: StepDirection,
): TemplateExerciseTarget => {
	const repsMin = stepInt(target.repsMin, direction, {
		min: PROGRAM_REPS_MIN,
		max: PROGRAM_REPS_MAX,
		start: DEFAULT_REPS_MIN,
	})
	const isAboveMax = repsMin !== null && target.repsMax !== null && repsMin > target.repsMax
	return { ...target, repsMin, repsMax: isAboveMax ? repsMin : target.repsMax }
}

/** «до» can't go under «від»: pulling it down drags «від» along. */
export const adjustRepsMax = (
	target: TemplateExerciseTarget,
	direction: StepDirection,
): TemplateExerciseTarget => {
	const repsMax = stepInt(target.repsMax, direction, {
		min: PROGRAM_REPS_MIN,
		max: PROGRAM_REPS_MAX,
		start: DEFAULT_REPS_MAX,
	})
	const isBelowMin = repsMax !== null && target.repsMin !== null && repsMax < target.repsMin
	return { ...target, repsMin: isBelowMin ? repsMax : target.repsMin, repsMax }
}

/** The step of the weight stepper is the progress step of the exercise. */
export const getWeightStepKg = (target: TemplateExerciseTarget): number =>
	target.progressStepKg ?? DEFAULT_PROGRESS_STEP_KG

/**
 * No weight (null, or the 0 of a bodyweight plan) starts at one step; going down from the first step
 * clears it. A weight brings the progress step along, no weight takes it away.
 */
export const adjustWeight = (
	target: TemplateExerciseTarget,
	direction: StepDirection,
): TemplateExerciseTarget => {
	const step = getWeightStepKg(target)
	const current = target.weightKg === null || target.weightKg === 0 ? null : target.weightKg
	if (current === null && direction === -1)
		return { ...target, weightKg: null, progressStepKg: null }
	const next =
		current === null
			? step
			: Math.round((current + direction * step) * WEIGHT_PRECISION) / WEIGHT_PRECISION
	if (next <= 0) return { ...target, weightKg: null, progressStepKg: null }
	return {
		...target,
		weightKg: Math.min(next, PROGRAM_WEIGHT_KG_MAX),
		progressStepKg: target.progressStepKg ?? DEFAULT_PROGRESS_STEP_KG,
	}
}

export const adjustDuration = (
	target: TemplateExerciseTarget,
	direction: StepDirection,
): TemplateExerciseTarget => ({
	...target,
	durationMin: stepInt(target.durationMin, direction, {
		min: 1,
		max: PROGRAM_DURATION_MIN_MAX,
		start: DEFAULT_CARDIO_MIN,
		step: CARDIO_MIN_STEP,
	}),
})

/** Half a kilometre per tap; going down from the first step clears the distance. */
export const adjustDistance = (
	target: TemplateExerciseTarget,
	direction: StepDirection,
): TemplateExerciseTarget => {
	const current = target.distanceM
	if (current === null) {
		return direction === 1 ? { ...target, distanceM: CARDIO_DISTANCE_STEP_M } : target
	}
	const next = current + direction * CARDIO_DISTANCE_STEP_M
	return { ...target, distanceM: next < 1 ? null : Math.min(next, PROGRAM_DISTANCE_M_MAX) }
}

/** The typed-in counterparts of the steppers: the value is already inside the limits of the input. */
export const setSets = (target: TemplateExerciseTarget, sets: number): TemplateExerciseTarget => ({
	...target,
	sets,
})

export const setRepsMin = (
	target: TemplateExerciseTarget,
	repsMin: number,
): TemplateExerciseTarget => ({
	...target,
	repsMin,
	repsMax: target.repsMax !== null && repsMin > target.repsMax ? repsMin : target.repsMax,
})

export const setRepsMax = (
	target: TemplateExerciseTarget,
	repsMax: number,
): TemplateExerciseTarget => ({
	...target,
	repsMax,
	repsMin: target.repsMin !== null && repsMax < target.repsMin ? repsMax : target.repsMin,
})

/** 0 clears the weight, as going down from the first step does. */
export const setWeight = (
	target: TemplateExerciseTarget,
	weightKg: number,
): TemplateExerciseTarget =>
	weightKg <= 0
		? { ...target, weightKg: null, progressStepKg: null }
		: {
				...target,
				weightKg: Math.min(weightKg, PROGRAM_WEIGHT_KG_MAX),
				progressStepKg: target.progressStepKg ?? DEFAULT_PROGRESS_STEP_KG,
			}

export const setDuration = (
	target: TemplateExerciseTarget,
	durationMin: number,
): TemplateExerciseTarget => ({ ...target, durationMin })

export const setDistanceKm = (
	target: TemplateExerciseTarget,
	distanceKm: number,
): TemplateExerciseTarget => ({
	...target,
	distanceM: Math.min(Math.round(distanceKm * METERS_IN_KM), PROGRAM_DISTANCE_M_MAX),
})
