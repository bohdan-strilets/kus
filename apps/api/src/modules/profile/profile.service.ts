import { Injectable, Logger } from '@nestjs/common'
import {
	calculateGoals,
	getMacroKcal,
	type GoalsPreviewResponse,
	isGoalConsistent,
	isManualGoalsRequest,
	type ManualGoals,
	type ProfileGoals,
	type ProfileResponse,
	type SaveGoalsRequest,
	type UpdateProfileRequest,
} from '@kus/shared'

import { GoalType } from '../../generated/prisma/client'
import { PrismaService } from '../../prisma'
import { GoalsService } from '../goals/goals.service'
import { UsersService } from '../users/users.service'
import { GoalsInconsistentException } from './profile.exceptions'
import {
	getClock,
	roundWeight,
	toCalculationInput,
	toProfileFields,
	toProfileResponse,
} from './profile.mapper'
import { ProfileRepository } from './profile.repository'

/** «Мої дані», the latest weigh-in and the daily goals: reading, editing, recalculating. */
@Injectable()
export class ProfileService {
	private readonly logger = new Logger(ProfileService.name)

	constructor(
		private readonly prisma: PrismaService,
		private readonly profileRepository: ProfileRepository,
		private readonly goalsService: GoalsService,
		private readonly usersService: UsersService,
	) {}

	async getProfile(userId: string): Promise<ProfileResponse> {
		const user = await this.usersService.getMe(userId)
		const { today, year } = getClock(user.timezone)
		const [profile, weight, goals] = await Promise.all([
			this.profileRepository.findProfile(userId),
			this.profileRepository.findLatestWeight(userId),
			this.goalsService.getProfileGoals(userId, today),
		])
		return toProfileResponse({ user, profile, weight, goals, year })
	}

	/** A partial edit; a new weight becomes today's weigh-in. Goals don't move until recalculated. */
	async updateProfile(userId: string, body: UpdateProfileRequest): Promise<ProfileResponse> {
		const user = await this.usersService.getMe(userId)
		const { now, today, year } = getClock(user.timezone)
		const fields = toProfileFields(body, year)

		await this.prisma.$transaction(async (tx) => {
			const current = await this.profileRepository.findProfile(userId, tx)
			// «Тримати вагу» has no pace (screens.md): a stale or stray pace is cleared with it
			const goalType = body.goalType ?? current?.goalType ?? null
			if (goalType === GoalType.MAINTAIN) fields.paceKgPerWeek = null

			await this.profileRepository.upsertProfile({ userId, data: fields }, tx)
			if (body.weightKg !== undefined) {
				await this.profileRepository.upsertWeight(
					{ userId, localDate: today, measuredAt: now, weightKg: roundWeight(body.weightKg) },
					tx,
				)
			}
		})
		this.logger.log(`Profile data updated user=${userId}`)
		return this.getProfile(userId)
	}

	/** goals-recalc and «розраховано N» in goals-edit-sheet: the numbers without saving them. */
	async previewGoals(userId: string): Promise<GoalsPreviewResponse> {
		const user = await this.usersService.getMe(userId)
		const { today, year } = getClock(user.timezone)
		const [profile, weight, current] = await Promise.all([
			this.profileRepository.findProfile(userId),
			this.profileRepository.findLatestWeight(userId),
			this.goalsService.getProfileGoals(userId, today),
		])
		return { ...calculateGoals(toCalculationInput({ profile, weight, year })), current }
	}

	/**
	 * From today on; earlier days keep their goal. `calculated` recomputes on the server — client
	 * numbers are never trusted; `manual` must add up to within the tolerance of the kcal.
	 */
	async saveGoals(userId: string, body: SaveGoalsRequest): Promise<ProfileGoals> {
		const user = await this.usersService.getMe(userId)
		const { today, year } = getClock(user.timezone)
		const [profile, weight] = await Promise.all([
			this.profileRepository.findProfile(userId),
			this.profileRepository.findLatestWeight(userId),
		])

		if (isManualGoalsRequest(body)) {
			return this.saveManualGoals({
				userId,
				today,
				type: profile?.goalType ?? GoalType.MAINTAIN,
				manual: body,
			})
		}

		const input = toCalculationInput({ profile, weight, year })
		const { kcal, proteinG, carbsG, fatG } = calculateGoals(input)
		return this.goalsService.saveGoal({
			userId,
			validFrom: today,
			type: input.goalType,
			source: 'CALCULATED',
			kcal,
			proteinG,
			carbsG,
			fatG,
		})
	}

	private saveManualGoals({
		userId,
		today,
		type,
		manual,
	}: {
		userId: string
		today: Date
		type: GoalType
		manual: ManualGoals
	}): Promise<ProfileGoals> {
		const { kcal, proteinG, carbsG, fatG } = manual
		if (!isGoalConsistent(kcal, manual)) throw new GoalsInconsistentException(getMacroKcal(manual))
		return this.goalsService.saveGoal({
			userId,
			validFrom: today,
			type,
			source: 'MANUAL',
			kcal,
			proteinG,
			carbsG,
			fatG,
		})
	}
}
