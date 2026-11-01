import { Injectable, Logger } from '@nestjs/common'
import {
	isTrainingOnboardingQuestion,
	isValidOnboardingAnswer,
	type OnboardingAnswerRequest,
	TRAINING_ONBOARDING_FIRST_QUESTION,
} from '@kus/shared'

import type { Prisma } from '../../generated/prisma/client'
import { PrismaService } from '../../prisma'
import { ProfileService } from '../profile/profile.service'
import {
	TrainingOnboardingAnswerInvalidException,
	TrainingOnboardingClosedException,
	TrainingOnboardingNotFoundException,
} from './chat.exceptions'
import { matchOnboardingAnswer } from './training-onboarding-match'
import {
	type OnboardingMessageRow,
	TrainingOnboardingMessagesRepository,
} from './training-onboarding-messages.repository'
import { type OnboardingAnswer, toQuestion } from './training-onboarding-question'
import { deriveOnboardingState, readStoredOnboarding } from './training-onboarding-state'

/** What a user message means for the onboarding: an answer, or words that pass an open question by. */
export interface OnboardingRoute {
	answer: OnboardingAnswer | null
	/** The open question the message passes by (it becomes CLOSED); null when there is none. */
	passedQuestionId: string | null
}

const NO_ROUTE: OnboardingRoute = { answer: null, passedQuestionId: null }
/** The onboarding of trainings in the chat: Kusik asks, the backend reads the answers, no model. */
@Injectable()
export class ChatTrainingOnboardingService {
	private readonly logger = new Logger(ChatTrainingOnboardingService.name)

	constructor(
		private readonly prisma: PrismaService,
		private readonly messages: TrainingOnboardingMessagesRepository,
		private readonly profileService: ProfileService,
	) {}

	/** «Налаштувати в чаті» / «Так»: the first question, or the open one when it is already asked. */
	async start(userId: string, now: Date): Promise<string> {
		return this.prisma.$transaction(async (tx) => {
			await this.profileService.markTrainingOnboarding({ userId, at: now }, tx)
			// a double tap after «Пізніше» must not ask the first question twice
			await this.profileService.lockProfile(userId, tx)
			const [latest] = await this.messages.findLatest({ userId, take: 1 }, tx)
			if (latest && (await this.isOpenQuestion(userId, latest, tx))) return latest.id
			const created = await this.messages.create(
				{ userId, trainingOnboarding: toQuestion(TRAINING_ONBOARDING_FIRST_QUESTION) },
				tx,
			)
			this.logger.log(`Training onboarding started user=${userId}`)
			return created.id
		})
	}

	/** «Пізніше»: the invitation is never offered again (the tab keeps its button). */
	dismiss(userId: string, now: Date): Promise<void> {
		return this.profileService.markTrainingOnboarding({ userId, at: now })
	}

	/**
	 * A button answer must be to this user's open, latest question and fit it; words are an answer
	 * when they match the open question's labels, else they pass it by.
	 */
	async route(
		userId: string,
		{
			text,
			hasPhotos,
			button,
		}: { text?: string; hasPhotos: boolean; button?: OnboardingAnswerRequest },
	): Promise<OnboardingRoute> {
		if (button) return { answer: await this.readButton(userId, button), passedQuestionId: null }
		const [latest] = await this.messages.findLatest({ userId, take: 1 })
		if (!latest || !(await this.isOpenQuestion(userId, latest))) return NO_ROUTE
		const { payload } = readStoredOnboarding(latest.trainingOnboarding)
		if (!payload || !isTrainingOnboardingQuestion(payload.step)) return NO_ROUTE
		const values =
			text === undefined || hasPhotos ? null : matchOnboardingAnswer(payload.step, text)
		if (!values) return { answer: null, passedQuestionId: latest.id }
		return {
			answer: {
				questionId: latest.id,
				readAt: latest.updatedAt,
				payload,
				step: payload.step,
				values,
			},
			passedQuestionId: null,
		}
	}

	private async readButton(
		userId: string,
		{ messageId, values }: OnboardingAnswerRequest,
	): Promise<OnboardingAnswer> {
		const question = await this.messages.findById({ userId, id: messageId })
		if (!question) throw new TrainingOnboardingNotFoundException()
		const { payload } = readStoredOnboarding(question.trainingOnboarding)
		if (!payload || !isTrainingOnboardingQuestion(payload.step))
			throw new TrainingOnboardingNotFoundException()
		const [latest] = await this.messages.findLatest({ userId, take: 1 })
		if (latest?.id !== question.id || !(await this.isOpenQuestion(userId, question))) {
			throw new TrainingOnboardingClosedException()
		}
		if (!isValidOnboardingAnswer(payload.step, values))
			throw new TrainingOnboardingAnswerInvalidException()
		return {
			questionId: question.id,
			readAt: question.updatedAt,
			payload,
			step: payload.step,
			values,
		}
	}

	/** A question (not the invitation) without an answer that no completed user message passed by. */
	private async isOpenQuestion(
		userId: string,
		message: OnboardingMessageRow,
		tx?: Prisma.TransactionClient,
	): Promise<boolean> {
		const { payload } = readStoredOnboarding(message.trainingOnboarding)
		if (!payload || !isTrainingOnboardingQuestion(payload.step)) return false
		const newestUserMessageId = await this.messages.findNewestCompletedUserMessageId(userId, tx)
		const state = deriveOnboardingState(
			{ id: message.id, payload },
			{ newestUserMessageId, trainingOnboardingAt: null },
		)
		return state === 'OPEN'
	}
}
