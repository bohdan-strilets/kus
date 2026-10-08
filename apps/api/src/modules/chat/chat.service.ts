import { Injectable, Logger } from '@nestjs/common'
import type { SendMessageRequest, SendMessageResponse } from '@kus/shared'

import { getLocalDate } from '../../common/time'
import { type Message, MessageStatus, Prisma } from '../../generated/prisma/client'
import { AiUsageService } from '../ai/ai-usage.service'
import { AiService } from '../ai/ai.service'
import { MemoryService } from '../memory/memory.service'
import { UsersService } from '../users/users.service'
import { ChatContextService } from './chat-context.service'
import { type EditedMessages, NO_EDITED_MESSAGES } from './chat-edits.service'
import { ChatResponseService } from './chat-response.service'
import { ChatTurnService, type TurnParams } from './chat-turn.service'
import { STALE_PENDING_MS } from './chat.constants'
import { ClientMessageIdReusedException, MessageInProgressException } from './chat.exceptions'
import { ChatRepository } from './chat.repository'

const UNIQUE_VIOLATION = 'P2002'

const isUniqueViolation = (error: unknown): boolean =>
	error instanceof Prisma.PrismaClientKnownRequestError && error.code === UNIQUE_VIOLATION

/** One chat turn: user message → AI → entries / questions / answer, idempotent by clientMessageId. */
@Injectable()
export class ChatService {
	private readonly logger = new Logger(ChatService.name)

	constructor(
		private readonly chatRepository: ChatRepository,
		private readonly chatContext: ChatContextService,
		private readonly chatTurn: ChatTurnService,
		private readonly chatResponse: ChatResponseService,
		private readonly aiService: AiService,
		private readonly aiUsage: AiUsageService,
		private readonly memoryService: MemoryService,
		private readonly usersService: UsersService,
	) {}

	async sendMessage(
		userId: string,
		{ clientMessageId, text }: SendMessageRequest,
	): Promise<SendMessageResponse> {
		const { timezone } = await this.usersService.getMe(userId)
		const message = await this.acquireMessage({ userId, clientMessageId, text })
		const now = new Date()
		const localDate = getLocalDate(now, timezone)

		if (message.status === MessageStatus.COMPLETED) {
			return this.chatResponse.build({
				userId,
				userMessageId: message.id,
				timezone,
				localDate: null,
				edited: NO_EDITED_MESSAGES,
			})
		}
		const edited = await this.processTurn({ userId, timezone, message, text, now, localDate })
		// the day the entries went to, even if the resend happened after midnight
		return this.chatResponse.build({
			userId,
			userMessageId: message.id,
			timezone,
			localDate,
			edited,
		})
	}

	/**
	 * New message → PENDING row. A resend returns the stored one if it's done, takes a FAILED or
	 * lost one for another try, and refuses while the first request is still running.
	 */
	private async acquireMessage(params: {
		userId: string
		clientMessageId: string
		text: string
	}): Promise<Message> {
		const existing = await this.chatRepository.findByClientMessageId(params)
		if (!existing) {
			return this.chatRepository
				.createUserMessage({
					userId: params.userId,
					clientMessageId: params.clientMessageId,
					content: params.text,
				})
				.catch((error: unknown) => {
					// a parallel request with the same clientMessageId created it after our check
					if (isUniqueViolation(error)) throw new MessageInProgressException()
					throw error
				})
		}
		if (existing.content !== params.text) throw new ClientMessageIdReusedException()
		if (existing.status === MessageStatus.COMPLETED) return existing

		const isClaimed = await this.chatRepository.claimForRetry({
			id: existing.id,
			userId: params.userId,
			staleBefore: new Date(Date.now() - STALE_PENDING_MS),
		})
		if (!isClaimed) throw new MessageInProgressException()
		return { ...existing, status: MessageStatus.PENDING }
	}

	private async processTurn(params: TurnParams): Promise<EditedMessages> {
		const { userId, message } = params
		try {
			await this.aiUsage.reserveMessage(userId, params.localDate)
			const memory = await this.memoryService.findRelevantFoods(userId, params.text)
			const { context, refIds } = await this.chatContext.buildContext({
				...params,
				memory: memory.context,
			})
			const decision = await this.aiService.parseFood({
				userId,
				messageId: message.id,
				localDate: params.localDate,
				context,
				text: params.text,
			})
			const edited = await this.chatTurn.saveDecision(params, decision, { memory, refIds })
			this.logger.log(`Chat turn ${decision.kind} user=${userId} message=${message.id}`)
			return edited
		} catch (error) {
			// the client shows "Не надіслано" and resends the same clientMessageId
			await this.chatRepository
				.markFailed({ id: message.id, userId })
				.catch((markError: unknown) => {
					// keep the original error for the client; the message stays PENDING until it goes stale
					this.logger.error(`Could not mark message FAILED message=${message.id}`, markError)
				})
			throw error
		}
	}
}
