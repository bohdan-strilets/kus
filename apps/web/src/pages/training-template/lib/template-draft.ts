import type { ProgramTemplateResponse, TemplateExerciseDraft } from '@kus/shared'

import type { DraftExercise } from './template-draft.types'

export const toDraftExercises = (template: ProgramTemplateResponse): DraftExercise[] =>
	template.exercises.map((exercise) => ({
		key: exercise.id,
		name: exercise.name,
		exerciseId: exercise.exerciseId,
		kind: exercise.kind,
		muscleGroup: exercise.muscleGroup,
		target: exercise.target,
		lastSets: exercise.lastSets,
	}))

/** The body of «Готово»: the list as the request wants it, without the keys of the screen. */
export const toSaveExercises = (draft: readonly DraftExercise[]): TemplateExerciseDraft[] =>
	draft.map(({ name, exerciseId, kind, muscleGroup, target }) => ({
		name,
		exerciseId,
		kind,
		muscleGroup,
		target,
	}))

export const hasDraftChanges = (
	original: readonly DraftExercise[],
	draft: readonly DraftExercise[],
): boolean => JSON.stringify(toSaveExercises(original)) !== JSON.stringify(toSaveExercises(draft))
