// What the user's earlier turns did, as short markers in front of their text in the model's history,
// and what Kusik did in a turn (in front of its reply) and the user did in the app between turns.
import { toContextText } from './memory-context.js'
import { READ_DIGEST_MAX_CHARS, READ_DIGESTS_MAX_PER_TURN } from './read-digest.js'

/** Who deleted an entry: a Kusik tool call in the chat, or the user's delete button in the app. */
export type HistoryDeletedBy = 'kusik' | 'app'

/** An entry a Kusik turn changed; `ref` is the `e…` of this request, null when it has none. */
export interface HistoryActionEntry {
	ref: string | null
	/** Corrected entries: the weight the turn left it with. */
	grams?: number
}

/** A saved food a Kusik turn removed from memory or brought back. */
export interface HistoryFoodAction {
	name: string
	/** The `g…` of «Foods forgotten today» when it is there now; null otherwise. */
	ref: string | null
	/** A removed food that is saved again now. */
	isRestoredLater?: boolean
}

/** What a Kusik turn did to entries that already existed; a kind with nothing is an empty list. */
export interface HistoryKusikActions {
	deleted: HistoryActionEntry[]
	restored: HistoryActionEntry[]
	corrected: HistoryActionEntry[]
	/** Saved foods removed from memory (forget_food, agreed). */
	forgottenFoods?: HistoryFoodAction[]
	/** Saved foods brought back (restore_food). */
	restoredFoods?: HistoryFoodAction[]
}

/** The user changed an entry in the app after the previous message. */
export interface HistoryAppChange {
	kind: 'deleted' | 'edited'
	ref: string | null
	name: string
	/** The entry's day, `YYYY-MM-DD`. */
	localDate: string
}

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
	/** Refs of `deletedLoggedRefs` that Kusik deleted. */
	deletedByKusikLoggedRefs?: string[]
	/** Refs of `deletedLoggedRefs` that the user deleted in the app; the rest are of unknown origin. */
	deletedInAppLoggedRefs?: string[]
	/** Without refs: who deleted all of them; absent when they differ or nobody is known. */
	loggedDeletedBy?: HistoryDeletedBy
	/** User turn: what the user changed in the app since the previous message, oldest first. */
	appChanges?: HistoryAppChange[]
	/** Kusik turn: what it did to entries in this turn. */
	kusikActions?: HistoryKusikActions
	/** Kusik turn: digests of what it read (get_workouts, find_food), oldest first; see `formatWorkoutsDigest`. */
	reads?: string[]
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
const DELETED_LATER_BY: Record<HistoryDeletedBy, string> = {
	kusik: 'deleted later by Kusik',
	app: 'deleted later in the app',
}
const DECLINED = 'declined'
const FOOD_FORGOTTEN_ACTION = 'forgot food'
const FOOD_RESTORED_ACTION = 'restored food'
const RESTORED_LATER = 'restored later'
const KUSIK_WORD = 'Kusik'
const APP_CHANGES_WORD = 'in the app before this message'
const APP_CHANGES_MAX = 5
const APP_CHANGE_NAME_MAX_CHARS = 30
const KUSIK_ACTION_REFS_MAX = 6

const formatMarker = (parts: string[]): string => `[${parts.join('; ')}]`

/** Deleted refs grouped by who deleted them, each group a part of the marker; no author, no group. */
interface DeletedGroups {
	byKusik?: string[]
	inApp?: string[]
}

const formatDeletedParts = (
	deletedRefs: string[],
	{ byKusik = [], inApp = [] }: DeletedGroups,
): string[] => {
	const known = new Set([...byKusik, ...inApp])
	const unknown = deletedRefs.filter((ref) => !known.has(ref))
	const groups: [string, string[]][] = [
		[DELETED_LATER_BY.kusik, byKusik],
		[DELETED_LATER_BY.app, inApp],
		[DELETED_LATER, unknown],
	]
	return groups.flatMap(([word, refs]) => (refs.length > 0 ? [`${word}: ${refs.join(', ')}`] : []))
}

/**
 * `[word: r1, r2; deleted later: r2]`, without refs `[word]` or `[word; deleted later]`; with the
 * author of the deletion `deleted later by Kusik` / `deleted later in the app`.
 */
const formatLogMarker = (
	word: string,
	{ refs, deletedRefs, isDeleted }: HistoryLogMarker,
	{ groups = {}, deletedBy }: { groups?: DeletedGroups; deletedBy?: HistoryDeletedBy } = {},
): string => {
	if (refs.length === 0) {
		const deleted = deletedBy ? DELETED_LATER_BY[deletedBy] : DELETED_LATER
		return formatMarker(isDeleted ? [word, deleted] : [word])
	}
	return formatMarker([`${word}: ${refs.join(', ')}`, ...formatDeletedParts(deletedRefs, groups)])
}

