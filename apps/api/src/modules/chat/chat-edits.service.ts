import { Injectable } from '@nestjs/common'
import type { EntryEdits } from '@kus/shared'

import type { Prisma } from '../../generated/prisma/client'
import { EntryEditsService } from '../entries/entry-edits.service'
import { ClarificationsRepository } from './clarifications.repository'
import { ClarificationsService } from './clarifications.service'
import type { EditRefIds } from './edit-context'

/** Messages whose cards an edit changed: the user messages the entries came from, the replies that asked. */
export interface EditedMessages {
	sourceMessageIds: string[]
	replyIds: string[]
}

export const NO_EDITED_MESSAGES: EditedMessages = { sourceMessageIds: [], replyIds: [] }

/** Refs were checked against this same map by the parser; a miss is a bug, not user input. */
const toId = (refIds: ReadonlyMap<string, string>, ref: string): string => {
	const id = refIds.get(ref)
	if (id === undefined) throw new Error(`Edit ref ${ref} is not in the request context`)
	return id
}

/** Applies what the model changed in earlier entries, inside the turn's transaction. */
@Injectable()
export class ChatEditsService {
	constructor(
		private readonly entryEdits: EntryEditsService,
		private readonly clarifications: ClarificationsService,
		private readonly clarificationsRepository: ClarificationsRepository,
	) {}

	async applyEdits(
		{
			userId,
			userMessageId,
			edits,
			refIds,
		}: { userId: string; userMessageId: string; edits: EntryEdits; refIds: EditRefIds },
		tx: Prisma.TransactionClient,
	): Promise<EditedMessages> {
		const replyIds: string[] = []
		// answers first: they apply to the entries as the question saw them
		for (const resolution of edits.resolutions) {
			const replyId = await this.clarifications.applyAnswer(
				{
					userId,
					id: toId(refIds.clarifications, resolution.ref),
					optionIndex: resolution.optionIndex,
					values: resolution.values,
					answer: resolution.answer,
					answerMessageId: userMessageId,
				},
				tx,
			)
			replyIds.push(replyId)
		}
		const corrections = edits.corrections.map((change) => ({
			id: toId(refIds.entries, change.ref),
			change,
		}))
		const deletedIds = edits.deletions.map((ref) => toId(refIds.entries, ref))
		const corrected = await this.entryEdits.correctEntries({ userId, corrections }, tx)
		const deleted = await this.entryEdits.deleteEntries({ userId, ids: deletedIds }, tx)
		// the entry changed in words: its old options no longer fit (answered ones are not OPEN)
		const dismissedReplyIds = await this.clarificationsRepository.dismissOpenClarifications(
			{ userId, entryIds: [...corrections.map(({ id }) => id), ...deletedIds] },
			tx,
		)
		const restored = await this.entryEdits.restoreEntries(
			{ userId, ids: edits.restorations.map((ref) => toId(refIds.deletedEntries, ref)) },
			tx,
		)
		return {
			sourceMessageIds: [...new Set([...corrected, ...deleted, ...restored])],
			replyIds: [...new Set([...replyIds, ...dismissedReplyIds])],
		}
	}
}
