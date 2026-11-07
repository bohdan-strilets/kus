import { Injectable, Logger } from '@nestjs/common'

import { type Message, MessageRole, type Prisma } from '../../generated/prisma/client'
import { PrismaService } from '../../prisma'
import {
	type FinishedLive,
	type LiveFinish,
	LiveSessionsService,
} from '../workouts/live-sessions.service'
import type { WorkoutWithExercises } from '../workouts/workouts.repository'
import { ChatRepository } from './chat.repository'
import { getWorkoutSummaryText } from './workout-summary-text'

/** A finished session with the Kusik message that carries its summary card. */
export interface PostedSummary {
	workout: WorkoutWithExercises
	messageId: string
}

/** An idle live session the auto-close handled; `messageId` null when it was removed as empty. */
export interface IdleLiveClosed {
	workoutId: string
	messageId: string | null
}

/**
 * Kusik's message under a session finished outside the chat (the live mode, the form, the
 * auto-close): an ASSISTANT message that answers no user message; the chat shows the SUMMARY card
 * on it through `Workout.finishedMessageId`.
 */
@Injectable()
export class ChatWorkoutSummaryService {
	private readonly logger = new Logger(ChatWorkoutSummaryService.name)

	constructor(
		private readonly prisma: PrismaService,
		private readonly chatRepository: ChatRepository,
		private readonly liveSessions: LiveSessionsService,
	) {}

	createWorkoutSummaryMessage(
		{
			userId,
			content,
			clientMessageId,
		}: { userId: string; content: string; clientMessageId?: string },
		tx: Prisma.TransactionClient,
	): Promise<Message> {
		return this.chatRepository.createAssistantMessage({ userId, content, clientMessageId }, tx)
	}

	/** Writes the message for a finished session and binds it as the session's summary. */
	async postSummary(
		{
			userId,
			finished,
			isAutoClosed,
			clientMessageId,
		}: {
			userId: string
			finished: Pick<FinishedLive, 'workout' | 'records'>
			isAutoClosed: boolean
			/** The form's clientRequestId: a repeat fails on the unique index. */
			clientMessageId?: string
		},
		tx: Prisma.TransactionClient,
	): Promise<PostedSummary> {
		const { workout, records } = finished
		const recordEntryIds = new Set(records.map(({ exerciseEntryId }) => exerciseEntryId))
		const content = getWorkoutSummaryText({
			templateName: workout.template?.name ?? null,
			recordExerciseNames: workout.exercises
				.filter(({ id }) => recordEntryIds.has(id))
				.map(({ name }) => name),
			isAutoClosed,
		})
		const message = await this.createWorkoutSummaryMessage({ userId, content, clientMessageId }, tx)
		const bound = await this.liveSessions.setFinishedMessage(
			{ userId, id: workout.id, messageId: message.id },
			tx,
		)
		return { workout: bound, messageId: message.id }
	}

	/**
	 * Closes the open live session left alone for more than WORKOUT_APPEND_MAX_GAP_HOURS (never by
	 * the calendar day): with work it gets the auto-closed summary, an empty one is removed silently.
	 * The session it closed and the new message (null for a removed empty one); null when it closed
	 * nothing.
	 */
	async closeIdleLive({
		userId,
		now,
		maxGapHours,
	}: {
		userId: string
		now: Date
		/** The idle gap in hours; default WORKOUT_APPEND_MAX_GAP_HOURS. */
		maxGapHours?: number
	}): Promise<IdleLiveClosed | null> {
		return this.prisma.$transaction(async (tx) => {
			const closed = await this.liveSessions.closeIfIdle({ userId, now, maxGapHours }, tx)
			return closed === null ? null : this.postAutoClosed({ userId, closed }, tx)
		})
	}

	/**
	 * Closes the given open session as an auto-close, with no idle check (a snapshot that brought
	 * the session's last sets when it had already been idle for hours): finished at its last set
	 * with the auto-closed summary, or removed when nothing was done. Null when a parallel request
	 * closed it first. The finish is judged against `activityAt` (the session's last action), not
	 * the real now: a row the snapshot wrote with performedAt = now (cardio without sets) must not
	 * stretch it.
	 */
	async closeLive(
		{
			userId,
			workout,
			activityAt,
		}: { userId: string; workout: WorkoutWithExercises; activityAt: Date },
		tx: Prisma.TransactionClient,
	): Promise<IdleLiveClosed | null> {
		const closed = await this.liveSessions.finish({ userId, workout, now: activityAt }, tx)
		return closed === null ? null : this.postAutoClosed({ userId, closed }, tx)
	}

	private async postAutoClosed(
		{ userId, closed }: { userId: string; closed: LiveFinish },
		tx: Prisma.TransactionClient,
	): Promise<IdleLiveClosed> {
		if (closed.kind === 'DELETED') return { workoutId: closed.workoutId, messageId: null }
		const { messageId } = await this.postSummary(
			{ userId, finished: closed, isAutoClosed: true },
			tx,
		)
		this.logger.log(`Live workout auto-closed user=${userId} workout=${closed.workout.id}`)
		return { workoutId: closed.workout.id, messageId }
	}

	/**
	 * The Kusik message with the summary of a finished session: its own one, or the reply to the
	 * user's «все» when the chat closed it. Null when neither is there any more.
	 */
	async findSummaryMessageId(userId: string, finishedMessageId: string): Promise<string | null> {
		const message = await this.chatRepository.findById({ userId, id: finishedMessageId })
		if (!message) return null
		if (message.role === MessageRole.ASSISTANT) return message.id
		const reply = await this.chatRepository.findReply({ userId, userMessageId: message.id })
		return reply?.id ?? null
	}

	/** The id of the message a request with this clientMessageId already wrote; null when none. */
	async findMessageIdByClientId(userId: string, clientMessageId: string): Promise<string | null> {
		const message = await this.chatRepository.findByClientMessageId({ userId, clientMessageId })
		return message?.role === MessageRole.ASSISTANT ? message.id : null
	}

	/** Whether the user already has a message with this clientMessageId (of any role). */
	async hasClientMessage(userId: string, clientMessageId: string): Promise<boolean> {
		const message = await this.chatRepository.findByClientMessageId({ userId, clientMessageId })
		return message !== null
	}
}
