import type { TemplateExerciseTarget } from '@kus/shared'

import { moveItemBy, orderByKeys } from '@/shared/lib'

import type { DraftExercise } from './template-draft.types'

const getExerciseKey = (exercise: DraftExercise): string => exercise.key

export type TemplateDraftAction =
	| { type: 'reset'; exercises: DraftExercise[] }
	| { type: 'reorder'; keys: readonly string[] }
	| { type: 'move'; key: string; delta: -1 | 1 }
	| { type: 'remove'; key: string }
	| {
			type: 'setTarget'
			key: string
			target: TemplateExerciseTarget
			isBodyweight?: boolean | null
	  }
	| { type: 'add'; exercise: DraftExercise }

/** One step up or down; the same order when the row is already at that end. */
export const moveExercise = (
	list: readonly DraftExercise[],
	key: string,
	delta: -1 | 1,
): DraftExercise[] =>
	moveItemBy(
		list,
		list.findIndex((item) => item.key === key),
		delta,
	)

export const templateDraftReducer = (
	list: DraftExercise[],
	action: TemplateDraftAction,
): DraftExercise[] => {
	switch (action.type) {
		case 'reset':
			return action.exercises
		case 'reorder':
			return orderByKeys(list, action.keys, getExerciseKey)
		case 'move':
			return moveExercise(list, action.key, action.delta)
		case 'remove':
			return list.filter((item) => item.key !== action.key)
		case 'setTarget':
			return list.map((item) =>
				item.key === action.key
					? {
							...item,
							target: action.target,
							...(action.isBodyweight === undefined ? {} : { isBodyweight: action.isBodyweight }),
						}
					: item,
			)
		case 'add':
			return [...list, action.exercise]
	}
}
