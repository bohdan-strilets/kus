import {
	DEFAULT_PROGRESS_STEP_KG,
	DEFAULT_REST_SEC,
	type ExerciseKind,
	type MuscleGroup,
	type ProgramLastSet,
	type TemplateExerciseTarget,
} from '@kus/shared'

import { createUuid } from '@/shared/lib'

import {
	DEFAULT_CARDIO_MIN,
	DEFAULT_REPS_MAX,
	DEFAULT_REPS_MIN,
	DEFAULT_SETS,
} from './template.constants'
import type { DraftExercise } from './template-draft.types'

interface NewExerciseSource {
	name: string
	exerciseId: string | null
	kind: ExerciseKind
	muscleGroup: MuscleGroup | null
	lastSets: ProgramLastSet[] | null
}

const EMPTY_TARGET: TemplateExerciseTarget = {
	sets: null,
	repsMin: null,
	repsMax: null,
	weightKg: null,
	progressStepKg: null,
	restSec: null,
	durationMin: null,
	distanceM: null,
}

/** The heaviest working set of the last time: the weight the new row starts from. */
const getLastWorkingWeight = (lastSets: readonly ProgramLastSet[] | null): number | null => {
	const weights = (lastSets ?? []).flatMap((set) =>
		!set.isWarmup && set.weightKg !== null && set.weightKg > 0 ? [set.weightKg] : [],
	)
	return weights.length > 0 ? Math.max(...weights) : null
}

/** An exercise added in the editor with the defaults: 3 × 8–12, rest 90 s; cardio — 10 min. */
export const createDraftExercise = (source: NewExerciseSource): DraftExercise => {
	const base = { key: createUuid(), ...source }
	if (source.kind === 'CARDIO') {
		return { ...base, target: { ...EMPTY_TARGET, durationMin: DEFAULT_CARDIO_MIN } }
	}
	const weightKg = getLastWorkingWeight(source.lastSets)
	return {
		...base,
		target: {
			...EMPTY_TARGET,
			sets: DEFAULT_SETS,
			repsMin: DEFAULT_REPS_MIN,
			repsMax: DEFAULT_REPS_MAX,
			weightKg,
			progressStepKg: weightKg === null ? null : DEFAULT_PROGRESS_STEP_KG,
			restSec: DEFAULT_REST_SEC,
		},
	}
}
