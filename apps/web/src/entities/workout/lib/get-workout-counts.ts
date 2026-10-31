import type { WorkoutExerciseResponse } from '@kus/shared'

export interface WorkoutCounts {
	/** Strength exercises only: cardio is told apart (design rule of 0.10.0). */
	exerciseCount: number
	/** Working sets of the strength exercises; warm-ups do not count. */
	setCount: number
	/** Sum of the named minutes of cardio; null when there is cardio but no minutes. */
	cardioMinutes: number | null
	hasCardio: boolean
}

/**
 * Counts of a session as the chat cards and the session screen say them: «7 вправ · 20 підходів ·
 * кардіо 25 хв». Strength only for exercises and sets, warm-ups excluded; cardio apart.
 */
export const getWorkoutCounts = (
	exercises: readonly Pick<WorkoutExerciseResponse, 'kind' | 'sets' | 'durationMin'>[],
): WorkoutCounts => {
	const cardio = exercises.filter((exercise) => exercise.kind === 'CARDIO')
	const strength = exercises.filter((exercise) => exercise.kind !== 'CARDIO')
	const minutes = cardio.reduce((sum, exercise) => sum + (exercise.durationMin ?? 0), 0)
	return {
		exerciseCount: strength.length,
		setCount: strength.reduce(
			(sum, exercise) => sum + exercise.sets.filter((set) => !set.isWarmup).length,
			0,
		),
		cardioMinutes: minutes > 0 ? minutes : null,
		hasCardio: cardio.length > 0,
	}
}
