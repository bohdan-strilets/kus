import { Injectable } from '@nestjs/common'
import {
	getDayVerdict,
	shiftDate,
	STATS_CARD_VERSION,
	STATS_PERIOD_DAYS,
	type StatsCard,
	type StatsPeriod,
} from '@kus/shared'

import { listDays } from '../../common/time'
import { MeasurementKind } from '../../generated/prisma/client'
import { EntriesService } from '../entries/entries.service'
import { GoalsService } from '../goals/goals.service'
import { MeasurementsService } from '../measurements/measurements.service'
import { subtractTenths } from '../measurements/measurements.utils'
import { averageOrNull, buildStatusDays, getDaysInNorm, getLoggedDays } from './progress.utils'

interface BuildStatsCardParams {
	userId: string
	period: StatsPeriod
	/** `YYYY-MM-DD` the period ends on; null = today. */
	endDate: string | null
	/** `YYYY-MM-DD` of the user's today. */
	today: string
}

const toDbDate = (date: string): Date => new Date(`${date}T00:00:00Z`)

/** The week or month card of show_stats: every number counted here, none taken from the model. */
@Injectable()
export class ProgressStatsService {
	constructor(
		private readonly entriesService: EntriesService,
		private readonly goalsService: GoalsService,
		private readonly measurementsService: MeasurementsService,
	) {}

	/**
	 * Days are counted exactly like on «Прогрес» (see progress.utils): a day counts once anything is
	 * logged, today included. null when nothing was logged in the period: the reply stays text.
	 */
	async build({ userId, period, endDate, today }: BuildStatsCardParams): Promise<StatsCard | null> {
		const to = endDate === null || endDate > today ? today : endDate
		const from = shiftDate(to, -(STATS_PERIOD_DAYS[period] - 1))
		const days = listDays(from, to)

		const [totalsByDay, goalByDay, lastGoal, weights] = await Promise.all([
			this.entriesService.getDaysTotals(userId, { from: toDbDate(from), to: toDbDate(to) }),
			this.goalsService.getGoalKcalByDay(userId, days),
			this.goalsService.getGoalForDate(userId, toDbDate(to)),
			this.measurementsService.findInRange({
				userId,
				kind: MeasurementKind.WEIGHT,
				from: toDbDate(from),
				to: toDbDate(to),
			}),
		])
		const statusDays = buildStatusDays({ dates: days, totalsByDay, goalByDay })
		const logged = getLoggedDays(statusDays)
		if (logged.length === 0) return null

		const firstWeight = weights.length > 1 ? weights.at(0) : undefined
		const lastWeight = weights.length > 1 ? weights.at(-1) : undefined
		return {
			version: STATS_CARD_VERSION,
			period,
			from,
			to,
			loggedDays: logged.length,
			daysInNorm: getDaysInNorm(statusDays),
			avgKcal: averageOrNull(logged.map((day) => day.kcal)),
			avgProteinG: averageOrNull(logged.map((day) => day.proteinG)),
			goalKcal: goalByDay.get(to) ?? null,
			weightChangeKg:
				firstWeight && lastWeight ? subtractTenths(lastWeight.value, firstWeight.value) : null,
			proteinGoalG: lastGoal?.protein ?? null,
			weightStartKg: firstWeight?.value ?? null,
			weightEndKg: lastWeight?.value ?? null,
			days: logged.map(({ localDate, kcal, goalKcal }) => ({
				date: localDate,
				kcal,
				verdict: getDayVerdict({
					kcal,
					entryCount: totalsByDay.get(localDate)?.entryCount ?? 0,
					goalKcal,
				}),
			})),
		}
	}
}
