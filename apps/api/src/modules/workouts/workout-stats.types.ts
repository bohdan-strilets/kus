import type { ExerciseKind, ExerciseSource, MuscleGroup } from '@kus/shared'

/** What the repository returns for the stats: dates are `YYYY-MM-DD`, Decimal is already a number. */
export type StatsSetRow = {
	reps: number | null
	weightKg: number | null
	durationSec: number | null
	distanceM: number | null
	isWarmup: boolean
}

export type StatsEntryRow = {
	workoutId: string
	workoutLocalDate: string
	position: number
	exerciseId: string | null
	name: string
	kind: ExerciseKind
	/** The snapshot on the entry. */
	muscleGroup: MuscleGroup | null
	exercise: { muscleGroup: MuscleGroup | null } | null
	durationMin: number | null
	distanceM: number | null
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
	/** Every live entry of the workout, only their times feed the duration estimate. */
	entries: readonly { performedAt: Date; sourceMessageId: string | null }[]
}
