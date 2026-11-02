import { DEFAULT_PROGRESS_STEP_KG } from '../schemas/programs.js'

export interface ProgressHintSet {
	reps: number | null
	weightKg: number | null
	isWarmup: boolean
}

export interface GetProgressHintInput {
	/** The sets of the last time the exercise was done; null when it never was. */
	lastSets: readonly ProgressHintSet[] | null
	repsMax: number | null
	weightKg: number | null
	progressStepKg: number | null
	isBodyweight: boolean | null
}

/**
 * The weight to try next time: the last weight plus the step, only when every working set had the
 * same weight and reached the top of the rep range. Nothing for a bodyweight exercise.
 */
export const getProgressHintKg = ({
	lastSets,
	repsMax,
	weightKg,
	progressStepKg,
	isBodyweight,
}: GetProgressHintInput): number | null => {
	if (isBodyweight === true || repsMax === null || !lastSets) return null
	const working = lastSets.filter((set) => !set.isWarmup)
	if (working.length === 0) return null
	const lastWeight = working[0]?.weightKg ?? weightKg
	if (lastWeight === null) return null
	const isSameWeight = working.every((set) => (set.weightKg ?? weightKg) === lastWeight)
	const isTopReached = working.every((set) => set.reps !== null && set.reps >= repsMax)
	if (!isSameWeight || !isTopReached) return null
	return lastWeight + (progressStepKg ?? DEFAULT_PROGRESS_STEP_KG)
}
