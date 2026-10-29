import { z } from 'zod'
import { type WorkoutResponse, workoutRecordTypeSchema } from '@kus/shared'

import { formatDbDate } from '../../common/time'
import type { WorkoutWithExercises } from './workouts.repository'

const storedRecordsSchema = z.array(
	z.object({ exerciseEntryId: z.string(), type: workoutRecordTypeSchema }),
)

export const toWorkoutResponse = (workout: WorkoutWithExercises): WorkoutResponse => {
	// written by the backend; a value that no longer parses only loses the trophy
	const records = storedRecordsSchema.catch([]).parse(workout.records ?? [])
	return toResponse(workout, records)
}

const toResponse = (
	workout: WorkoutWithExercises,
	records: z.infer<typeof storedRecordsSchema>,
): WorkoutResponse => ({
	id: workout.id,
	localDate: formatDbDate(workout.localDate),
	startedAt: workout.startedAt?.toISOString() ?? null,
	durationMin: workout.durationMin,
	place: workout.place,
	kcalBurned: workout.kcalBurned,
	kcalSource: workout.kcalSource,
	isEdited: workout.editedAt !== null,
	exercises: workout.exercises.map((exercise) => ({
		id: exercise.id,
		name: exercise.name,
		kind: exercise.kind,
		durationMin: exercise.durationMin,
		distanceM: exercise.distanceM,
		record: records.find((record) => record.exerciseEntryId === exercise.id)?.type ?? null,
		sets: exercise.sets.map((set) => ({
			reps: set.reps,
			weightKg: set.weightKg === null ? null : set.weightKg.toNumber(),
			durationSec: set.durationSec,
			distanceM: set.distanceM,
			isWarmup: set.isWarmup,
		})),
	})),
})
