import { Injectable } from '@nestjs/common'
import type { ExerciseStatsResponse, WorkoutStatsPeriod, WorkoutStatsResponse } from '@kus/shared'

import { getLocalDateString, toDbDate } from '../../common/time'
import { UsersService } from '../users/users.service'
import { buildExerciseStats } from './exercise-stats'
import { buildWorkoutStats } from './workout-stats'
import { toStatsEntryRow, toStatsWorkoutRow } from './workout-stats.mapper'
import { WorkoutStatsRepository } from './workout-stats.repository'
import { getStatsPeriodRange } from './workout-stats-period'
import { ExerciseNotFoundException } from './workouts.exceptions'

@Injectable()
export class WorkoutStatsService {
	constructor(
		private readonly statsRepository: WorkoutStatsRepository,
		private readonly usersService: UsersService,
	) {}

	/** Overview, exercises and cardio of the period; the previous one is read for the comparison. */
	async getStats(userId: string, period: WorkoutStatsPeriod): Promise<WorkoutStatsResponse> {
		const today = await this.getToday(userId)
		const range = getStatsPeriodRange(period, today)
		const window = { userId, from: toDbDate(range.previous.from), to: toDbDate(range.to) }
		const [workouts, entries] = await Promise.all([
			this.statsRepository.findWorkoutsInRange(window),
			this.statsRepository.findEntriesInRange(window),
		])
		const exerciseIds = [
			...new Set(
				entries.flatMap((entry) =>
					entry.kind === 'STRENGTH' && entry.exerciseId !== null ? [entry.exerciseId] : [],
				),
			),
		]
		const allTime = await this.statsRepository.findStrengthEntriesOfExercises({
			userId,
			exerciseIds,
		})
		return buildWorkoutStats({
			period,
			today,
			workouts: workouts.map(toStatsWorkoutRow),
			entries: entries.map(toStatsEntryRow),
			allTimeStrengthEntries: allTime.map(toStatsEntryRow),
		})
	}

	/** Another user's, a deleted or an unknown exercise is the same 404. */
	async getExerciseStats(
		userId: string,
		exerciseId: string,
		period: WorkoutStatsPeriod,
	): Promise<ExerciseStatsResponse> {
		const exercise = await this.statsRepository.findExercise({ userId, id: exerciseId })
		if (!exercise) throw new ExerciseNotFoundException()
		const [today, entries] = await Promise.all([
			this.getToday(userId),
			this.statsRepository.findEntriesOfExercise({ userId, exerciseId }),
		])
		return buildExerciseStats({ exercise, period, today, entries: entries.map(toStatsEntryRow) })
	}

	private async getToday(userId: string): Promise<string> {
		const { timezone } = await this.usersService.getMe(userId)
		return getLocalDateString(new Date(), timezone)
	}
}
