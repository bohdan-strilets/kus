import { Injectable, Logger } from '@nestjs/common'
import type { WorkoutResponse, WorkoutsRangeQuery } from '@kus/shared'

import { toDbDate } from '../../common/time'
import { WorkoutNotFoundException } from './workouts.exceptions'
import { toWorkoutResponse } from './workouts.mapper'
import { WorkoutsRepository } from './workouts.repository'

@Injectable()
export class WorkoutsService {
	private readonly logger = new Logger(WorkoutsService.name)

	constructor(private readonly workoutsRepository: WorkoutsRepository) {}

	/** The workouts of one day, in the order they were logged. */
	async getDay(userId: string, localDate: string): Promise<WorkoutResponse[]> {
		const workouts = await this.workoutsRepository.findOfDay({
			userId,
			localDate: toDbDate(localDate),
		})
		return workouts.map(toWorkoutResponse)
	}

	/** The workouts of the days `from … to`, newest first: the tab groups them by day. */
	async getRange(userId: string, { from, to }: WorkoutsRangeQuery): Promise<WorkoutResponse[]> {
		const workouts = await this.workoutsRepository.findInRange({
			userId,
			from: toDbDate(from),
			to: toDbDate(to),
		})
		return workouts.map(toWorkoutResponse)
	}

	/** One live workout of the owner — the session screen; another user's or a deleted one is 404. */
	async getOne(userId: string, id: string): Promise<WorkoutResponse> {
		const workout = await this.workoutsRepository.findLiveOwned({ userId, id })
		if (!workout) throw new WorkoutNotFoundException()
		return toWorkoutResponse(workout)
	}

	async remove(userId: string, id: string): Promise<void> {
		if (!(await this.workoutsRepository.softDelete({ userId, id }))) {
			throw new WorkoutNotFoundException()
		}
		this.logger.log(`Workout deleted user=${userId} workout=${id}`)
	}

	/** Idempotent: a workout that was not deleted comes back as it is. */
	async restore(userId: string, id: string): Promise<WorkoutResponse> {
		if (await this.workoutsRepository.restore({ userId, id })) {
			this.logger.log(`Workout restored user=${userId} workout=${id}`)
		}
		const workout = await this.workoutsRepository.findOwned({ userId, id })
		if (!workout) throw new WorkoutNotFoundException()
		return toWorkoutResponse(workout)
	}
}
