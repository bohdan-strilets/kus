import { Injectable } from '@nestjs/common'

import type { Prisma } from '../../generated/prisma/client'
import { getBodyweightMaxReps, isRecord, type WorkoutRecord } from './workout-turn'
import { type WorkoutWithExercises, WorkoutsRepository } from './workouts.repository'

/** The records of a session, one place for the chat, «Завершити» and the form. */
@Injectable()
export class WorkoutRecordsService {
	constructor(private readonly workoutsRepository: WorkoutsRepository) {}

	/**
	 * Compares the workout with the other ones (an open live session is not among them) and stores
	 * what it beats: a heavier set, a longer distance or (without weight) more reps is a record.
	 */
	async computeRecords(
		userId: string,
		workout: WorkoutWithExercises,
		tx: Prisma.TransactionClient,
	): Promise<WorkoutRecord[]> {
		const records: WorkoutRecord[] = []
		for (const exercise of workout.exercises) {
			if (exercise.exerciseId === null) continue
			const key = { userId, exerciseId: exercise.exerciseId, exceptWorkoutId: workout.id }
			const heaviest = Math.max(
				0,
				...exercise.sets.flatMap((set) =>
					!set.isWarmup && set.weightKg !== null ? [set.weightKg.toNumber()] : [],
				),
			)
			if (
				heaviest > 0 &&
				isRecord(await this.workoutsRepository.findMaxWeightKg(key, tx), heaviest)
			) {
				records.push({ exerciseEntryId: exercise.id, type: 'WEIGHT' })
			}
			if (isRecord(await this.workoutsRepository.findMaxDistanceM(key, tx), exercise.distanceM)) {
				records.push({ exerciseEntryId: exercise.id, type: 'DISTANCE' })
			}
			const reps = getBodyweightMaxReps(exercise.sets)
			if (reps !== null && isRecord(await this.workoutsRepository.findMaxReps(key, tx), reps)) {
				records.push({ exerciseEntryId: exercise.id, type: 'REPS' })
			}
		}
		await this.workoutsRepository.setRecords({ id: workout.id, records }, tx)
		return records
	}
}
