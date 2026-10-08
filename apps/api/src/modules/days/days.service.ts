import { Injectable } from '@nestjs/common'
import type { DayResponse } from '@kus/shared'

import { addDays, getLocalDateString } from '../../common/time'
import { EntriesService } from '../entries/entries.service'
import { GoalsService } from '../goals/goals.service'
import { UsersService } from '../users/users.service'
import { DayInFutureException } from './days.exceptions'

/** A whole calendar day of the user: meals, totals and the goal in force; the backend sums. */
@Injectable()
export class DaysService {
	constructor(
		private readonly entriesService: EntriesService,
		private readonly goalsService: GoalsService,
		private readonly usersService: UsersService,
	) {}

	async getDay(userId: string, localDate: string): Promise<DayResponse> {
		const { timezone } = await this.usersService.getMe(userId)
		// tomorrow is still allowed: the client's clock may already be past midnight
		const latest = getLocalDateString(addDays(new Date(), 1), timezone)
		if (localDate > latest) throw new DayInFutureException()

		const date = new Date(`${localDate}T00:00:00Z`)
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
}
