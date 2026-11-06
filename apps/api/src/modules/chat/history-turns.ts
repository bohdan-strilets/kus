import type { HistoryMarkerFields, HistoryTurn } from '@kus/shared'

import { MessageRole } from '../../generated/prisma/client'
import type { MessageWithAttachments } from './chat.repository'
import { sortRefs } from './history-markers'

export interface HistoryTurnOptions {
	/** Ids of the day's entries deleted since. */
	deletedEntryIds?: ReadonlySet<string>
	/** What the message did besides logging food; see `buildHistoryMarkers`. */
	markers?: HistoryMarkerFields
}

/**
 * What a user message logged: the refs (`e1`…, in ref order) of its entries that are in this
 * request's context and which of them are deleted since, or just `hasLoggedEntries` when it has
 * entries but none of them has a ref (they fell out of the context window). Entries without a ref
 * next to refs are skipped.
 */
const toLogged = (
	messageId: string,
	refByEntryId: ReadonlyMap<string, string>,
	entryIdsBySourceMessageId: ReadonlyMap<string, string[]>,
	deletedEntryIds: ReadonlySet<string>,
): Pick<
	HistoryTurn,
	'loggedRefs' | 'deletedLoggedRefs' | 'hasLoggedEntries' | 'areLoggedEntriesDeleted'
> => {
	const entryIds = entryIdsBySourceMessageId.get(messageId) ?? []
	const withRefs = entryIds.flatMap((entryId) => {
		const ref = refByEntryId.get(entryId)
		return ref === undefined ? [] : [{ ref, isDeleted: deletedEntryIds.has(entryId) }]
	})
	if (withRefs.length > 0) {
		const deletedLoggedRefs = sortRefs(
			withRefs.filter(({ isDeleted }) => isDeleted).map(({ ref }) => ref),
		)
		return {
			loggedRefs: sortRefs(withRefs.map(({ ref }) => ref)),
			...(deletedLoggedRefs.length > 0 ? { deletedLoggedRefs } : {}),
		}
	}
	if (entryIds.length === 0) return {}
	const areAllDeleted = entryIds.every((entryId) => deletedEntryIds.has(entryId))
	return { hasLoggedEntries: true, ...(areAllDeleted ? { areLoggedEntriesDeleted: true } : {}) }
}

export const toHistoryTurns = (
	message: MessageWithAttachments,
	refByEntryId: ReadonlyMap<string, string>,
	entryIdsBySourceMessageId: ReadonlyMap<string, string[]>,
	{ deletedEntryIds = new Set(), markers = {} }: HistoryTurnOptions = {},
): HistoryTurn[] => {
	const isUser = message.role === MessageRole.USER
	const role = isUser ? 'user' : 'assistant'
	const marked: HistoryMarkerFields = isUser
		? {
				...toLogged(message.id, refByEntryId, entryIdsBySourceMessageId, deletedEntryIds),
				...markers,
			}
		: {}
	// the photo itself is never sent again: the model sees a marker next to the words
	if (message.attachments.length > 0) {
		return [{ role, content: message.content ?? '', hasPhoto: true, ...marked }]
	}
	return message.content === null ? [] : [{ role, content: message.content, ...marked }]
}
