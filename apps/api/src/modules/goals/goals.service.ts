import { Injectable, Logger } from '@nestjs/common'
import type { DailyGoal, ProfileGoals, SetGoalRequest } from '@kus/shared'

import { formatDbDate, getLocalDate } from '../../common/time'
import {
	type GoalSource,
	GoalType,
	type Prisma,
	type UserGoal,
} from '../../generated/prisma/client'
import { UsersService } from '../users/users.service'
import { GoalsRepository } from './goals.repository'

const toDailyGoal = (goal: UserGoal): DailyGoal => ({
	kcal: goal.dailyKcal,
	protein: goal.proteinG,
	carbs: goal.carbsG,
	fat: goal.fatG,
})

const toProfileGoals = (goal: UserGoal): ProfileGoals => ({
	kcal: goal.dailyKcal,
	proteinG: goal.proteinG,
	carbsG: goal.carbsG,
	fatG: goal.fatG,
	source: goal.source,
	validFrom: formatDbDate(goal.validFrom),
	updatedAt: goal.updatedAt.toISOString(),
})

export interface SaveGoalOptions {
	userId: string
	/** The user's calendar day the goal starts on. */
	validFrom: Date
	type: GoalType
	source: GoalSource
	kcal: number
	proteinG: number
	carbsG: number
	fatG: number
	tx?: Prisma.TransactionClient
}

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

	/** The goal kcal in force on each of these `YYYY-MM-DD` days (null before the first goal). */
	async getGoalKcalByDay(userId: string, days: string[]): Promise<Map<string, number | null>> {
		const last = days.at(-1)
		if (!last) return new Map()
		const goals = await this.goalsRepository.findStartedBy({
			userId,
			to: new Date(`${last}T00:00:00Z`),
		})
		return new Map(
			days.map((day) => {
				const goal = goals.findLast((item) => formatDbDate(item.validFrom) <= day)
				return [day, goal ? goal.dailyKcal : null]
			}),
		)
	}

	/** The goal in force on a day as the profile shows it, with its source. */
	async getProfileGoals(
		userId: string,
		localDate: Date,
		tx?: Prisma.TransactionClient,
	): Promise<ProfileGoals | null> {
		const goal = await this.goalsRepository.findForDate({ userId, localDate }, tx)
		return goal ? toProfileGoals(goal) : null
	}

	/** A goal from `validFrom` on; earlier days keep theirs (one row per start day, rewritten). */
	async saveGoal({
		userId,
		validFrom,
		type,
		source,
		tx,
		...macros
	}: SaveGoalOptions): Promise<ProfileGoals> {
		const goal = await this.goalsRepository.upsertForDate(
			{
				userId,
				validFrom,
				values: {
					type,
					source,
					dailyKcal: macros.kcal,
					proteinG: macros.proteinG,
					fatG: macros.fatG,
					carbsG: macros.carbsG,
				},
			},
			tx,
		)
		this.logger.log(`Goal set user=${userId} source=${source}`)
		return toProfileGoals(goal)
	}

	/**
	 * The chat's goal sheet (PUT /goals/current): numbers typed by hand from today on. The type
	 * stays as it was, or MAINTAIN for a first goal; the profile's PUT /profile/goals sets it.
	 * No «add up» check here on purpose: the current web sheet doesn't handle GOALS_INCONSISTENT;
	 * it moves to PUT /profile/goals with the profile screens, and this route goes with it.
	 */
	async setCurrentGoal(userId: string, request: SetGoalRequest): Promise<DailyGoal> {
		const { timezone } = await this.usersService.getMe(userId)
		const today = getLocalDate(new Date(), timezone)
		const current = await this.goalsRepository.findForDate({ userId, localDate: today })
		const goal = await this.saveGoal({
			userId,
			validFrom: today,
			type: current?.type ?? GoalType.MAINTAIN,
			source: 'MANUAL',
			kcal: request.kcal,
			proteinG: request.protein,
			fatG: request.fat,
			carbsG: request.carbs,
		})
		return { kcal: goal.kcal, protein: goal.proteinG, carbs: goal.carbsG, fat: goal.fatG }
	}
}
