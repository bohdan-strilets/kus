import { Injectable } from '@nestjs/common'
import { type DayInRange, type DayResponse, type DaysRangeQuery, getDayStatus } from '@kus/shared'

import { addDays, getLocalDateString, listDays } from '../../common/time'
import { EntriesService } from '../entries/entries.service'
import { GoalsService } from '../goals/goals.service'
import { UsersService } from '../users/users.service'
import { DayInFutureException } from './days.exceptions'

const toDbDate = (localDate: string): Date => new Date(`${localDate}T00:00:00Z`)

/** A whole calendar day of the user: meals, totals and the goal in force; the backend sums. */
@Injectable()
export class DaysService {
	constructor(
		private readonly entriesService: EntriesService,
		private readonly goalsService: GoalsService,
		private readonly usersService: UsersService,
	) {}

	async getDay(userId: string, localDate: string): Promise<DayResponse> {
		if (localDate > (await this.getLatestDay(userId))) throw new DayInFutureException()

		const date = toDbDate(localDate)
		const [{ meals, totals }, goal] = await Promise.all([
			this.entriesService.getDayMeals(userId, date),
			this.goalsService.getGoalForDate(userId, date),
		])
		return {
			localDate,
			meals,
			totals,
			goal,
			remainingKcal: goal ? Math.round(goal.kcal - totals.kcal) : null,
		}
	}

	/** The week strip: each day's kcal against the goal in force that day, empty days included. */
	async getDays(userId: string, { from, to }: DaysRangeQuery): Promise<DayInRange[]> {
		if (to > (await this.getLatestDay(userId))) throw new DayInFutureException('to')
		const days = listDays(from, to)
		const [kcalByDay, goalByDay] = await Promise.all([
			this.entriesService.getDaysKcal(userId, { from: toDbDate(from), to: toDbDate(to) }),
			this.goalsService.getGoalKcalByDay(userId, days),
		])
		return days.map((localDate) => {
			const { kcal, entryCount } = kcalByDay.get(localDate) ?? { kcal: 0, entryCount: 0 }
			const goalKcal = goalByDay.get(localDate) ?? null
			return { localDate, kcal, goalKcal, status: getDayStatus({ kcal, entryCount, goalKcal }) }
		})
	}

	/** Tomorrow is still allowed: the client's clock may already be past midnight. */
	private async getLatestDay(userId: string): Promise<string> {
		const { timezone } = await this.usersService.getMe(userId)
		return getLocalDateString(addDays(new Date(), 1), timezone)
	}
}
