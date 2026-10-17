import type { HistoryTurn } from '@kus/shared'

import { MessageRole } from '../../generated/prisma/client'
import type { MessageWithAttachments } from './chat.repository'

const getRefNumber = (ref: string): number => Number(ref.slice(1))

/**
 * What a user message logged: the refs (`e1`…, in ref order) of its entries that are in this
 * request's context, or just `hasLoggedEntries` when it has entries but none of them has a ref
 * (they fell out of the context window). Entries without a ref next to refs are skipped.
 */
const toLogged = (
	messageId: string,
	refByEntryId: ReadonlyMap<string, string>,
	entryIdsBySourceMessageId: ReadonlyMap<string, string[]>,
): Pick<HistoryTurn, 'loggedRefs' | 'hasLoggedEntries'> => {
	const entryIds = entryIdsBySourceMessageId.get(messageId) ?? []
	const loggedRefs = entryIds
		.flatMap((entryId) => refByEntryId.get(entryId) ?? [])
		.sort((a, b) => getRefNumber(a) - getRefNumber(b))
	if (loggedRefs.length > 0) return { loggedRefs }
	return entryIds.length > 0 ? { hasLoggedEntries: true } : {}
}

export const toHistoryTurns = (
	message: MessageWithAttachments,
	refByEntryId: ReadonlyMap<string, string>,
	entryIdsBySourceMessageId: ReadonlyMap<string, string[]>,
): HistoryTurn[] => {
	const isUser = message.role === MessageRole.USER
	const role = isUser ? 'user' : 'assistant'
	const logged = isUser ? toLogged(message.id, refByEntryId, entryIdsBySourceMessageId) : {}
	// the photo itself is never sent again: the model sees a marker next to the words
	if (message.attachments.length > 0) {
		return [{ role, content: message.content ?? '', hasPhoto: true, ...logged }]
	}
	return message.content === null ? [] : [{ role, content: message.content, ...logged }]
}
