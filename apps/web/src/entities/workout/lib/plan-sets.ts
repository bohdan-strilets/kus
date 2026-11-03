import type {
	ExerciseKind,
	LivePlanExercise,
	ProgramExerciseResponse,
	ProgramLastSet,
} from '@kus/shared'

/** What both the live mode and the form need from an exercise of a template. */
export interface PlanTarget {
	kind: ExerciseKind
	sets: number | null
	repsMin: number | null
	repsMax: number | null
	weightKg: number | null
	durationMin: number | null
	distanceM: number | null
	isBodyweight: boolean | null
}

export interface PlanSet {
	reps: number | null
	weightKg: number | null
}

/** A template without a set count still gives one row to fill. */
const DEFAULT_PLAN_SET_COUNT = 1

/** The weight of the plan, else the weight of the last time's first working set. */
const getPlanWeightKg = (
	weightKg: number | null,
	lastSets: readonly ProgramLastSet[] | null,
): number | null =>
	weightKg ?? lastSets?.find((set) => !set.isWarmup && set.weightKg !== null)?.weightKg ?? null

/** From an exercise of the live plan (`GET /live-workouts/current`). */
export const toPlanTarget = (plan: LivePlanExercise): PlanTarget => ({
	kind: plan.kind,
	sets: plan.sets,
	repsMin: plan.repsMin,
	repsMax: plan.repsMax,
	weightKg: getPlanWeightKg(plan.weightKg, plan.lastSets),
	durationMin: plan.durationMin,
	distanceM: plan.distanceM,
	isBodyweight: plan.isBodyweight,
})

/** From an exercise of a template of the program (the form). */
export const toTemplatePlanTarget = (exercise: ProgramExerciseResponse): PlanTarget => ({
	kind: exercise.kind,
	sets: exercise.target.sets,
	repsMin: exercise.target.repsMin,
	repsMax: exercise.target.repsMax,
	weightKg: getPlanWeightKg(exercise.target.weightKg, exercise.lastSets),
	durationMin: exercise.target.durationMin,
	distanceM: exercise.target.distanceM,
	isBodyweight: exercise.isBodyweight,
})

/**
 * The sets a plan says: its count, the top of the rep range and the working weight. Cardio has
 * none (its minutes and distance live on the exercise); a bodyweight exercise has no weight.
 */
export const buildPlanSets = (target: PlanTarget): PlanSet[] => {
	if (target.kind === 'CARDIO') return []
	const weightKg = target.isBodyweight === true ? null : target.weightKg
	return Array.from({ length: target.sets ?? DEFAULT_PLAN_SET_COUNT }, () => ({
		reps: target.repsMax ?? target.repsMin,
		weightKg,
	}))
}
