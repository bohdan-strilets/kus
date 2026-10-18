import { Injectable } from '@nestjs/common'
import { type AchievementResponse, FOOD_STREAK_MILESTONES } from '@kus/shared'

import { addDays, getLocalDate } from '../../common/time'
import {
	type Achievement,
	AchievementType,
	GoalType,
	MeasurementKind,
	MeasurementSource,
	type Prisma,
} from '../../generated/prisma/client'
import { EntriesService } from '../entries/entries.service'
import { MeasurementsService } from '../measurements/measurements.service'
import { ProfileService } from '../profile/profile.service'
import { FOOD_STREAK_WINDOW_DAYS } from './achievements.constants'
import { toAchievementResponse } from './achievements.mapper'
import { AchievementsRepository } from './achievements.repository'
import {
	getFoodStreak,
	getKgLostBaseline,
	getKgThresholds,
	getWholeKgLost,
} from './achievements.utils'

export interface TurnAchievementsParams {
	userId: string
	timezone: string
	now: Date
	/** The assistant reply of the turn: the highest new achievement of each type is announced in it. */
	replyMessageId: string
	/** The user message of the turn: the weight it recorded is the one that may be announced. */
	userMessageId: string
	/** The turn logged or restored food. */
	isFoodChanged: boolean
	/** The turn recorded a weight from the chat. */
	isWeightLogged: boolean
}

const getHighest = (rows: Achievement[]): Achievement | null =>
	rows.reduce<Achievement | null>(
		(best, row) => (best === null || row.value > best.value ? row : best),
		null,
	)

/** Milestones: days of food in a row and whole kg lost. Written inside the turn's transaction. */
@Injectable()
export class AchievementsService {
	constructor(
		private readonly achievementsRepository: AchievementsRepository,
		private readonly entriesService: EntriesService,
		private readonly measurementsService: MeasurementsService,
		private readonly profileService: ProfileService,
	) {}

	async recordForTurn(params: TurnAchievementsParams, tx: Prisma.TransactionClient): Promise<void> {
		if (params.isFoodChanged) await this.recordFoodStreak(params, tx)
		if (params.isWeightLogged) await this.recordKgLost(params, tx)
	}

	/** For the chat feed: the achievements each assistant reply announced. */
	async findByMessages(
		userId: string,
		messageIds: string[],
	): Promise<Map<string, AchievementResponse[]>> {
		const byMessage = new Map<string, AchievementResponse[]>()
		if (messageIds.length === 0) return byMessage
		const rows = await this.achievementsRepository.findByMessageIds({ userId, messageIds })
		for (const row of rows) {
			if (row.messageId === null) continue
			byMessage.set(row.messageId, [
				...(byMessage.get(row.messageId) ?? []),
				toAchievementResponse(row),
			])
		}
		return byMessage
	}

	private async recordFoodStreak(
		{ userId, timezone, now, replyMessageId }: TurnAchievementsParams,
		tx: Prisma.TransactionClient,
	): Promise<void> {
		const today = getLocalDate(now, timezone)
		const days = await this.entriesService.getDaysKcal(
			userId,
			{ from: addDays(today, -(FOOD_STREAK_WINDOW_DAYS - 1)), to: today },
			tx,
		)
		const streak = getFoodStreak({
			loggedDays: new Set(days.keys()),
			today,
			maxDays: FOOD_STREAK_WINDOW_DAYS,
		})
		await this.award(
			{
				userId,
				type: AchievementType.FOOD_STREAK,
				values: FOOD_STREAK_MILESTONES.filter((milestone) => milestone <= streak),
				now,
				replyMessageId,
			},
			tx,
		)
	}

	private async recordKgLost(
		{ userId, now, replyMessageId, userMessageId }: TurnAchievementsParams,
		tx: Prisma.TransactionClient,
	): Promise<void> {
		const { goalType } = await this.profileService.findWeightGoal(userId, tx)
		// losing is only worth celebrating for those who lose (or have no goal yet)
		if (goalType === GoalType.GAIN || goalType === GoalType.MAINTAIN) return
		const [start, current] = await Promise.all([
			this.measurementsService.findFirst({ userId, kind: MeasurementKind.WEIGHT }, tx),
			this.measurementsService.findLatest({ userId, kind: MeasurementKind.WEIGHT }, tx),
		])
		if (!start || !current) return
		// only the weight this very message recorded may be announced, and only while it is the newest
		// by day: one written for an earlier day just joins the chain of the next record. Weights
		// from the profile or edited by hand are unverified: they never start a payout nor serve as a
		// base, they only sit in the chain, so a correction of up to 3 kg is paid by the next chat weight
		if (current.messageId !== userMessageId || current.source !== MeasurementSource.CHAT) return
		const chatBase = await this.measurementsService.findBefore(
			{
				userId,
				kind: MeasurementKind.WEIGHT,
				before: current.localDate,
				source: MeasurementSource.CHAT,
			},
			tx,
		)
		// a weight back-dated before the start is not in the chain: that only ever pays out less
		const chain = await this.measurementsService.findInRange(
			{
				userId,
				kind: MeasurementKind.WEIGHT,
				from: chatBase?.localDate ?? start.localDate,
				to: current.localDate,
			},
			tx,
		)
		// kg since the last chat-checked weight; a big step (a typo or a profile correction) is never paid out
		const baseKg = getKgLostBaseline({ chainKg: chain.map((weight) => weight.value) })
		if (baseKg === null) return
		const lostBefore = getWholeKgLost({ startKg: start.value, currentKg: baseKg })
		const lost = getWholeKgLost({ startKg: start.value, currentKg: current.value })
		await this.award(
			{
				userId,
				type: AchievementType.WEIGHT_KG_LOST,
				values: getKgThresholds({ from: lostBefore, to: lost }),
				now,
				replyMessageId,
			},
			tx,
		)
	}

	/**
	 * Stores every reached threshold; only the highest of the new ones is announced in the reply,
	 * the rest stay silent (no message), so a replayed turn shows the same single event.
	 */
	private async award(
		{
			userId,
			type,
			values,
			now,
			replyMessageId,
		}: {
			userId: string
			type: AchievementType
			values: number[]
			now: Date
			replyMessageId: string
		},
		tx: Prisma.TransactionClient,
	): Promise<void> {
		if (values.length === 0) return
		const created = await this.achievementsRepository.createMissing(
			{ userId, type, values, achievedAt: now },
			tx,
		)
		const top = getHighest(created)
		if (!top) return
		await this.achievementsRepository.attachToMessage(
			{ userId, id: top.id, messageId: replyMessageId },
			tx,
		)
	}
}
