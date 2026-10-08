import {
	type FoodParseContext,
	type FoodParseDecision,
	getCorrectedValues,
	hasEdits,
	type ResolveClarificationInput,
	toEntryValues,
} from '@kus/shared'

import type { EditResult } from './eval.types.js'

const toResolution = (
	resolution: ResolveClarificationInput,
	context: FoodParseContext,
): EditResult['resolutions'][number] => {
	const { ref, optionIndex, values } = resolution
	if (optionIndex !== null) {
		const question = context.openClarifications.find((item) => item.ref === ref)
		const kcal = question?.options[optionIndex]?.kcal ?? null
		return { ref, kind: 'option', optionIndex, kcal }
	}
	if (values) return { ref, kind: 'values', optionIndex: null, kcal: values.kcal }
	return { ref, kind: 'close', optionIndex: null, kcal: null }
}

/** What the edit tools of a valid answer change, computed like the backend; null if nothing. */
export const getEditResult = (
	decision: FoodParseDecision,
	context: FoodParseContext,
): EditResult | null => {
	if (decision.kind !== 'log' && decision.kind !== 'edit') return null
	if (!hasEdits(decision.edits)) return null
	const { corrections, deletions, restorations, resolutions } = decision.edits
	return {
		corrections: corrections.flatMap((change) => {
			// the parser accepted only refs of the context
			const entry = context.entries.find((item) => item.ref === change.ref)
			if (!entry) return []
			const { grams, kcal } = getCorrectedValues(toEntryValues(entry), change)
			return [{ ref: change.ref, name: change.name ?? entry.name, grams, kcal }]
		}),
		deletions,
		restorations,
		resolutions: resolutions.map((resolution) => toResolution(resolution, context)),
	}
}
