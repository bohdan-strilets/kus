import { Injectable, Logger } from '@nestjs/common'
import type { ProgramCard, ProgramCardState } from '@kus/shared'

import { ProgramProposalsService } from '../programs/program-proposals.service'
import { readStoredProgramCard } from './program-card'
import { ProgramCardMessagesRepository } from './program-card-messages.repository'

export interface ProgramCardView {
	card: ProgramCard
	state: ProgramCardState
}

/** The program cards of the chat with their state, derived on every read (the payload never changes). */
@Injectable()
export class ChatProgramCardsService {
	private readonly logger = new Logger(ChatProgramCardsService.name)

	constructor(
		private readonly cardMessages: ProgramCardMessagesRepository,
		private readonly programProposals: ProgramProposalsService,
	) {}

	async getByMessages(
		userId: string,
		messages: readonly { id: string; programCard: unknown }[],
	): Promise<Map<string, ProgramCardView>> {
		const cards = new Map<string, ProgramCard>()
		for (const { id, programCard } of messages) {
			const { card, isUnreadable } = readStoredProgramCard(programCard)
			// a snapshot that no longer parses is dropped (the text stays), without its content in the log
			if (isUnreadable) this.logger.warn(`Unreadable program card message=${id}`)
			if (card) cards.set(id, card)
		}
		const views = new Map<string, ProgramCardView>()
		if (cards.size === 0) return views
		const newestId = await this.cardMessages.findNewestCardMessageId(userId)
		const states = await this.programProposals.getCardStates(
			userId,
			[...cards].map(([messageId, card]) => ({ messageId, baseVersionId: card.baseVersionId })),
			newestId,
		)
		for (const [messageId, card] of cards) {
			const state = states.get(messageId)
			if (state) views.set(messageId, { card, state })
		}
		return views
	}

	/** The user's newest card while it is OPEN: the proposal the model builds the next change on. */
	async findOpenCard(userId: string): Promise<ProgramCard | null> {
		const newestId = await this.cardMessages.findNewestCardMessageId(userId)
		if (newestId === null) return null
		const message = await this.cardMessages.findCardMessage({ userId, id: newestId })
		if (!message) return null
		const { card, isUnreadable } = readStoredProgramCard(message.programCard)
		if (isUnreadable) this.logger.warn(`Unreadable program card message=${newestId}`)
		if (!card) return null
		const states = await this.programProposals.getCardStates(
			userId,
			[{ messageId: newestId, baseVersionId: card.baseVersionId }],
			newestId,
		)
		return states.get(newestId)?.status === 'OPEN' ? card : null
	}
}
