import type { ExerciseKind, ExerciseSource, MuscleGroup, WorkoutRecordType } from '@kus/shared'

/** What the repository returns for the stats: dates are `YYYY-MM-DD`, Decimal is already a number. */
export type StatsSetRow = {
	reps: number | null
	weightKg: number | null
	durationSec: number | null
	distanceM: number | null
	isWarmup: boolean
}

export type StatsEntryRow = {
	id: string
	performedAt: Date
	workoutId: string
	workoutLocalDate: string
	position: number
	exerciseId: string | null
	name: string
	kind: ExerciseKind
	/** The snapshot on the entry. */
	muscleGroup: MuscleGroup | null
	exercise: { muscleGroup: MuscleGroup | null; isBodyweight?: boolean | null } | null
	/** The entry's own flag for the kcal estimate; null = unknown. */
	isBodyweight: boolean | null
	durationMin: number | null
	distanceM: number | null
	/** Named by the user or a device (cardio). */
	kcalBurned: number | null
	source: ExerciseSource
	/** In position order. */
	sets: StatsSetRow[]
}

export type StatsWorkoutRow = {
	id: string
	localDate: string
	durationMin: number | null
	kcalBurned: number | null
	kcalSource: ExerciseSource | null
	finishedAt: Date | null
	finishedMessageId: string | null
	/** The name of the template version the workout followed; null for a free workout. */
	templateName: string | null
	/** Records the workout set when it was logged; a value that no longer parses is none. */
	records: readonly { exerciseEntryId: string; type: WorkoutRecordType }[]
	/** Every live entry of the workout, only their times feed the duration estimate. */
	entries: readonly { performedAt: Date; sourceMessageId: string | null }[]
}
