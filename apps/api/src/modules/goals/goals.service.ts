import { Injectable, Logger } from '@nestjs/common'
import type { DailyGoal, SetGoalRequest } from '@kus/shared'

import { getLocalDate } from '../../common/time'
import { GoalType, type UserGoal } from '../../generated/prisma/client'
import { UsersService } from '../users/users.service'
import { GoalsRepository } from './goals.repository'

const toDailyGoal = (goal: UserGoal): DailyGoal => ({
	kcal: goal.dailyKcal,
	protein: goal.proteinG,
	carbs: goal.carbsG,
	fat: goal.fatG,
})

/** Daily kcal and macro goals; a new goal starts on its day and never rewrites past days. */
@Injectable()
export class GoalsService {
	private readonly logger = new Logger(GoalsService.name)

	constructor(
		private readonly goalsRepository: GoalsRepository,
		private readonly usersService: UsersService,
	) {}

	async getGoalForDate(userId: string, localDate: Date): Promise<DailyGoal | null> {
		const goal = await this.goalsRepository.findForDate({ userId, localDate })
		return goal ? toDailyGoal(goal) : null
	}

	/**
	 * The goal from today (the user's day) on; earlier days keep theirs. The type (lose / keep /
	 * gain) comes from onboarding — until then it stays as it was, or MAINTAIN for a first goal.
	 */
	async setCurrentGoal(userId: string, request: SetGoalRequest): Promise<DailyGoal> {
		const { timezone } = await this.usersService.getMe(userId)
		const today = getLocalDate(new Date(), timezone)
		const current = await this.goalsRepository.findForDate({ userId, localDate: today })
		const goal = await this.goalsRepository.upsertForDate({
			userId,
			validFrom: today,
			values: {
				type: current?.type ?? GoalType.MAINTAIN,
				dailyKcal: request.kcal,
				proteinG: request.protein,
				fatG: request.fat,
				carbsG: request.carbs,
			},
		})
		this.logger.log(`Goal set user=${userId}`)
		return toDailyGoal(goal)
	}
}
