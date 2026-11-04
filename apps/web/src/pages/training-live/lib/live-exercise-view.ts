import type { LiveDraftExercise } from '@/features/live-workout'
import { formatProgramTarget } from '@/entities/program'
import type { TFunction } from 'i18next'

/** «3 підходи · 10–12 повт. · 50 кг»: what the template asks of the exercise; null without a plan. */
export const formatPlanTarget = (exercise: LiveDraftExercise, t: TFunction): string | null => {
	const { plan } = exercise
	if (plan === null) return null
	return formatProgramTarget(
		{
			kind: exercise.kind,
			target: {
				sets: plan.sets,
				repsMin: plan.repsMin,
				repsMax: plan.repsMax,
				weightKg: plan.weightKg,
				progressStepKg: plan.progressStepKg,
				restSec: plan.restSec,
				durationMin: plan.durationMin ?? exercise.durationMin,
				distanceM: exercise.distanceM,
			},
		},
		t,
	)
}

/** The hint shows while a working set still to do has not taken the suggested weight. */
export const getHintToShow = (
	exercise: LiveDraftExercise,
): { reps: number; weightKg: number } | null => {
	const hintKg = exercise.plan?.progressHintKg ?? null
	const reps = exercise.plan?.repsMax ?? null
	if (hintKg === null || reps === null || exercise.isBodyweight === true) return null
	const isPending = exercise.sets.some(
		(set) => set.doneAt === null && !set.isWarmup && set.weightKg !== hintKg,
	)
	return isPending ? { reps, weightKg: hintKg } : null
}
