// How edits of logged food apply and what the parser rejects. Shared, so the backend and the eval
// compute a changed entry the same way and the model can't send what the backend would refuse.
import { isMacrosConsistent, MAX_KCAL_PER_GRAM } from '../schemas/food-entry.js'
import type { FoodParseContext } from './context.js'
import type { TodayEntryContext } from './edit-context.js'
import type { EntryChange, EntryEdits, ResolveClarificationInput } from './edit-tools.js'
import { distributeOptionValues, type EntryValues, roundNutrition } from './option-values.js'

/** Refs given to the model in this request; anything else is invented or out of reach. */
export interface ParseRefs {
	memoryRefs: ReadonlySet<string>
	entries: ReadonlyMap<string, TodayEntryContext>
	deletedEntryRefs: ReadonlySet<string>
	clarifications: ReadonlyMap<string, FoodParseContext['openClarifications'][number]>
}

export const getParseRefs = (context: FoodParseContext): ParseRefs => ({
	memoryRefs: new Set(context.memory.map((food) => food.ref)),
	entries: new Map(context.entries.map((entry) => [entry.ref, entry])),
	deletedEntryRefs: new Set(context.deletedEntries.map((entry) => entry.ref)),
	clarifications: new Map(context.openClarifications.map((item) => [item.ref, item])),
})

export const toEntryValues = (entry: TodayEntryContext): EntryValues => ({
	grams: entry.grams,
	kcal: entry.kcal,
	protein: entry.protein,
	fat: entry.fat,
	carbs: entry.carbs,
	fiber: entry.fiber,
})

/**
 * The entry after a change: new values as given (on the new or old weight), or — a new weight
 * alone — the old values rescaled by its density, so "600 г" never becomes a fresh guess.
 */
export const getCorrectedValues = (entry: EntryValues, change: EntryChange): EntryValues => {
	const grams = change.grams ?? entry.grams
	if (change.values) return { grams, ...change.values }
	const factor = grams / entry.grams
	return {
		grams,
		kcal: roundNutrition(entry.kcal * factor),
		protein: roundNutrition(entry.protein * factor),
		fat: roundNutrition(entry.fat * factor),
		carbs: roundNutrition(entry.carbs * factor),
		fiber: entry.fiber === null ? null : roundNutrition(entry.fiber * factor),
	}
}

const OUT_OF_CONTEXT_HINT =
	"only entries listed in the context can be changed — for anything else (another day) answer with reply that for now you can change only today's entries"

const getCorrectionErrors = (change: EntryChange, refs: ParseRefs): string[] => {
	const entry = refs.entries.get(change.ref)
	if (!entry)
		return [`correct_entry: ${change.ref} is not in "Today's entries" — ${OUT_OF_CONTEXT_HINT}`]
	if (!change.values) return []
	const values = getCorrectedValues(toEntryValues(entry), change)
	const errors: string[] = []
	if (values.kcal / values.grams > MAX_KCAL_PER_GRAM) {
		errors.push(`correct_entry: ${change.ref} kcal per gram is above ${MAX_KCAL_PER_GRAM}`)
	}
	const category = change.category ?? entry.category
	if (!isMacrosConsistent({ ...values, category, source: entry.source })) {
		errors.push(
			`correct_entry: ${change.ref} kcal does not match 4·protein + 4·carbs + 9·fat + 2·fiber`,
		)
	}
	return errors
}

const getResolutionErrors = (resolution: ResolveClarificationInput, refs: ParseRefs): string[] => {
	const clarification = refs.clarifications.get(resolution.ref)
	if (!clarification) return [`resolve_clarification: ${resolution.ref} is not an open question`]
	if (resolution.optionIndex !== null) {
		return resolution.optionIndex < clarification.options.length
			? []
			: [`resolve_clarification: ${resolution.ref} has no option ${resolution.optionIndex}`]
	}
	const { values } = resolution
	if (!values) return []

	const kcals = clarification.options.map((option) => option.kcal)
	const [min, max] = [Math.min(...kcals), Math.max(...kcals)]
	if (values.kcal < min || values.kcal > max) {
		return [
			`resolve_clarification: ${resolution.ref} values.kcal must lie between the options (${min}–${max}) — for an answer outside them set optionIndex and values null and change the entry with correct_entry`,
		]
	}
	const entries = clarification.entryRefs.flatMap((ref) => refs.entries.get(ref) ?? [])
	const category = entries.find((entry) => entry.category === 'alcohol')?.category ?? 'plate'
	const errors: string[] = []
	if (!isMacrosConsistent({ ...values, category, source: 'ESTIMATE' })) {
		errors.push(
			`resolve_clarification: ${resolution.ref} values.kcal does not match 4·protein + 4·carbs + 9·fat + 2·fiber`,
		)
	}
	if (!distributeOptionValues(entries.map(toEntryValues), values)) {
		errors.push(`resolve_clarification: ${resolution.ref} values are too dense for its entries`)
	}
	return errors
}

/** Each entry is touched once: two edits of one entry in a turn contradict each other. */
const getOverlapErrors = (edits: EntryEdits, refs: ParseRefs): string[] => {
	const touched = [
		...edits.corrections.map((change) => change.ref),
		...edits.deletions,
		...edits.resolutions.flatMap((resolution) =>
			// closing without values changes no entry, so correct_entry may change it in the same turn
			resolution.optionIndex === null && resolution.values === null
				? []
				: (refs.clarifications.get(resolution.ref)?.entryRefs ?? []),
		),
	]
	const repeated = [...new Set(touched.filter((ref, index) => touched.indexOf(ref) !== index))]
	const questions = edits.resolutions.map((resolution) => resolution.ref)
	const repeatedQuestions = questions.filter((ref, index) => questions.indexOf(ref) !== index)
	return [
		...repeated.map((ref) => `${ref} is changed more than once — one edit per entry`),
		...[...new Set(repeatedQuestions)].map((ref) => `${ref} is resolved more than once`),
	]
}

export const getEditErrors = (edits: EntryEdits, refs: ParseRefs): string[] => [
	...edits.corrections.flatMap((change) => getCorrectionErrors(change, refs)),
	...edits.deletions.flatMap((ref) =>
		refs.entries.has(ref)
			? []
			: [`delete_entry: ${ref} is not in "Today's entries" — ${OUT_OF_CONTEXT_HINT}`],
	),
	...edits.restorations.flatMap((ref) =>
		refs.deletedEntryRefs.has(ref) ? [] : [`restore_entry: ${ref} is not in "Deleted today"`],
	),
	...edits.resolutions.flatMap((resolution) => getResolutionErrors(resolution, refs)),
	...getOverlapErrors(edits, refs),
]
