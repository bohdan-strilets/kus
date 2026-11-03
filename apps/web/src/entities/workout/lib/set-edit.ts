import { MAX_SET_REPS, MAX_SET_WEIGHT_KG } from '@kus/shared'

import { formatNumber } from './format-workout'

export const WEIGHT_DECIMALS = 1
/** A cardio exercise added on the go starts with this many minutes (the same default as a template's). */
export const NEW_CARDIO_MIN = 10
const REPS_STEP = 1
const MIN_REPS = 1
const EMPTY_WEIGHT_TEXT = '—'
const ROUNDING = 100

export type StepDirection = 1 | -1

const roundWeight = (weightKg: number): number => Math.round(weightKg * ROUNDING) / ROUNDING

/** One step of the weight by the plan's progress step: it never goes below 0 or above the limit. */
export const stepWeight = (
	weightKg: number | null,
	stepKg: number,
	direction: StepDirection,
): number => {
	const next = roundWeight((weightKg ?? 0) + direction * stepKg)
	return Math.min(MAX_SET_WEIGHT_KG, Math.max(0, next))
}

/** One rep up or down, inside 1…`MAX_SET_REPS`. */
export const stepReps = (reps: number | null, direction: StepDirection): number =>
	Math.min(MAX_SET_REPS, Math.max(MIN_REPS, (reps ?? 0) + direction * REPS_STEP))

export const formatSetWeight = (weightKg: number | null): string =>
	weightKg === null ? EMPTY_WEIGHT_TEXT : formatNumber(weightKg)

export const formatSetReps = (reps: number | null): string =>
	reps === null ? EMPTY_WEIGHT_TEXT : formatNumber(reps)
