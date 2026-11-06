// What the user's earlier turns did, as short markers in front of their text in the model's history.

/** A group of rows a turn wrote: shown refs, which of them were deleted since, or all deleted when no ref is shown. */
export interface HistoryLogMarker {
	/** Refs of this request's context, in ref order; empty when none of the rows has one. */
	refs: string[]
	/** The refs deleted since. */
	deletedRefs: string[]
	/** Without refs: everything the turn wrote of this kind is deleted now. */
	isDeleted: boolean
}

export type HistoryMeasurementKind = 'weight' | 'waist'

export interface HistoryMeasurementMarker {
	kind: HistoryMeasurementKind
	/** Every row of this kind the turn wrote is deleted now. */
	isDeleted: boolean
}

export type HistoryFactMarker =
	/** `saved` or `updated` (one fact forgotten and one saved in the same turn). */
	| { kind: 'saved' | 'updated'; ref: string | null; isDeleted: boolean }
	| { kind: 'proposed'; isDeclined: boolean }
	| { kind: 'forgotten' }

export interface HistorySavedFoodMarker {
	/** `m1…` when the food is in this request's «Saved foods». */
	ref: string | null
	isDeleted: boolean
}

/** Everything a user turn left behind, besides the food entries; all of it is optional and absent when empty. */
export interface HistoryMarkerFields {
	/** Refs of today's entries this user turn logged; the model must not log them again. */
	loggedRefs?: string[]
	/** The user turn logged entries, but none of them is in today's context window: no ref to show. */
	hasLoggedEntries?: boolean
	/** The refs of `loggedRefs` deleted since. */
	deletedLoggedRefs?: string[]
	/** Without refs: every entry the turn logged is deleted now. */
	areLoggedEntriesDeleted?: boolean
	workout?: HistoryLogMarker
	/** WEIGHT before WAIST. */
	measurements?: HistoryMeasurementMarker[]
	facts?: HistoryFactMarker[]
	savedFoods?: HistorySavedFoodMarker[]
}

const FOOD_LOGGED_WORD = 'logged'
const WORKOUT_LOGGED_WORD = 'workout logged'
const FACT_SAVED_WORD = 'fact saved'
const FACT_UPDATED_WORD = 'fact updated'
const FACT_PROPOSED_WORD = 'fact proposed'
const FACT_FORGOTTEN_WORD = 'fact forgotten'
const FOOD_SAVED_WORD = 'food saved'
const MEASUREMENT_WORDS: Record<HistoryMeasurementKind, string> = {
	weight: 'weight logged',
	waist: 'waist logged',
}
const DELETED_LATER = 'deleted later'
const DECLINED = 'declined'

const formatMarker = (parts: string[]): string => `[${parts.join('; ')}]`

/** `[word: r1, r2; deleted later: r2]`, without refs `[word]` or `[word; deleted later]`. */
const formatLogMarker = (
	word: string,
	{ refs, deletedRefs, isDeleted }: HistoryLogMarker,
): string => {
	if (refs.length === 0) return formatMarker(isDeleted ? [word, DELETED_LATER] : [word])
	const deleted = deletedRefs.length > 0 ? [`${DELETED_LATER}: ${deletedRefs.join(', ')}`] : []
	return formatMarker([`${word}: ${refs.join(', ')}`, ...deleted])
}

const formatRefMarker = (word: string, ref: string | null, isDeleted: boolean): string => {
	if (isDeleted) return formatMarker([word, DELETED_LATER])
	return formatMarker([ref === null ? word : `${word}: ${ref}`])
}

const formatFactMarker = (marker: HistoryFactMarker): string => {
	if (marker.kind === 'forgotten') return formatMarker([FACT_FORGOTTEN_WORD])
	if (marker.kind === 'proposed') {
		return formatMarker(marker.isDeclined ? [FACT_PROPOSED_WORD, DECLINED] : [FACT_PROPOSED_WORD])
	}
	const word = marker.kind === 'updated' ? FACT_UPDATED_WORD : FACT_SAVED_WORD
	return formatRefMarker(word, marker.ref, marker.isDeleted)
}

const FACT_KIND_ORDER: Record<HistoryFactMarker['kind'], number> = {
	forgotten: 0,
	saved: 1,
	updated: 1,
	proposed: 2,
}

/** One forgotten and one saved fact in the same turn read as one replaced fact. */
const mergeUpdatedFacts = (facts: HistoryFactMarker[]): HistoryFactMarker[] => {
	const forgotten = facts.filter(({ kind }) => kind === 'forgotten')
	const saved = facts.filter((marker) => marker.kind === 'saved')
	const [only] = saved
	if (forgotten.length !== 1 || saved.length !== 1 || only?.kind !== 'saved') return facts
	return [
		{ kind: 'updated', ref: only.ref, isDeleted: only.isDeleted },
		...facts.filter(({ kind }) => kind === 'proposed'),
	]
}

/**
 * The markers of a user turn, kinds in a fixed order: food, workout, measurements, facts, saved
 * foods. They go first in the turn, so that cutting a long message never drops them.
 */
export const formatHistoryMarkers = (turn: HistoryMarkerFields): string[] => {
	const { loggedRefs = [], hasLoggedEntries = false, workout, measurements = [] } = turn
	const { deletedLoggedRefs = [], areLoggedEntriesDeleted = false } = turn
	const { facts = [], savedFoods = [] } = turn
	const markers: string[] = []
	if (loggedRefs.length > 0 || hasLoggedEntries) {
		markers.push(
			formatLogMarker(FOOD_LOGGED_WORD, {
				refs: loggedRefs,
				deletedRefs: deletedLoggedRefs,
				isDeleted: areLoggedEntriesDeleted,
			}),
		)
	}
	if (workout) markers.push(formatLogMarker(WORKOUT_LOGGED_WORD, workout))
	for (const { kind, isDeleted } of measurements) {
		markers.push(
			formatMarker(
				isDeleted ? [MEASUREMENT_WORDS[kind], DELETED_LATER] : [MEASUREMENT_WORDS[kind]],
			),
		)
	}
	const orderedFacts = [...mergeUpdatedFacts(facts)].sort(
		(a, b) => FACT_KIND_ORDER[a.kind] - FACT_KIND_ORDER[b.kind],
	)
	markers.push(...orderedFacts.map(formatFactMarker))
	markers.push(
		...savedFoods.map(({ ref, isDeleted }) => formatRefMarker(FOOD_SAVED_WORD, ref, isDeleted)),
	)
	return markers
}
