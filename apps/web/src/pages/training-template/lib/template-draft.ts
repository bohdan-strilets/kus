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
		isBodyweight: exercise.isBodyweight,
		lastSets: exercise.lastSets,
	}))

/** The body of «Готово»: the list as the request wants it, without the keys of the screen. */
export const toSaveExercises = (draft: readonly DraftExercise[]): TemplateExerciseDraft[] =>
	draft.map(({ name, exerciseId, kind, muscleGroup, target, isBodyweight }) => ({
		name,
		exerciseId,
		kind,
		muscleGroup,
		target,
		// an old row says nothing: the request keeps its «unknown»
		...(isBodyweight === undefined ? {} : { isBodyweight }),
	}))

/** `newName` is the name «Готово» would send (null — the name stays): a rename alone is a change. */
export const hasDraftChanges = (
	original: readonly DraftExercise[],
	draft: readonly DraftExercise[],
	newName: string | null = null,
): boolean =>
	newName !== null ||
	JSON.stringify(toSaveExercises(original)) !== JSON.stringify(toSaveExercises(draft))
