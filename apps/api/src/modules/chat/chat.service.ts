import { Injectable, Logger } from '@nestjs/common'
import {
	type OnboardingAnswerRequest,
	type SendMessageResponse,
	TRAINING_ONBOARDING_LAST_QUESTION,
} from '@kus/shared'

import { formatDbDate, getLocalDate } from '../../common/time'
import { MeasurementKind, MessageStatus, Prisma } from '../../generated/prisma/client'
import { AiUsageService } from '../ai/ai-usage.service'
import { AiService, type ParseFoodParams } from '../ai/ai.service'
import { MeasurementsService } from '../measurements/measurements.service'
import { MemoryService } from '../memory/memory.service'
import { UsersService } from '../users/users.service'
import { ChatContextService } from './chat-context.service'
import { NO_EDITED_MESSAGES } from './chat-edits.service'
import { ChatReadToolsService } from './chat-read-tools.service'
import { ChatResponseService } from './chat-response.service'
import {
	ChatTrainingOnboardingService,
	type OnboardingRoute,
} from './chat-training-onboarding.service'
import { ChatTrainingOnboardingAnswersService } from './chat-training-onboarding-answers.service'
import { ChatTurnService, type TurnParams, type TurnResult } from './chat-turn.service'
import { ChatWorkoutSummaryService } from './chat-workout-summary.service'
import { STALE_PENDING_MS } from './chat.constants'
import {
	ClientMessageIdReusedException,
	MessageInProgressException,
	TrainingOnboardingClosedException,
} from './chat.exceptions'
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
	/** A button of the training onboarding; `text` holds its label(s). */
	onboardingAnswer?: OnboardingAnswerRequest
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
		private readonly trainingOnboarding: ChatTrainingOnboardingService,
		private readonly onboardingAnswers: ChatTrainingOnboardingAnswersService,
		private readonly workoutSummary: ChatWorkoutSummaryService,
		private readonly readTools: ChatReadToolsService,
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
		// before the message exists: a closed question or an unreadable photo must leave nothing to resend
		const route = await this.trainingOnboarding.route(userId, {
			text,
			hasPhotos: params.photo !== undefined || photoIds !== undefined,
			button: params.onboardingAnswer,
		})
		const stored = photoIds ? await this.chatPhotos.load(userId, photoIds) : undefined
		const photo = stored?.payload ?? params.photo
		const message = existing
			? await this.claimForRetry(userId, existing, photo)
			: await this.createMessage({ userId, params, stored })
		// the turn's clock is the message's own: a resend after midnight still means "today" as the
		// user saw it when sending. A new message is as old as now (the app clock, not the DB's)
		const now = existing ? message.createdAt : new Date()
		const localDate = getLocalDate(now, timezone)
		const edited = await this.runTurn(
			{ userId, timezone, addressForm, message, text, photo, now, localDate },
			// the daily budget is spent on the day the model is actually called
			getLocalDate(new Date(), timezone),
			route,
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

	/**
	 * An answer to questions 1–4 is the backend's alone (no model, no daily AI budget); the last
	 * answer and anything else is a model turn. The question it answered or passed by comes back
	 * among the updated messages, with its new state.
	 */
	private async runTurn(
		params: TurnParams,
		usageDate: Date,
		{ answer, passedQuestionId }: OnboardingRoute,
	): Promise<TurnResult> {
		if (answer && answer.step !== TRAINING_ONBOARDING_LAST_QUESTION) {
			await this.answerOnboarding(params, answer)
			return {
				...NO_EDITED_MESSAGES,
				replyIds: [answer.questionId],
				replacedMeasurementMessageIds: [],
			}
		}
		const result = await this.processTurn(
			{ ...params, onboardingAnswer: answer ?? undefined },
			usageDate,
		)
		const questionId = answer?.questionId ?? passedQuestionId
		return questionId ? { ...result, replyIds: [...result.replyIds, questionId] } : result
	}

	private async answerOnboarding(
		{ userId, message }: TurnParams,
		answer: NonNullable<OnboardingRoute['answer']>,
	): Promise<void> {
		try {
			await this.onboardingAnswers.answerWithoutModel({ userId, userMessageId: message.id }, answer)
			this.logger.log(
				`Training onboarding answer step=${answer.step} user=${userId} message=${message.id}`,
			)
		} catch (error) {
			await this.markFailed(message)
			throw error
		}
	}

	private async processTurn(params: TurnParams, usageDate: Date): Promise<TurnResult> {
		const { userId, message, photo, onboardingAnswer } = params
		const turnStartedAt = Date.now()
		try {
			// the last onboarding answer asks the model for a program from all five; before the usage is
			// reserved and before any model call, a run with a missing answer ends as closed
			const programOnboarding = onboardingAnswer
				? await this.onboardingAnswers.formatAnswers(userId, onboardingAnswer)
				: undefined
			if (programOnboarding === null) throw new TrainingOnboardingClosedException()
			await this.aiUsage.reserveUsage({
				userId,
				localDate: usageDate,
				hasPhoto: photo !== undefined,
			})
			const memory = await this.memoryService.findRelevantFoods(userId, params.text ?? '')
			// a live session left alone for more than 3 h is closed before the model reads «Today's
			// workouts», so the message never appends to it; its summary is a message of its own
			const autoClosed = await this.workoutSummary.closeIdleLive({ userId, now: params.now })
			const autoClosedSummaryId = autoClosed?.messageId ?? null
			const { context, refIds, workoutRefIds, copyRefIds, factRefIds, templateRefIds } =
				await this.chatContext.buildContext({
					...params,
					memory: memory.context,
					foodRefById: new Map([...memory.byRef].map(([ref, food]) => [food.id, ref])),
					...(programOnboarding ? { programOnboarding } : {}),
				})
			// the model's reads extend these two maps, and the decision is saved with the same ones
			const turnCopyRefIds = new Map(copyRefIds)
			const parseParams: ParseFoodParams = {
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
				readTools: this.readTools.createExecutor({ memory, copyRefIds: turnCopyRefIds }),
				// the only place the bytes become base64: it goes straight into the request body
				image: photo
					? { mimeType: photo.mimeType, base64: photo.bytes.toString('base64') }
					: undefined,
			}
			const decision = await this.aiService.parseFood(parseParams)
			const edited = await this.chatTurn.saveDecision(params, decision, {
				memory,
				refIds,
				workoutRefIds,
				copyRefIds: turnCopyRefIds,
				factRefIds,
				templateRefIds,
				turnStartedAt,
				requestStatsAdvice:
					decision.kind === 'stats' && decision.advice
						? (card, deadlineMs) =>
								this.aiService.requestStatsAdvice({
									params: parseParams,
									stats: decision,
									card,
									deadlineMs,
								})
						: undefined,
			})
			this.logger.log(`Chat turn ${decision.kind} user=${userId} message=${message.id}`)
			if (autoClosedSummaryId === null) return edited
			// the response carries the new summary among the changed messages
			return { ...edited, sourceMessageIds: [...edited.sourceMessageIds, autoClosedSummaryId] }
		} catch (error) {
			await this.markFailed(message)
			throw error
		}
	}

	/** The client shows "Не надіслано" and resends the same clientMessageId. */
	private async markFailed({ id, userId }: MessageWithAttachments): Promise<void> {
		await this.chatRepository.markFailed({ id, userId }).catch((markError: unknown) => {
			// keep the original error for the client; the message stays PENDING until it goes stale
			this.logger.error(`Could not mark message FAILED message=${id}`, markError)
		})
	}
}
