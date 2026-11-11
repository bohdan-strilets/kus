import type {
	HistoryActionEntry,
	HistoryAppChange,
	HistoryDeletedBy,
	HistoryKusikActions,
} from '@kus/shared'

import { MessageRole } from '../../generated/prisma/client'
import type { HistoryFoodActions } from './chat-history-markers.service'
import type { HistoryCorrection } from '../entries/history-correction'

/** Most changes made in the app shown in front of one message (the newest ones). */
export const APP_CHANGES_MAX = 5

/** The messages of the history the corrections are placed against; `current` is the one being answered. */
export interface HistoryCorrectionInput {
	corrections: readonly HistoryCorrection[]
	/** Oldest first. */
	history: readonly { id: string; role: MessageRole; createdAt: Date }[]
	current: { id: string; createdAt: Date }
	/** Entry id → `e…` of this request (active and deleted entries of its window). */
	refByEntryId: ReadonlyMap<string, string>
	/** User message id → the saved foods Kusik removed or brought back answering it. */
	foodActionsByMessageId?: ReadonlyMap<string, HistoryFoodActions>
}

export interface HistoryCorrectionContext {
	/** Entry id → who deleted it; an entry without a Correction is absent (origin unknown). */
	deletedBy: ReadonlyMap<string, HistoryDeletedBy>
	/** User message id → what Kusik did in the turn it started. */
	kusikActionsByMessageId: ReadonlyMap<string, HistoryKusikActions>
	/** User message id (also the current one) → what the user changed in the app before it. */
	appChangesByMessageId: ReadonlyMap<string, HistoryAppChange[]>
}

/** What a series of corrections left of one entry. */
interface EntryOutcome {
	entryId: string
	/** The last delete / restore; null when the series has neither. */
	isDeleted: boolean | null
	isEdited: boolean
	grams: number | null
	name: string
	localDate: string
	lastAt: number
}

/** Corrections oldest first → one outcome per entry, ordered by the entry's last change. */
const foldByEntry = (corrections: readonly HistoryCorrection[]): EntryOutcome[] => {
	const outcomes = new Map<string, EntryOutcome>()
	for (const { entryId, kind, grams, name, localDate, createdAt } of corrections) {
		const outcome = outcomes.get(entryId) ?? {
			entryId,
			isDeleted: null,
			isEdited: false,
			grams: null,
			name,
			localDate,
			lastAt: 0,
		}
		if (kind === 'edited') {
			outcome.isEdited = true
			outcome.grams = grams ?? outcome.grams
		} else {
			outcome.isDeleted = kind === 'deleted'
		}
		outcome.lastAt = createdAt.getTime()
		outcomes.set(entryId, outcome)
	}
	return [...outcomes.values()].sort((a, b) => a.lastAt - b.lastAt)
}

const getRefNumber = (ref: string | null): number =>
	ref === null ? Number.POSITIVE_INFINITY : Number(ref.slice(1))

const byRef = (a: HistoryActionEntry, b: HistoryActionEntry): number =>
	getRefNumber(a.ref) - getRefNumber(b.ref)

const toKusikActions = (
	corrections: readonly HistoryCorrection[],
	refByEntryId: ReadonlyMap<string, string>,
): HistoryKusikActions | undefined => {
	const actions: HistoryKusikActions = { deleted: [], restored: [], corrected: [] }
	for (const { entryId, isDeleted, isEdited, grams } of foldByEntry(corrections)) {
		const ref = refByEntryId.get(entryId) ?? null
		if (isDeleted === true) actions.deleted.push({ ref })
		if (isDeleted === false) actions.restored.push({ ref })
		if (isEdited && isDeleted !== true) {
			actions.corrected.push(grams === null ? { ref } : { ref, grams })
		}
	}
	actions.deleted.sort(byRef)
	actions.restored.sort(byRef)
	actions.corrected.sort(byRef)
	const isEmpty = !actions.deleted.length && !actions.restored.length && !actions.corrected.length
	return isEmpty ? undefined : actions
}

/** Deleted or edited in the app; a delete undone in the same stretch is nothing. Oldest first, the newest few. */
const toAppChanges = (
	corrections: readonly HistoryCorrection[],
	refByEntryId: ReadonlyMap<string, string>,
): HistoryAppChange[] =>
	foldByEntry(corrections)
		.flatMap(({ entryId, isDeleted, isEdited, name, localDate }): HistoryAppChange[] => {
			const kind =
				isDeleted === true ? 'deleted' : isEdited && isDeleted !== false ? 'edited' : null
			return kind === null
				? []
				: [{ kind, ref: refByEntryId.get(entryId) ?? null, name, localDate }]
		})
		.slice(-APP_CHANGES_MAX)

const groupBy = <T>(items: readonly T[], getKey: (item: T) => string): Map<string, T[]> => {
	const grouped = new Map<string, T[]>()
	for (const item of items) {
		const key = getKey(item)
		grouped.set(key, [...(grouped.get(key) ?? []), item])
	}
	return grouped
}

/**
 * Who deleted what and what each turn did, from the Corrections: the user's delete button writes
 * a Correction without a message, a tool call of the chat writes the user message that caused it.
 */
export const buildCorrectionContext = ({
	corrections,
	history,
	current,
	refByEntryId,
	foodActionsByMessageId = new Map(),
}: HistoryCorrectionInput): HistoryCorrectionContext => {
	const deletedBy = new Map<string, HistoryDeletedBy>()
	for (const { entryId, kind, messageId } of corrections) {
		if (kind === 'deleted') deletedBy.set(entryId, messageId === null ? 'app' : 'kusik')
		// restored since: the next delete decides, and the entry is not deleted now anyway
		if (kind === 'restored') deletedBy.delete(entryId)
	}

	const byMessage = groupBy(
		corrections.filter(({ messageId }) => messageId !== null),
		({ messageId }) => messageId ?? '',
	)
	const kusikActionsByMessageId = new Map<string, HistoryKusikActions>()
	for (const { id, role } of history) {
		if (role !== MessageRole.USER) continue
		const entryActions = toKusikActions(byMessage.get(id) ?? [], refByEntryId)
		const foodActions = foodActionsByMessageId.get(id)
		if (!entryActions && !foodActions) continue
		kusikActionsByMessageId.set(id, {
			deleted: [],
			restored: [],
			corrected: [],
			...entryActions,
			...foodActions,
		})
	}

	const appCorrections = corrections.filter(({ messageId }) => messageId === null)
	const appChangesByMessageId = new Map<string, HistoryAppChange[]>()
	const sequence = [...history, { ...current, role: MessageRole.USER }]
	sequence.forEach((message, index) => {
		const previous = sequence[index - 1]
		// the first message has no known predecessor: nothing to place the changes against
		if (message.role !== MessageRole.USER || !previous) return
		const from = previous.createdAt.getTime()
		const to = message.createdAt.getTime()
		const changes = toAppChanges(
			appCorrections.filter(
				({ createdAt }) => createdAt.getTime() > from && createdAt.getTime() <= to,
			),
			refByEntryId,
		)
		if (changes.length > 0) appChangesByMessageId.set(message.id, changes)
	})

	return { deletedBy, kusikActionsByMessageId, appChangesByMessageId }
}
