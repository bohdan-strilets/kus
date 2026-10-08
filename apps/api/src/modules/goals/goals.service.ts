import { Injectable } from '@nestjs/common'
import type { DailyGoal } from '@kus/shared'

import type { UserGoal } from '../../generated/prisma/client'
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
	constructor(private readonly goalsRepository: GoalsRepository) {}

	async getGoalForDate(userId: string, localDate: Date): Promise<DailyGoal | null> {
		const goal = await this.goalsRepository.findForDate({ userId, localDate })
		return goal ? toDailyGoal(goal) : null
	}
}
