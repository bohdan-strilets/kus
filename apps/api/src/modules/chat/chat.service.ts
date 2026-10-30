import { Injectable, Logger } from '@nestjs/common'
import type { SendMessageResponse } from '@kus/shared'

import { formatDbDate, getLocalDate } from '../../common/time'
import { MeasurementKind, MessageStatus, Prisma } from '../../generated/prisma/client'
import { AiUsageService } from '../ai/ai-usage.service'
import { AiService } from '../ai/ai.service'
import { MeasurementsService } from '../measurements/measurements.service'
import { MemoryService } from '../memory/memory.service'
import { UsersService } from '../users/users.service'
import { ChatContextService } from './chat-context.service'
import { NO_EDITED_MESSAGES } from './chat-edits.service'
import { ChatResponseService } from './chat-response.service'
import { ChatTurnService, type TurnParams, type TurnResult } from './chat-turn.service'
import { STALE_PENDING_MS } from './chat.constants'
import { ClientMessageIdReusedException, MessageInProgressException } from './chat.exceptions'
import { ChatPhotosService, type StoredPhotos } from './chat-photos.service'
import { ChatRepository, type MessageWithAttachments } from './chat.repository'
import { PhotoInUseException, PhotoNotFoundException } from '../photos/photos.exceptions'
import type { PhotoPayload } from '../../common/photo'

const UNIQUE_VIOLATION = 'P2002'
const FOREIGN_KEY_VIOLATION = 'P2003'

const hasPrismaCode = (error: unknown, code: string): boolean =>
	error instanceof Prisma.PrismaClientKnownRequestError && error.code === code

export interface SendMessageParams {
	clientMessageId: string
	text?: string
	photo?: PhotoPayload
	/** Earlier POST /photos uploads; excludes `photo`. */
	photoIds?: string[]
}

/** One chat turn: user message → AI → entries / questions / answer, idempotent by clientMessageId. */
@Injectable()
export class ChatService {
	private readonly logger = new Logger(ChatService.name)

	constructor(
		private readonly chatRepository: ChatRepository,
		private readonly chatContext: ChatContextService,
		private readonly chatPhotos: ChatPhotosService,
		private readonly chatTurn: ChatTurnService,
		private readonly chatResponse: ChatResponseService,
		private readonly aiService: AiService,
		private readonly aiUsage: AiUsageService,
		private readonly memoryService: MemoryService,
		private readonly usersService: UsersService,
		private readonly measurementsService: MeasurementsService,
	) {}

	async sendMessage(userId: string, params: SendMessageParams): Promise<SendMessageResponse> {
		const { clientMessageId, text, photoIds } = params
		if (photoIds) this.chatPhotos.assertCount(photoIds)
		const { timezone, addressForm } = await this.usersService.getMe(userId)
		const existing = await this.chatRepository.findByClientMessageId({ userId, clientMessageId })
		if (existing) this.assertSameRequest(existing, params)

		if (existing?.status === MessageStatus.COMPLETED) {
			return this.chatResponse.build({
				userId,
				userMessageId: existing.id,
				timezone,
				localDate: null,
				edited: NO_EDITED_MESSAGES,
			})
		}
		// before the message exists: an unreadable photo must leave nothing to resend around
		const stored = photoIds ? await this.chatPhotos.load(userId, photoIds) : undefined
		const photo = stored?.payload ?? params.photo
		const message = existing
			? await this.claimForRetry(userId, existing, photo)
			: await this.createMessage({ userId, params, stored })
		// the turn's clock is the message's own: a resend after midnight still means "today" as the
		// user saw it when sending. A new message is as old as now (the app clock, not the DB's)
		const now = existing ? message.createdAt : new Date()
		const localDate = getLocalDate(now, timezone)
		const edited = await this.processTurn(
			{ userId, timezone, addressForm, message, text, photo, now, localDate },
			// the daily budget is spent on the day the model is actually called
			getLocalDate(new Date(), timezone),
		)
		// the day of the turn, even if the resend happened after midnight
		return this.chatResponse.build({
			userId,
			userMessageId: message.id,
			timezone,
			localDate,
			edited,
		})
	}

