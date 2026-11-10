import type { HistoryDeletedBy, HistoryMarkerFields, HistoryTurn } from '@kus/shared'

import { MessageRole } from '../../generated/prisma/client'
import type { MessageWithAttachments } from './chat.repository'
import type { HistoryCorrectionContext } from './history-corrections'
import { sortRefs } from './history-markers'

export interface HistoryTurnOptions {
	/** Ids of the day's entries deleted since. */
	deletedEntryIds?: ReadonlySet<string>
	/** What the message did besides logging food; see `buildHistoryMarkers`. */
	markers?: HistoryMarkerFields
	/** Who deleted the entries and what each turn changed; see `buildCorrectionContext`. */
	corrections?: HistoryCorrectionContext
}

type LoggedFields = Pick<
	HistoryTurn,
	| 'loggedRefs'
	| 'deletedLoggedRefs'
	| 'hasLoggedEntries'
	| 'areLoggedEntriesDeleted'
	| 'deletedByKusikLoggedRefs'
	| 'deletedInAppLoggedRefs'
	| 'loggedDeletedBy'
>

/** Refs of the deleted entries that `deletedBy` says were deleted by `author`; omitted when none. */
const pickDeletedBy = (
	author: HistoryDeletedBy,
	deleted: { ref: string; entryId: string }[],
	deletedBy: ReadonlyMap<string, HistoryDeletedBy>,
): string[] =>
	sortRefs(deleted.filter(({ entryId }) => deletedBy.get(entryId) === author).map(({ ref }) => ref))

/** The one author of all the deletions, or undefined when they differ or one is unknown. */
const getCommonAuthor = (
	entryIds: string[],
	deletedBy: ReadonlyMap<string, HistoryDeletedBy>,
): HistoryDeletedBy | undefined => {
	const [first] = entryIds
	const author = first === undefined ? undefined : deletedBy.get(first)
	return author !== undefined && entryIds.every((entryId) => deletedBy.get(entryId) === author)
		? author
		: undefined
}

/**
 * What a user message logged: the refs (`e1`…, in ref order) of its entries that are in this
 * request's context and which of them are deleted since (and by whom), or just `hasLoggedEntries`
 * when it has entries but none of them has a ref (they fell out of the context window). Entries
 * without a ref next to refs are skipped.
 */
const toLogged = (
	messageId: string,
	refByEntryId: ReadonlyMap<string, string>,
	entryIdsBySourceMessageId: ReadonlyMap<string, string[]>,
	deletedEntryIds: ReadonlySet<string>,
	deletedBy: ReadonlyMap<string, HistoryDeletedBy>,
): LoggedFields => {
	const entryIds = entryIdsBySourceMessageId.get(messageId) ?? []
	const withRefs = entryIds.flatMap((entryId) => {
		const ref = refByEntryId.get(entryId)
		return ref === undefined ? [] : [{ ref, entryId, isDeleted: deletedEntryIds.has(entryId) }]
	})
	if (withRefs.length > 0) {
		const deleted = withRefs.filter(({ isDeleted }) => isDeleted)
		const deletedLoggedRefs = sortRefs(deleted.map(({ ref }) => ref))
		const byKusik = pickDeletedBy('kusik', deleted, deletedBy)
		const inApp = pickDeletedBy('app', deleted, deletedBy)
		return {
			loggedRefs: sortRefs(withRefs.map(({ ref }) => ref)),
			...(deletedLoggedRefs.length > 0 ? { deletedLoggedRefs } : {}),
			...(byKusik.length > 0 ? { deletedByKusikLoggedRefs: byKusik } : {}),
			...(inApp.length > 0 ? { deletedInAppLoggedRefs: inApp } : {}),
		}
	}
	if (entryIds.length === 0) return {}
	const areAllDeleted = entryIds.every((entryId) => deletedEntryIds.has(entryId))
	const author = areAllDeleted ? getCommonAuthor(entryIds, deletedBy) : undefined
	return {
		hasLoggedEntries: true,
		...(areAllDeleted ? { areLoggedEntriesDeleted: true } : {}),
		...(author ? { loggedDeletedBy: author } : {}),
	}
}

const toCorrectionFields = (
	message: MessageWithAttachments,
	isUser: boolean,
	{ kusikActionsByMessageId, appChangesByMessageId }: HistoryCorrectionContext,
): HistoryMarkerFields => {
	if (isUser) {
		const appChanges = appChangesByMessageId.get(message.id)
		return appChanges ? { appChanges } : {}
	}
	// Kusik's reply carries what its user message made it do
	const kusikActions =
		message.replyToId === null ? undefined : kusikActionsByMessageId.get(message.replyToId)
	return kusikActions ? { kusikActions } : {}
}

export const toHistoryTurns = (
	message: MessageWithAttachments,
	refByEntryId: ReadonlyMap<string, string>,
	entryIdsBySourceMessageId: ReadonlyMap<string, string[]>,
	{ deletedEntryIds = new Set(), markers = {}, corrections }: HistoryTurnOptions = {},
): HistoryTurn[] => {
	const isUser = message.role === MessageRole.USER
	const role = isUser ? 'user' : 'assistant'
	const noDeletedBy = new Map<string, HistoryDeletedBy>()
	const fromCorrections = corrections ? toCorrectionFields(message, isUser, corrections) : {}
	const marked: HistoryMarkerFields = isUser
		? {
				...toLogged(
					message.id,
					refByEntryId,
					entryIdsBySourceMessageId,
					deletedEntryIds,
					corrections?.deletedBy ?? noDeletedBy,
				),
				...fromCorrections,
				...markers,
			}
		: fromCorrections
	// the photo itself is never sent again: the model sees a marker next to the words
	if (message.attachments.length > 0) {
		return [{ role, content: message.content ?? '', hasPhoto: true, ...marked }]
	}
	return message.content === null ? [] : [{ role, content: message.content, ...marked }]
}
