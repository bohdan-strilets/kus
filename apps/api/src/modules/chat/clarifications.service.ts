import { Injectable, Logger } from '@nestjs/common'
import {
	type ChatMessage,
	type ClarifyOption,
	clarifyOptionSchema,
	type OptionValues,
} from '@kus/shared'
import { z } from 'zod'

import { ClarificationStatus, type Prisma } from '../../generated/prisma/client'
import { PrismaService } from '../../prisma'
import { EntryEditsService } from '../entries/entry-edits.service'
import { ChatFeedService } from './chat-feed.service'
import {
	ClarificationAlreadyAnsweredException,
	ClarificationNotApplicableException,
	ClarificationNotFoundException,
	OptionIndexOutOfRangeException,
} from './chat.exceptions'
import { ChatRepository } from './chat.repository'
import { ClarificationsRepository } from './clarifications.repository'

const storedOptionsSchema = z.array(clarifyOptionSchema)

export interface ClarificationAnswer {
	userId: string
	id: string
	/** A tapped or named option; null = values in words, or none (closing without a change). */
	optionIndex: number | null
	values: OptionValues | null
	/** The user's words; null for a tap (the option label is stored). */
	answer: string | null
	/** The chat message that answered in words; null for a tap. */
	answerMessageId: string | null
}

/** Answers to clarify questions: a tap (no model call) or words in the chat, through the same path. */
@Injectable()
export class ClarificationsService {
	private readonly logger = new Logger(ClarificationsService.name)

	constructor(
		private readonly prisma: PrismaService,
		private readonly chatRepository: ChatRepository,
		private readonly clarificationsRepository: ClarificationsRepository,
		private readonly chatFeed: ChatFeedService,
		private readonly entryEdits: EntryEditsService,
	) {}

	/** Returns the assistant message that asked, with its updated meal card. */
	async answer(
		userId: string,
		{ id, optionIndex }: { id: string; optionIndex: number },
	): Promise<ChatMessage> {
		const messageId = await this.prisma.$transaction((tx) =>
			this.applyAnswer(
				{ userId, id, optionIndex, values: null, answer: null, answerMessageId: null },
				tx,
			),
		)
		this.logger.log(`Clarification answered user=${userId} clarification=${id}`)

		const message = await this.chatRepository.findById({ userId, id: messageId })
		// read right after its clarification; messages are never deleted one by one
		if (!message) throw new Error('Clarification lost its message')
		const [response] = await this.chatFeed.toChatMessages(userId, [message])
		if (!response) throw new Error('Chat message lost while mapping')
		return response
	}

	/**
	 * Applies an answer inside the caller's tx and closes the question. Returns the id of the
	 * assistant message that asked it.
	 */
	async applyAnswer(
		{ userId, id, optionIndex, values, answer, answerMessageId }: ClarificationAnswer,
		tx: Prisma.TransactionClient,
	): Promise<string> {
		// scoped by userId: a question of another user is "not found", never "forbidden"
		const clarification = await this.clarificationsRepository.findClarification({ userId, id }, tx)
		if (!clarification) throw new ClarificationNotFoundException()
		if (clarification.status !== ClarificationStatus.OPEN) {
			throw new ClarificationAlreadyAnsweredException()
		}
		const option = optionIndex === null ? null : this.getOption(clarification.options, optionIndex)
		const applied = option ?? values
		if (applied) {
			const isApplied = await this.entryEdits.applyOptionValues(
				{
					userId,
					entryIds: clarification.entries.map((entry) => entry.foodEntryId),
					values: applied,
					name: option?.name ?? null,
				},
				tx,
			)
			if (!isApplied) throw new ClarificationNotApplicableException()
		}
		const label = answer ?? option?.label
		// a tap always has an option; words always have their text
		if (label === undefined) throw new Error('Clarification answer has neither words nor an option')
		const isMarked = await this.clarificationsRepository.markClarificationAnswered(
			{ userId, id, optionIndex, answer: label, answerMessageId },
			tx,
		)
		if (!isMarked) throw new ClarificationAlreadyAnsweredException()
		return clarification.messageId
	}

	private getOption(stored: Prisma.JsonValue, optionIndex: number): ClarifyOption {
		// questions stored before options carried macros can't be applied without the model
		const options = storedOptionsSchema.safeParse(stored)
		if (!options.success) throw new ClarificationNotApplicableException()
		const option = options.data[optionIndex]
		if (!option) throw new OptionIndexOutOfRangeException()
		return option
	}
}
