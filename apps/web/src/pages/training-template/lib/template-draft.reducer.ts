import type { TemplateExerciseTarget } from '@kus/shared'

import type { DraftExercise } from './template-draft.types'

export type TemplateDraftAction =
	| { type: 'reset'; exercises: DraftExercise[] }
	| { type: 'reorder'; keys: readonly string[] }
	| { type: 'move'; key: string; delta: -1 | 1 }
	| { type: 'remove'; key: string }
	| { type: 'setTarget'; key: string; target: TemplateExerciseTarget }
	| { type: 'add'; exercise: DraftExercise }

/** One step up or down; the same order when the row is already at that end. */
export const moveExercise = (
	list: readonly DraftExercise[],
	key: string,
	delta: -1 | 1,
): DraftExercise[] => {
	const from = list.findIndex((item) => item.key === key)
	const to = from + delta
	if (from === -1 || to < 0 || to >= list.length) return [...list]
	const next = [...list]
	const [moved] = next.splice(from, 1)
	if (moved) next.splice(to, 0, moved)
	return next
}

/** The list in the order of `keys` (a drag gives the whole new order); a mismatch keeps the list. */
const orderByKeys = (list: readonly DraftExercise[], keys: readonly string[]): DraftExercise[] => {
	const byKey = new Map(list.map((item) => [item.key, item]))
	const ordered = keys.flatMap((key) => byKey.get(key) ?? [])
	return ordered.length === list.length ? ordered : [...list]
}

export const templateDraftReducer = (
	list: DraftExercise[],
	action: TemplateDraftAction,
): DraftExercise[] => {
	switch (action.type) {
		case 'reset':
			return action.exercises
		case 'reorder':
			return orderByKeys(list, action.keys)
		case 'move':
			return moveExercise(list, action.key, action.delta)
		case 'remove':
			return list.filter((item) => item.key !== action.key)
		case 'setTarget':
			return list.map((item) =>
				item.key === action.key ? { ...item, target: action.target } : item,
			)
		case 'add':
			return [...list, action.exercise]
	}
}
