import { Injectable } from '@nestjs/common'
import {
	TRAINING_EQUIPMENT_FOR_GYM,
	TRAINING_ONBOARDING_FIRST_QUESTION,
	TRAINING_ONBOARDING_LAST_QUESTION,
	type TrainingOnboardingQuestionStep,
	trainingPlaceSchema,
} from '@kus/shared'

import type { Prisma } from '../../generated/prisma/client'
import { PrismaService } from '../../prisma'
import { ProfileService } from '../profile/profile.service'
import { ProgramsService } from '../programs/programs.service'
import { WorkoutsService } from '../workouts/workouts.service'
import { MessageInProgressException, TrainingOnboardingClosedException } from './chat.exceptions'
import { ChatRepository } from './chat.repository'
import { formatCollectedAnswers } from './training-onboarding-answers'
import { TrainingOnboardingMessagesRepository } from './training-onboarding-messages.repository'
import { type OnboardingAnswer, INVITATION, toQuestion } from './training-onboarding-question'
import { readStoredOnboarding } from './training-onboarding-state'

/** The four questions before the last one hold the rest of the answers. */
const EARLIER_QUESTIONS = TRAINING_ONBOARDING_LAST_QUESTION - TRAINING_ONBOARDING_FIRST_QUESTION

/** The onboarding's answers: stored with the next question, collected for the model, the invitation. */
@Injectable()
export class ChatTrainingOnboardingAnswersService {
	constructor(
		private readonly prisma: PrismaService,
		private readonly messages: TrainingOnboardingMessagesRepository,
		private readonly chatRepository: ChatRepository,
		private readonly profileService: ProfileService,
		private readonly programsService: ProgramsService,
		private readonly workoutsService: WorkoutsService,
	) {}

	/** Steps 1–4: the answer is stored and the next question asked, all in one write. */
	async answerWithoutModel(
		{ userId, userMessageId }: { userId: string; userMessageId: string },
		answer: OnboardingAnswer,
	): Promise<void> {
		await this.prisma.$transaction(async (tx) => {
			await this.storeAnswer(userId, answer, tx)
			const next = (answer.step + 1) as TrainingOnboardingQuestionStep
			const preselected =
				next === TRAINING_ONBOARDING_LAST_QUESTION
					? await this.getPreselectedEquipment(userId, answer, tx)
					: []
			const reply = await this.chatRepository.completeTurn(
				{
					userId,
					userMessageId,
					replyText: null,
					trainingOnboarding: toQuestion(next, preselected),
				},
				tx,
			)
			if (!reply) throw new MessageInProgressException()
		})
	}

	/** The answer onto its question, in the caller's transaction; a question answered meanwhile is closed. */
	async storeAnswer(
		userId: string,
		{ questionId, readAt, payload, values }: OnboardingAnswer,
		tx: Prisma.TransactionClient,
	): Promise<void> {
		const isStored = await this.messages.setPayload(
			{ userId, id: questionId, readAt, trainingOnboarding: { ...payload, answer: values } },
			tx,
		)
		if (!isStored) throw new TrainingOnboardingClosedException()
	}

	/**
	 * The last answer with the four before it, as «Program» reads them; null when one of the four is
	 * missing (the question run was cut), so the turn can end before any model call.
	 */
	async formatAnswers(userId: string, last: OnboardingAnswer): Promise<string | null> {
		return formatCollectedAnswers(await this.collectAnswers(userId, last.questionId), last.values)
	}

	/**
	 * After a turn that logged a workout: the user's first one ever, no program and the invitation
	 * never taken up or declined → the reply carries the invitation.
	 */
	async offerAfterWorkout(
		{ userId, replyId }: { userId: string; replyId: string },
		tx: Prisma.TransactionClient,
	): Promise<void> {
		if ((await this.profileService.findTrainingOnboardingAt(userId, tx)) !== null) return
		if (!(await this.workoutsService.hasOnlyOneWorkout(userId, tx))) return
		if (await this.programsService.hasActive(userId, tx)) return
		// a later message of the same first session must not repeat it
		if (await this.messages.hasInvitation(userId, tx)) return
		await this.messages.setOnReply({ userId, id: replyId, trainingOnboarding: INVITATION }, tx)
	}

	/** «Зал» on the first question → «Повний зал» ticked on the last one. */
	private async getPreselectedEquipment(
		userId: string,
		answer: OnboardingAnswer,
		tx: Prisma.TransactionClient,
	): Promise<string[]> {
		const answers = await this.collectAnswers(userId, answer.questionId, tx)
		return answers.get(TRAINING_ONBOARDING_FIRST_QUESTION)?.[0] === trainingPlaceSchema.enum.GYM
			? [TRAINING_EQUIPMENT_FOR_GYM]
			: []
	}

	/** Step → answer of the questions just before `questionId` (this run of the onboarding), itself included. */
	private async collectAnswers(
		userId: string,
		questionId: string,
		tx?: Prisma.TransactionClient,
	): Promise<Map<number, string[]>> {
		const current = await this.messages.findById({ userId, id: questionId }, tx)
		const earlier = await this.messages.findLatest(
			{ userId, beforeId: questionId, take: EARLIER_QUESTIONS },
			tx,
		)
		const answers = new Map<number, string[]>()
		for (const row of [...(current ? [current] : []), ...earlier]) {
			const { payload } = readStoredOnboarding(row.trainingOnboarding)
			if (payload?.answer && !answers.has(payload.step)) answers.set(payload.step, payload.answer)
		}
		return answers
	}
}
