// What the model may change: today's entries, the ones deleted today and the open questions, each
// under a short ref. The backend keeps the ref → id map of the request (CLAUDE.md §5, IDOR).
import type { FoodCategory, FoodSource, MealType } from '../schemas/enums.js'
import type { ClarifyOption } from './tools.js'

/** Newest last; older entries of a busy day drop out of the context first. */
export const MAX_CONTEXT_ENTRIES = 30
export const MAX_CONTEXT_DELETED_ENTRIES = 5
export const MAX_CONTEXT_OPEN_CLARIFICATIONS = 3

/**
 * What a changed entry held before its changes, per field: the value before the latest change. A
 * field changed more than once also has the very first value in `originally` (80 → 100 → 150 g:
 * was 100, originally 80), so «верни як було» can mean either.
 */
export interface EntryWasContext {
	name?: string
	mealType?: MealType
	grams?: number
	kcal?: number
	protein?: number
	fat?: number
	carbs?: number
	originally?: Omit<EntryWasContext, 'originally'>
}

export interface TodayEntryContext {
	/** `e1`… — numbered by the backend, unique across active and deleted entries of the request. */
	ref: string
	name: string
	mealType: MealType
	/** `YYYY-MM-DD`; only for an entry of another day than today, written today. */
	date?: string
	grams: number
	kcal: number
	protein: number
	fat: number
	carbs: number
	fiber: number | null
	category: FoodCategory
	source: FoodSource
	/**
	 * Changed after it was logged: by hand, via `correct_entry` or by moving it to another meal.
	 * The values here are no longer the AI's original estimate.
	 */
	isEdited: boolean
	/** Only for an edited entry whose original values are known. */
	was?: EntryWasContext
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

/** Tells the model the entry no longer holds what it logged, so the turn is not logged again. */
const CHANGED_MARKER = ' (changed after logging)'

type WasValues = Omit<EntryWasContext, 'originally'>

const formatWasPieces = (values: WasValues): (string | null)[] => {
	const macros = [
		values.protein === undefined ? null : `P ${round(values.protein)}`,
		values.fat === undefined ? null : `F ${round(values.fat)}`,
		values.carbs === undefined ? null : `C ${round(values.carbs)}`,
	].filter((part) => part !== null)
	return [
		values.name === undefined ? null : `"${values.name}"`,
		values.mealType ?? null,
		values.grams === undefined ? null : `${round(values.grams)} g`,
		values.kcal === undefined ? null : `${round(values.kcal)} kcal`,
		macros.length > 0 ? macros.join(' ') : null,
	]
}

/** «was: 100 g (originally 80 g), 150 kcal» — only the fields that changed. */
const formatWas = ({ originally, ...was }: EntryWasContext): string => {
	const originalPieces = originally ? formatWasPieces(originally) : []
	return formatWasPieces(was)
		.map((piece, index) => {
			const original = originalPieces[index] ?? null
			return piece !== null && original !== null ? `${piece} (originally ${original})` : piece
		})
		.filter((piece) => piece !== null)
		.join(', ')
}

const formatChangedMarker = (entry: TodayEntryContext): string => {
	if (!entry.isEdited) return ''
	const was = entry.was ? formatWas(entry.was) : ''
	return was === '' ? CHANGED_MARKER : ` (changed after logging; was: ${was})`
}

const formatEntry = (entry: TodayEntryContext): string =>
	`- ${entry.ref} ${entry.mealType}${entry.date ? ` ${entry.date}` : ''} "${entry.name}": ${round(entry.grams)} g, ${round(entry.kcal)} kcal, P ${round(entry.protein)} F ${round(entry.fat)} C ${round(entry.carbs)}${formatChangedMarker(entry)}`

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
					"Today's entries — already logged, current values (refs for correct_entry / delete_entry; only these can be changed):",
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
