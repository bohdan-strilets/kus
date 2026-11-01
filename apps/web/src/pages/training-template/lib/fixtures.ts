import type { TemplateExerciseTarget } from '@kus/shared'

import type { DraftExercise } from './template-draft.types'

export const makeTarget = (
	patch: Partial<TemplateExerciseTarget> = {},
): TemplateExerciseTarget => ({
	sets: 3,
	repsMin: 8,
	repsMax: 12,
	weightKg: 50,
	progressStepKg: 2.5,
	restSec: 90,
	durationMin: null,
	distanceM: null,
	...patch,
})

export const makeDraft = (key: string, patch: Partial<DraftExercise> = {}): DraftExercise => ({
	key,
	name: `Вправа ${key}`,
	exerciseId: null,
	kind: 'STRENGTH',
	muscleGroup: 'CHEST',
	target: makeTarget(),
	lastSets: null,
	...patch,
})
