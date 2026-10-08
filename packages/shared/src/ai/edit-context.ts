// What the model may change: today's entries, the ones deleted today and the open questions, each
// under a short ref. The backend keeps the ref → id map of the request (CLAUDE.md §5, IDOR).
import type { FoodCategory, FoodSource, MealType } from '../schemas/enums.js'
import type { ClarifyOption } from './tools.js'

/** Newest last; older entries of a busy day drop out of the context first. */
export const MAX_CONTEXT_ENTRIES = 30
export const MAX_CONTEXT_DELETED_ENTRIES = 5
export const MAX_CONTEXT_OPEN_CLARIFICATIONS = 3

export interface TodayEntryContext {
	/** `e1`… — numbered by the backend, unique across active and deleted entries of the request. */
	ref: string
	name: string
	mealType: MealType
	grams: number
	kcal: number
	protein: number
	fat: number
	carbs: number
	fiber: number | null
	category: FoodCategory
	source: FoodSource
}

export type DeletedEntryContext = Pick<TodayEntryContext, 'ref' | 'name' | 'grams' | 'kcal'>

export interface OpenClarificationContext {
	/** `c1`… */
	ref: string
	question: string
	/** Refs of today's entries the question is about. */
	entryRefs: string[]
	options: ClarifyOption[]
}

const round = (value: number): number => Math.round(value)

const formatEntry = (entry: TodayEntryContext): string =>
	`- ${entry.ref} ${entry.mealType} "${entry.name}": ${round(entry.grams)} g, ${round(entry.kcal)} kcal, P ${round(entry.protein)} F ${round(entry.fat)} C ${round(entry.carbs)}`

const formatClarification = (clarification: OpenClarificationContext): string => {
	const options = clarification.options
		.map((option, index) => `${index} "${option.label}" ${round(option.kcal)} kcal`)
		.join(' · ')
	return `- ${clarification.ref} about ${clarification.entryRefs.join(', ')}: "${clarification.question}" — ${options}`
}

export const formatEditContext = ({
	entries,
	deletedEntries,
	openClarifications,
}: {
	entries: TodayEntryContext[]
	deletedEntries: DeletedEntryContext[]
	openClarifications: OpenClarificationContext[]
}): string[] => {
	const lines =
		entries.length === 0
			? ['Nothing logged yet today.']
			: [
					"Today's entries (refs for correct_entry / delete_entry; only these can be changed):",
					...entries.map(formatEntry),
				]
	if (deletedEntries.length > 0) {
		lines.push(
			'Deleted today (refs for restore_entry):',
			...deletedEntries.map(
				(entry) =>
					`- ${entry.ref} "${entry.name}": ${round(entry.grams)} g, ${round(entry.kcal)} kcal`,
			),
		)
	}
	if (openClarifications.length > 0) {
		lines.push(
			'Open questions (refs for resolve_clarification):',
			...openClarifications.map(formatClarification),
		)
	}
	return lines
}