	/** A resend must repeat the message: same words and the same photos, else the id is reused. */
	private assertSameRequest(existing: MessageWithAttachments, params: SendMessageParams): void {
		if (existing.content !== (params.text ?? null)) throw new ClientMessageIdReusedException()
		const fileIds = existing.attachments.map(({ fileId }) => fileId)
		const isSamePhotos = params.photoIds
			? fileIds.length === params.photoIds.length &&
				fileIds.every((fileId, index) => fileId === params.photoIds?.[index])
			: // an inline photo leaves a file-less attachment
				fileIds.length === (params.photo ? 1 : 0) && fileIds.every((fileId) => fileId === null)
		if (!isSamePhotos) throw new ClientMessageIdReusedException()
	}

	/**
	 * New message → PENDING row, with its photos bound in the same write. The unique index on
	 * file_id decides a race for a photo, so there is no "is it free?" read.
	 */
	private async createMessage({
		userId,
		params: { clientMessageId, text, photo, photoIds },
		stored,
	}: {
		userId: string
		params: SendMessageParams
		stored: StoredPhotos | undefined
	}): Promise<MessageWithAttachments> {
		try {
			return await this.chatRepository.createUserMessage({
				userId,
				clientMessageId,
				content: text ?? null,
				photo,
				storedPhotos: stored?.files,
			})
		} catch (error) {
			// the photo was deleted after we read it
			if (photoIds && hasPrismaCode(error, FOREIGN_KEY_VIOLATION))
				throw new PhotoNotFoundException()
			if (!hasPrismaCode(error, UNIQUE_VIOLATION)) throw error
			// P2002 is either our clientMessageId (a parallel twin) or a photo of another message
			const twin = await this.chatRepository.findByClientMessageId({ userId, clientMessageId })
			if (photoIds && !twin) throw new PhotoInUseException()
			throw new MessageInProgressException()
		}
	}

	/** A resend takes a FAILED or lost message for another try, and refuses while the first runs. */
	private async claimForRetry(
		userId: string,
		existing: MessageWithAttachments,
		photo: PhotoPayload | undefined,
	): Promise<MessageWithAttachments> {
		const isClaimed = await this.chatRepository.claimForRetry({
			id: existing.id,
			userId,
			staleBefore: new Date(Date.now() - STALE_PENDING_MS),
		})
		if (!isClaimed) throw new MessageInProgressException()
		if (photo) {
			await this.chatRepository.resetAttachment({
				userId,
				messageId: existing.id,
				// stored photos keep their description; only an inline one is rewritten
				photo: existing.attachments.some(({ fileId }) => fileId !== null) ? undefined : photo,
			})
		}
		return { ...existing, status: MessageStatus.PENDING }
	}

	private async processTurn(params: TurnParams, usageDate: Date): Promise<TurnResult> {
		const { userId, message, photo } = params
		try {
			await this.aiUsage.reserveUsage({
				userId,
				localDate: usageDate,
				hasPhoto: photo !== undefined,
			})
			const memory = await this.memoryService.findRelevantFoods(userId, params.text ?? '')
			const { context, refIds, workoutRefIds, copyRefIds, factRefIds } =
				await this.chatContext.buildContext({
					...params,
					memory: memory.context,
				})
			const decision = await this.aiService.parseFood({
				userId,
				messageId: message.id,
				localDate: params.localDate,
				context,
				findPreviousWeight: async (localDate) => {
					const previous = await this.measurementsService.findBefore({
						userId,
						kind: MeasurementKind.WEIGHT,
						before: new Date(`${localDate}T00:00:00Z`),
					})
					return previous
						? { value: previous.value, localDate: formatDbDate(previous.localDate) }
						: null
				},
				text: params.text ?? '',
				// the only place the bytes become base64: it goes straight into the request body
				image: photo
					? { mimeType: photo.mimeType, base64: photo.bytes.toString('base64') }
					: undefined,
			})
			const edited = await this.chatTurn.saveDecision(params, decision, {
				memory,
				refIds,
				workoutRefIds,
				copyRefIds,
				factRefIds,
			})
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
