import { Injectable, Logger } from '@nestjs/common'
import {
	type ProgramCard,
	programCardSchema,
	type ProgramResponse,
	type RebaseProgramProposalResponse,
} from '@kus/shared'

import type { Prisma } from '../../generated/prisma/client'
import { PrismaService } from '../../prisma'
import { ProgramProposalsService } from '../programs/program-proposals.service'
import {
	ProgramNotFoundException,
	ProgramProposalInvalidException,
	ProgramProposalNotFoundException,
	ProgramProposalReplacedException,
	ProgramVersionConflictException,
} from '../programs/programs.exceptions'
import { ProgramsService } from '../programs/programs.service'
import { ChatFeedService } from './chat-feed.service'
import { PROGRAM_REBASED_REPLY, PROGRAM_UNCHANGED_REPLY } from './chat.constants'
import { ChatRepository } from './chat.repository'
import { ProgramCardMessagesRepository } from './program-card-messages.repository'

/** «Прийняти» and «Перерахувати» on a program card of the chat. */
@Injectable()
export class ChatProgramProposalsService {
	private readonly logger = new Logger(ChatProgramProposalsService.name)

	constructor(
		private readonly prisma: PrismaService,
		private readonly cardMessages: ProgramCardMessagesRepository,
		private readonly chatRepository: ChatRepository,
		private readonly chatFeed: ChatFeedService,
		private readonly programProposals: ProgramProposalsService,
		private readonly programsService: ProgramsService,
	) {}

	/**
	 * One transaction: the card (the owner's, the newest, not accepted yet) becomes a version. The
	 * plaque «Прийнято» and «Відкрити програму» come from the card's derived state; no new message.
	 */
	async accept(userId: string, messageId: string): Promise<ProgramResponse> {
		try {
			await this.prisma.$transaction(async (tx) => {
				const card = await this.loadOpenCard(userId, messageId, tx)
				await this.programProposals.accept(userId, { messageId, card }, tx)
			})
		} catch (error) {
			// a parallel second accept loses on the program's base check before the unique source id
			if (error instanceof ProgramVersionConflictException) {
				await this.programProposals.assertNotAccepted(userId, messageId)
			}
			throw error
		}
		this.logger.log(`Program proposal accepted user=${userId} message=${messageId}`)
		const program = await this.programsService.getActive(userId)
		// a parallel removal right after the accept
		if (!program) throw new ProgramNotFoundException()
		return program
	}

	/**
	 * The same program recounted against the current version, without the model: a new Kusik message
	 * with the new card (the old one becomes REPLACED), or only the text when nothing would change.
	 */
	async rebase(userId: string, messageId: string): Promise<RebaseProgramProposalResponse> {
		const newId = await this.prisma.$transaction(async (tx) => {
			// two parallel recounts: the second one waits, then finds a newer card and ends as REPLACED
			await this.cardMessages.lockCards(userId, tx)
			const card = await this.loadOpenCard(userId, messageId, tx)
			const next = await this.programProposals.rebuildCard(userId, card.program, tx)
			const { id } = await this.cardMessages.create(
				next
					? { userId, content: PROGRAM_REBASED_REPLY, programCard: next }
					: { userId, content: PROGRAM_UNCHANGED_REPLY },
				tx,
			)
			return id
		})
		this.logger.log(`Program proposal rebased user=${userId} message=${messageId} new=${newId}`)
		const [created, previous] = await Promise.all([
			this.chatRepository.findById({ userId, id: newId }),
			this.chatRepository.findById({ userId, id: messageId }),
		])
		if (!created || !previous) throw new ProgramProposalNotFoundException()
		const [message, previousMessage] = await this.chatFeed.toChatMessages(userId, [
			created,
			previous,
		])
		if (!message || !previousMessage) throw new ProgramProposalNotFoundException()
		return { message, previousMessage }
	}

	/** 404 not the owner's card, 422 unreadable, 409 replaced by a newer card or already accepted. */
	private async loadOpenCard(
		userId: string,
		messageId: string,
		tx: Prisma.TransactionClient,
	): Promise<ProgramCard> {
		const message = await this.cardMessages.findCardMessage({ userId, id: messageId }, tx)
		if (!message) throw new ProgramProposalNotFoundException()
		const parsed = programCardSchema.safeParse(message.programCard)
		if (!parsed.success) {
			this.logger.warn(`Unreadable program card message=${messageId}`)
			throw new ProgramProposalInvalidException()
		}
		if ((await this.cardMessages.findNewestCardMessageId(userId, tx)) !== messageId) {
			throw new ProgramProposalReplacedException()
		}
		await this.programProposals.assertNotAccepted(userId, messageId, tx)
		return parsed.data
	}
}
