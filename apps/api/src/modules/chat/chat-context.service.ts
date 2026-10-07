import { Injectable } from '@nestjs/common'
import {
	type DayTotals,
	type FoodParseContext,
	type GoalContext,
	HISTORY_MAX_MESSAGES,
	type HistoryTurn,
	type MemoryFoodContext,
} from '@kus/shared'

import { formatDbDate, formatLocalTime } from '../../common/time'
import { type Message, MessageRole } from '../../generated/prisma/client'
import { type DaySummary, EntriesService } from '../entries/entries.service'
import { type DailyGoal, UsersService } from '../users/users.service'
import { ChatRepository } from './chat.repository'

export interface DayOverview {
	summary: DaySummary
	goal: DailyGoal | null
	totals: DayTotals
}

interface BuildContextParams {
	userId: string
	timezone: string
	message: Message
	now: Date
	localDate: Date
	memory: MemoryFoodContext[]
}

const toHistoryTurn = (message: Message): HistoryTurn[] =>
	message.content === null
		? []
		: [{ role: message.role === MessageRole.USER ? 'user' : 'assistant', content: message.content }]

/** What the model gets besides the message: day so far, goal, matching saved foods, last turns. */
@Injectable()
export class ChatContextService {
	constructor(
		private readonly chatRepository: ChatRepository,
		private readonly entriesService: EntriesService,
		private readonly usersService: UsersService,
	) {}

	/** Day totals vs goal; the remainder is computed here, never by the model. */
	async getDayOverview(userId: string, localDate: Date): Promise<DayOverview> {
		const [summary, goal] = await Promise.all([
			this.entriesService.getDaySummary(userId, localDate),
			this.usersService.getGoalForDate(userId, localDate),
		])
		return {
			summary,
			goal,
			totals: {
				localDate: formatDbDate(localDate),
				totals: summary.totals,
				goalKcal: goal?.dailyKcal ?? null,
				remainingKcal: goal ? Math.round(goal.dailyKcal - summary.totals.kcal) : null,
			},
		}
	}

	async buildContext({
		userId,
		timezone,
		message,
		now,
		localDate,
		memory,
	}: BuildContextParams): Promise<FoodParseContext> {
		const [{ summary, goal, totals }, history] = await Promise.all([
			this.getDayOverview(userId, localDate),
			this.chatRepository.findHistory({
				userId,
				beforeId: message.id,
				limit: HISTORY_MAX_MESSAGES,
			}),
		])
		const goalContext: GoalContext | null =
			goal && totals.remainingKcal !== null
				? { ...goal, remainingKcal: totals.remainingKcal }
				: null

		return {
			localTime: formatLocalTime(now, timezone),
			dayTotals: summary.totals,
			meals: summary.meals,
			goal: goalContext,
			memory,
			history: history.reverse().flatMap(toHistoryTurn),
		}
	}
}