const formatActionGroup = (word: string, entries: HistoryActionEntry[]): string[] => {
	if (entries.length === 0) return []
	const labels = entries.flatMap(({ ref, grams }) => {
		if (ref === null) return []
		return [grams === undefined ? ref : `${ref} → ${Math.round(grams)} g`]
	})
	if (labels.length === 0) return [word]
	const more = labels.length - KUSIK_ACTION_REFS_MAX
	const shown = labels.slice(0, KUSIK_ACTION_REFS_MAX).join(', ')
	return [more > 0 ? `${word} ${shown} +${more}` : `${word} ${shown}`]
}

/** A read digest as one short line of the marker; it is data, so it never gets longer than the backend built it. */
const toReadPart = (digest: string): string =>
	digest.replaceAll(/\s+/g, ' ').trim().slice(0, READ_DIGEST_MAX_CHARS)

const formatFoodActions = (
	word: string,
	foods: readonly HistoryFoodAction[],
	{ isShowingRestored }: { isShowingRestored: boolean },
): string[] =>
	foods.flatMap(({ name, ref, isRestoredLater }) => [
		`${word} "${toShortName(name)}"${ref === null ? '' : ` ${ref}`}`,
		...(isShowingRestored && isRestoredLater ? [RESTORED_LATER] : []),
	])

/**
 * `[Kusik: deleted e13; restored e16; corrected e7 → 45 g; forgot food "Назва" g1; restored later; read workouts 01.11–10.11: 3 (…)]` in front of a
 * reply of Kusik; none without actions or reads.
 */
export const formatKusikMarkers = ({ kusikActions, reads = [] }: HistoryMarkerFields): string[] => {
	const {
		deleted = [],
		restored = [],
		corrected = [],
		forgottenFoods = [],
		restoredFoods = [],
	} = kusikActions ?? {}
	const parts = [
		...formatActionGroup('deleted', deleted),
		...formatActionGroup('restored', restored),
		...formatActionGroup('corrected', corrected),
		...formatFoodActions(FOOD_FORGOTTEN_ACTION, forgottenFoods, { isShowingRestored: true }),
		...formatFoodActions(FOOD_RESTORED_ACTION, restoredFoods, { isShowingRestored: false }),
		...reads
			.slice(-READ_DIGESTS_MAX_PER_TURN)
			.map(toReadPart)
			.filter((part) => part !== ''),
	]
	return parts.length === 0 ? [] : [formatMarker([`${KUSIK_WORD}: ${parts.join('; ')}`])]
}

const toShortName = (name: string): string => {
	const text = toContextText(name)
	return text.length > APP_CHANGE_NAME_MAX_CHARS
		? `${text.slice(0, APP_CHANGE_NAME_MAX_CHARS - 1).trimEnd()}…`
		: text
}

/** `YYYY-MM-DD` → `DD.MM`. */
const toShortDate = (localDate: string): string =>
	`${localDate.slice(8, 10)}.${localDate.slice(5, 7)}`

const formatAppChange = ({ kind, ref, name, localDate }: HistoryAppChange): string =>
	`${kind}${ref === null ? '' : ` ${ref}`} "${toShortName(name)}" (${toShortDate(localDate)})`

/** `[in the app before this message: deleted e9 "Назва" (04.11); edited e7 "Назва" (04.11)]`. */
export const formatAppChangeMarkers = (changes: readonly HistoryAppChange[] = []): string[] =>
	changes.length === 0
		? []
		: [
				formatMarker([
					`${APP_CHANGES_WORD}: ${changes.slice(-APP_CHANGES_MAX).map(formatAppChange).join(', ')}`,
				]),
			]

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
 * The markers of a user turn, kinds in a fixed order: app changes, food, workout, measurements, facts, saved
 * foods. They go first in the turn, so that cutting a long message never drops them.
 */
export const formatHistoryMarkers = (turn: HistoryMarkerFields): string[] => {
	const { loggedRefs = [], hasLoggedEntries = false, workout, measurements = [] } = turn
	const { deletedLoggedRefs = [], areLoggedEntriesDeleted = false } = turn
	const { facts = [], savedFoods = [], appChanges, loggedDeletedBy } = turn
	const markers: string[] = [...formatAppChangeMarkers(appChanges)]
	if (loggedRefs.length > 0 || hasLoggedEntries) {
		markers.push(
			formatLogMarker(
				FOOD_LOGGED_WORD,
				{ refs: loggedRefs, deletedRefs: deletedLoggedRefs, isDeleted: areLoggedEntriesDeleted },
				{
					groups: { byKusik: turn.deletedByKusikLoggedRefs, inApp: turn.deletedInAppLoggedRefs },
					deletedBy: loggedDeletedBy,
				},
			),
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
