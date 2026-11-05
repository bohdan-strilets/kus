import { Injectable } from '@nestjs/common'
import type { ExerciseStatsResponse, WorkoutStatsPeriod, WorkoutStatsResponse } from '@kus/shared'

import { formatDbDate, getLocalDateString, toDbDate } from '../../common/time'
import { UsersService } from '../users/users.service'
import { buildExerciseStats } from './exercise-stats'
import { WorkoutKcalService } from './workout-kcal.service'
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
		private readonly kcal: WorkoutKcalService,
	) {}

	/** Overview, exercises and cardio of the period; the previous one is read for the comparison. */
	async getStats(userId: string, period: WorkoutStatsPeriod): Promise<WorkoutStatsResponse> {
		const today = await this.getToday(userId)
		const range = getStatsPeriodRange(period, today)
		// the current week may end after the month: its bucket counts in full. The first week starts
		// after previous.from, so the lower edge is already covered
		const lastBucketEnd = range.buckets.at(-1)?.to ?? range.to
		const windowEnd = lastBucketEnd > range.to ? lastBucketEnd : range.to
		const window = { userId, from: toDbDate(range.previous.from), to: toDbDate(windowEnd) }
		const [workouts, entries, firstWorkout] = await Promise.all([
			this.statsRepository.findWorkoutsInRange(window),
			this.statsRepository.findEntriesInRange(window),
			this.statsRepository.findFirstWorkoutDate({ userId }),
		])
		const exerciseIds = [
			...new Set(
				entries.flatMap((entry) =>
					entry.kind === 'STRENGTH' && entry.exerciseId !== null ? [entry.exerciseId] : [],
				),
			),
		]
		const [allTime, getBodyWeightKg] = await Promise.all([
			this.statsRepository.findStrengthEntriesOfExercises({ userId, exerciseIds }),
			// one read of the weigh-ins for the whole period
			this.kcal.getBodyWeightPicker(userId, [range.from, range.to]),
		])
		return buildWorkoutStats({
			getBodyWeightKg,
			period,
			today,
			firstWorkoutDate: firstWorkout === null ? null : formatDbDate(firstWorkout),
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
