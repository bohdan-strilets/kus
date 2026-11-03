import type { TFunction } from 'i18next'

import { formatProgramTarget } from '@/entities/program'
import { formatWorkoutMinutes } from '@/entities/workout'

import { isFormBodyweight } from './form-exercise-edit'
import type { FormExerciseValue } from './workout-form.types'

const BODYWEIGHT_KG = 0

/**
 * «3 × 12 · 120 кг», «3 × 15 · власна вага», «10 хв»: what the exercise says before anything is
 * edited. The plan's own sets are the source — the row says what «Як за планом» brings back.
 */
export const formatPlanSummary = (exercise: FormExerciseValue, t: TFunction): string | null => {
	if (exercise.kind === 'CARDIO') {
		const minutes = exercise.plan?.durationMin ?? exercise.durationMin
		return minutes === null ? null : formatWorkoutMinutes(minutes, t)
	}
	const sets = (exercise.plan?.sets ?? exercise.sets).filter((set) => !set.isWarmup)
	const first = sets[0]
	if (!first) return null
	return formatProgramTarget(
		{
			kind: exercise.kind,
			target: {
				sets: sets.length,
				repsMin: first.reps,
				repsMax: first.reps,
				weightKg: isFormBodyweight(exercise) ? BODYWEIGHT_KG : first.weightKg,
				progressStepKg: null,
				restSec: null,
				durationMin: null,
				distanceM: null,
			},
		},
		t,
	)
}
