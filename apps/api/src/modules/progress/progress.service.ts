import { Injectable } from '@nestjs/common'
import {
	getDayStatus,
	getIsGoalReached,
	type ProgressResponse,
	type ProgressWaist,
	type ProgressWeek,
	type ProgressWeight,
} from '@kus/shared'

import { addDays, formatDbDate, getLocalDate, listDays } from '../../common/time'
import { MeasurementKind } from '../../generated/prisma/client'
import { EntriesService } from '../entries/entries.service'
import { GoalsService } from '../goals/goals.service'
import type { MeasurementValue } from '../measurements/measurements.mapper'
import { MeasurementsService } from '../measurements/measurements.service'
import {
	getKgToGoal,
	subtractTenths,
	WEEK_CHANGE_MAX_DAYS,
} from '../measurements/measurements.utils'
import { ProfileService } from '../profile/profile.service'
import type { WeightGoal } from '../profile/profile.types'
import { UsersService } from '../users/users.service'
import {
	EMPTY_STATE_WINDOW_DAYS,
	MIN_FOOD_DAYS_FOR_PROGRESS,
	MIN_WEIGHINGS_FOR_PROGRESS,
	WEEK_DAYS,
} from './progress.constants'
import {
	averageOrNull,
	getIsWeekendProteinLow,
	getWeekPaceKg,
	hasWeightDirection,
} from './progress.utils'

const toPoint = (row: MeasurementValue) => ({
	localDate: formatDbDate(row.localDate),
	value: row.value,
})

const getEarlier = (first: Date, second: Date): Date => (first < second ? first : second)

/** The «Прогрес» screen: weight and waist for the chosen range, the last 7 days of food, the facts. */
@Injectable()
export class ProgressService {
	constructor(
		private readonly entriesService: EntriesService,
		private readonly goalsService: GoalsService,
		private readonly measurementsService: MeasurementsService,
		private readonly profileService: ProfileService,
		private readonly usersService: UsersService,
	) {}

	async getProgress(userId: string, range: ProgressResponse['range']): Promise<ProgressResponse> {
		const { timezone } = await this.usersService.getMe(userId)
		const today = getLocalDate(new Date(), timezone)
		const windowFrom = addDays(today, -(EMPTY_STATE_WINDOW_DAYS - 1))
		const rangeFrom = addDays(today, -(range - 1))

		const [latestWeight, latestWaist, startWeight, totalsByDay, goal] = await Promise.all([
			this.measurementsService.findLatest({ userId, kind: MeasurementKind.WEIGHT }),
			this.measurementsService.findLatest({ userId, kind: MeasurementKind.WAIST }),
			this.measurementsService.findFirst({ userId, kind: MeasurementKind.WEIGHT }),
			this.entriesService.getDaysTotals(userId, { from: windowFrom, to: today }),
			this.profileService.findWeightGoal(userId),
		])
		// a week-ago weight may predate the window when the latest weigh-in is old
		const weightHistory = latestWeight
			? await this.measurementsService.findInRange({
					userId,
					kind: MeasurementKind.WEIGHT,
					from: getEarlier(windowFrom, addDays(latestWeight.localDate, -WEEK_CHANGE_MAX_DAYS)),
					to: today,
				})
			: []
		const waistHistory = latestWaist
			? await this.measurementsService.findInRange({
					userId,
					kind: MeasurementKind.WAIST,
					from: rangeFrom,
					to: today,
				})
			: []

		const week = await this.buildWeek(userId, formatDbDate(today), totalsByDay)
		const weighingCount = weightHistory.filter((row) => row.localDate >= windowFrom).length
		const isEmpty =
			totalsByDay.size < MIN_FOOD_DAYS_FOR_PROGRESS && weighingCount < MIN_WEIGHINGS_FOR_PROGRESS

		return {
			range,
			from: formatDbDate(rangeFrom),
			to: formatDbDate(today),
			isEmpty,
			weight: latestWeight
				? this.buildWeight({
						latest: latestWeight,
						start: startWeight,
						history: weightHistory,
						rangeFrom,
						goal,
					})
				: null,
			waist: latestWaist ? this.buildTrend(latestWaist, waistHistory, rangeFrom) : null,
			week,
			insight: {
				weekPaceKg: getWeekPaceKg({ latest: latestWeight, history: weightHistory, today }),
				planPaceKgPerWeek: hasWeightDirection(goal.goalType) ? goal.paceKgPerWeek : null,
				goalType: goal.goalType,
				overDays: week.days.filter((day) => day.status === 'over').length,
				isWeekendProteinLow: getIsWeekendProteinLow(
					week.days.map((day) => ({
						localDate: day.localDate,
						proteinG: day.proteinG,
						hasEntries: day.status !== 'empty',
					})),
				),
			},
		}
	}

	private buildTrend(
		latest: MeasurementValue,
		history: MeasurementValue[],
		rangeFrom: Date,
	): ProgressWaist {
		const points = history.filter((row) => row.localDate >= rangeFrom).map(toPoint)
		const first = points.at(0)
		const last = points.at(-1)
		return {
			current: toPoint(latest),
			changeInRange:
				first && last && points.length > 1 ? subtractTenths(last.value, first.value) : null,
			points,
		}
	}

	private buildWeight({
		latest,
		start,
		history,
		rangeFrom,
		goal,
	}: {
		latest: MeasurementValue
		start: MeasurementValue | null
		history: MeasurementValue[]
		rangeFrom: Date
		goal: WeightGoal
	}): ProgressWeight {
		const { goalType, targetWeightKg } = goal
		return {
			...this.buildTrend(latest, history, rangeFrom),
			target: targetWeightKg,
			toGoal: hasWeightDirection(goalType)
				? getKgToGoal({ goalType, current: latest.value, target: targetWeightKg })
				: null,
			isGoalReached: getIsGoalReached({ goalType, current: latest.value, target: targetWeightKg }),
			start: start ? toPoint(start) : null,
			// the start has nothing to be compared with
			fromStart: start && start.id !== latest.id ? subtractTenths(latest.value, start.value) : null,
		}
	}

	private async buildWeek(
		userId: string,
		today: string,
		totalsByDay: Awaited<ReturnType<EntriesService['getDaysTotals']>>,
	): Promise<ProgressWeek> {
		const weekDates = listDays(
			formatDbDate(addDays(new Date(`${today}T00:00:00Z`), -(WEEK_DAYS - 1))),
			today,
		)
		const goalByDay = await this.goalsService.getGoalKcalByDay(userId, weekDates)
		const days = weekDates.map((localDate) => {
			const { kcal, proteinG, entryCount } = totalsByDay.get(localDate) ?? {
				kcal: 0,
				proteinG: 0,
				entryCount: 0,
			}
			const goalKcal = goalByDay.get(localDate) ?? null
			return { localDate, kcal, proteinG, status: getDayStatus({ kcal, entryCount, goalKcal }) }
		})
		const logged = days.filter((day) => day.status !== 'empty')
		return {
			days,
			goalKcal: goalByDay.get(today) ?? null,
			avgKcal: averageOrNull(logged.map((day) => day.kcal)),
			avgProteinG: averageOrNull(logged.map((day) => day.proteinG)),
		}
	}
}
