import { Injectable, Logger } from '@nestjs/common'
import { type ChatMessage, clarifyOptionSchema } from '@kus/shared'
import { z } from 'zod'

import { ClarificationStatus } from '../../generated/prisma/client'
import { PrismaService } from '../../prisma'
import { EntriesService } from '../entries/entries.service'
import { ChatFeedService } from './chat-feed.service'
import {
	ClarificationAlreadyAnsweredException,
	ClarificationNotApplicableException,
	ClarificationNotFoundException,
	OptionIndexOutOfRangeException,
} from './chat.exceptions'
import { ChatRepository } from './chat.repository'

const storedOptionsSchema = z.array(clarifyOptionSchema)

/** A tap on a clarify answer: the entries take its values, no model call (deterministic). */
@Injectable()
export class ClarificationsService {
	private readonly logger = new Logger(ClarificationsService.name)

	constructor(
		private readonly prisma: PrismaService,
		private readonly chatRepository: ChatRepository,
		private readonly chatFeed: ChatFeedService,
		private readonly entriesService: EntriesService,
	) {}

	/** Returns the assistant message that asked, with its updated meal card. */
	async answer(
		userId: string,
		{ id, optionIndex }: { id: string; optionIndex: number },
	): Promise<ChatMessage> {
		const messageId = await this.prisma.$transaction(async (tx) => {
			// scoped by userId: a question of another user is "not found", never "forbidden"
			const clarification = await this.chatRepository.findClarification({ userId, id }, tx)
			if (!clarification) throw new ClarificationNotFoundException()
			if (clarification.status !== ClarificationStatus.OPEN) {
				throw new ClarificationAlreadyAnsweredException()
			}
			// questions stored before options carried macros can't be applied without the model
			const options = storedOptionsSchema.safeParse(clarification.options)
			if (!options.success) throw new ClarificationNotApplicableException()
			const option = options.data[optionIndex]
			if (!option) throw new OptionIndexOutOfRangeException()

			const isApplied = await this.entriesService.applyOptionValues(
				{
					userId,
					entryIds: clarification.entries.map((entry) => entry.foodEntryId),
					option,
				},
				tx,
			)
			if (!isApplied) throw new ClarificationNotApplicableException()
			const isMarked = await this.chatRepository.markClarificationAnswered(
				{ userId, id, optionIndex, label: option.label },
				tx,
			)
			if (!isMarked) throw new ClarificationAlreadyAnsweredException()
			return clarification.messageId
		})
		this.logger.log(`Clarification answered user=${userId} clarification=${id}`)

		const message = await this.chatRepository.findById({ userId, id: messageId })
		// read right after its clarification; messages are never deleted one by one
		if (!message) throw new Error('Clarification lost its message')
		const [response] = await this.chatFeed.toChatMessages(userId, [message])
		if (!response) throw new Error('Chat message lost while mapping')
		return response
	}
}
