import { Injectable } from '@nestjs/common'
import { type BodyWeightMeasurement, pickBodyWeight, type WorkoutResponse } from '@kus/shared'

import { formatDbDate, toDbDate } from '../../common/time'
import { MeasurementsService } from '../measurements/measurements.service'
import { toWorkoutResponse } from './workouts.mapper'
import type { WorkoutWithExercises } from './workouts.repository'

export type BodyWeightPicker = (localDate: string) => number | null

const NO_WEIGHT: BodyWeightPicker = () => null

/** Body weight for the calorie estimate: one query per answer, then a pick per workout day. */
@Injectable()
export class WorkoutKcalService {
	constructor(private readonly measurementsService: MeasurementsService) {}

	/** The picker for the given `YYYY-MM-DD` days; reads the weigh-ins once. */
	async getBodyWeightPicker(
		userId: string,
		localDates: readonly string[],
	): Promise<BodyWeightPicker> {
		if (localDates.length === 0) return NO_WEIGHT
		const sorted = [...localDates].sort()
		const measurements: BodyWeightMeasurement[] = await this.measurementsService.findWeightsAround({
			userId,
			from: toDbDate(sorted[0] ?? ''),
			to: toDbDate(sorted[sorted.length - 1] ?? ''),
		})
		return (localDate) => pickBodyWeight(measurements, localDate)
	}

	/** The rows as responses, with the estimated kcal where the body weight is known. */
	async toResponses(
		userId: string,
		rows: readonly WorkoutWithExercises[],
	): Promise<WorkoutResponse[]> {
		const pick = await this.getBodyWeightPicker(
			userId,
			rows.map((row) => formatDbDate(row.localDate)),
		)
		return rows.map((row) =>
			toWorkoutResponse(row, { bodyWeightKg: pick(formatDbDate(row.localDate)) }),
		)
	}
}
