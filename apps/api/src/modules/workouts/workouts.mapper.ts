import { z } from 'zod'
import {
	matchMuscleGroup,
	type MuscleGroup,
	type WorkoutResponse,
	workoutRecordTypeSchema,
} from '@kus/shared'

import { formatDbDate } from '../../common/time'
import type { WorkoutWithExercises } from './workouts.repository'

/** A session shorter than this is one sitting: no «≈ N хв». */
export const ESTIMATED_DURATION_MIN_SPAN_MIN = 10
/**
 * Safety net: longer than this is not one session but times that only look apart (a past day's
 * exercise gets noon as its time). The two-message rule already rules out the known cases.
 */
export const ESTIMATED_DURATION_MAX_SPAN_MIN = 300
/** One message is one moment, whatever its times say: an estimate needs a session told in two. */
const ESTIMATED_DURATION_MIN_MESSAGES = 2
const MS_IN_MINUTE = 60_000

const storedRecordsSchema = z.array(
	z.object({ exerciseEntryId: z.string(), type: workoutRecordTypeSchema }),
)

type ExerciseRow = WorkoutWithExercises['exercises'][number]

/** The dictionary's group, then the snapshot of the entry, then the dictionary of names; cardio has none. */
export const getMuscleGroup = (
	entry: Pick<ExerciseRow, 'kind' | 'name' | 'muscleGroup' | 'exercise'>,
): MuscleGroup | null => {
	if (entry.kind === 'CARDIO') return null
	return entry.exercise?.muscleGroup ?? entry.muscleGroup ?? matchMuscleGroup(entry.name)
}

/**
 * The duration of a session nobody named, from its first exercise to its finish (or its last
 * exercise): only when it was told in at least two messages (the entries' and the finish's) and
 * spans at least 10 minutes.
 */
export const getEstimatedDurationMin = ({
	durationMin,
	finishedAt,
	finishedMessageId,
	entries,
}: {
	durationMin: number | null
	finishedAt: Date | null
	finishedMessageId: string | null
	entries: readonly { performedAt: Date; sourceMessageId: string | null }[]
}): number | null => {
	if (durationMin !== null || entries.length === 0) return null
	const messageIds = new Set(
		[...entries.map((entry) => entry.sourceMessageId), finishedMessageId].filter(
			(id): id is string => id !== null,
		),
	)
	if (messageIds.size < ESTIMATED_DURATION_MIN_MESSAGES) return null
	const times = entries.map((entry) => entry.performedAt.getTime())
	const start = Math.min(...times)
	const end = finishedAt?.getTime() ?? Math.max(...times)
	const minutes = (end - start) / MS_IN_MINUTE
	if (minutes < ESTIMATED_DURATION_MIN_SPAN_MIN || minutes > ESTIMATED_DURATION_MAX_SPAN_MIN) {
		return null
	}
	return Math.round(minutes)
}

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
	isDeleted: workout.deletedAt !== null,
	finishedAt: workout.finishedAt?.toISOString() ?? null,
	estimatedDurationMin: getEstimatedDurationMin({
		durationMin: workout.durationMin,
		finishedAt: workout.finishedAt,
		finishedMessageId: workout.finishedMessageId,
		entries: workout.exercises,
	}),
	exercises: workout.exercises.map((exercise) => ({
		id: exercise.id,
		name: exercise.name,
		kind: exercise.kind,
		muscleGroup: getMuscleGroup(exercise),
		performedAt: exercise.performedAt.toISOString(),
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
