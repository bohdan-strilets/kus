import {
	TRAINING_GROUP_ORDER,
	type TrainingGroupKey,
	type WorkoutExerciseResponse,
	type WorkoutResponse,
	type WorkoutSetResponse,
} from '@kus/shared'

/** The section of strength exercises whose group is unknown: shown last, without a tag. */
export const OTHER_SECTION = 'OTHER'

export interface SessionSection {
	key: TrainingGroupKey | typeof OTHER_SECTION
	/** null for the section without a tag. */
	group: TrainingGroupKey | null
	/** In the order they were done. */
	exercises: WorkoutExerciseResponse[]
	/** Working sets of the strength exercises of the section; 0 for cardio. */
	setCount: number
	/** Sum of the named minutes of a cardio section; null when none was named or it is not cardio. */
	cardioMinutes: number | null
}

export interface SessionView {
	sections: SessionSection[]
	/** null when there is no strength exercise: the tile is not shown. */
	strength: { exerciseCount: number; setCount: number } | null
	/** null when there is no cardio, or neither minutes nor distance were named. */
	cardio: { minutes: number | null; distanceM: number | null } | null
}

const isWorking = (set: WorkoutSetResponse): boolean => !set.isWarmup

const sumNamed = (values: readonly (number | null)[]): number | null => {
	const named = values.filter((value): value is number => value !== null && value > 0)
	return named.length === 0 ? null : named.reduce((sum, value) => sum + value, 0)
}

const isCardio = (exercise: Pick<WorkoutExerciseResponse, 'kind'>): boolean =>
	exercise.kind === 'CARDIO'

const getSectionKey = (exercise: WorkoutExerciseResponse): SessionSection['key'] => {
	if (isCardio(exercise)) return 'CARDIO'
	return exercise.muscleGroup ?? OTHER_SECTION
}

const buildSection = (
	key: SessionSection['key'],
	exercises: WorkoutExerciseResponse[],
): SessionSection => ({
	key,
	group: key === OTHER_SECTION ? null : key,
	exercises,
	setCount:
		key === 'CARDIO'
			? 0
			: exercises.reduce((sum, exercise) => sum + exercise.sets.filter(isWorking).length, 0),
	cardioMinutes:
		key === 'CARDIO' ? sumNamed(exercises.map((exercise) => exercise.durationMin)) : null,
})

/**
 * What the session screen shows: sections in the fixed order of TRAINING_GROUP_ORDER (empty ones
 * are left out), then the strength exercises without a group. Strength counts exclude cardio and
 * warm-up sets (the same rule as the chat summary).
 */
export const getSessionView = (workout: Pick<WorkoutResponse, 'exercises'>): SessionView => {
	const byKey = new Map<SessionSection['key'], WorkoutExerciseResponse[]>()
	for (const exercise of workout.exercises) {
		const key = getSectionKey(exercise)
		byKey.set(key, [...(byKey.get(key) ?? []), exercise])
	}
	const order: readonly SessionSection['key'][] = [...TRAINING_GROUP_ORDER, OTHER_SECTION]
	const sections = order.flatMap((key) => {
		const exercises = byKey.get(key)
		return exercises ? [buildSection(key, exercises)] : []
	})

	const strengthSections = sections.filter((section) => section.key !== 'CARDIO')
	const cardioExercises = sections.find((section) => section.key === 'CARDIO')?.exercises ?? []
	const minutes = sumNamed(cardioExercises.map((exercise) => exercise.durationMin))
	const distanceM = sumNamed(cardioExercises.map((exercise) => exercise.distanceM))

	return {
		sections,
		strength:
			strengthSections.length === 0
				? null
				: {
						exerciseCount: strengthSections.reduce(
							(sum, section) => sum + section.exercises.length,
							0,
						),
						setCount: strengthSections.reduce((sum, section) => sum + section.setCount, 0),
					},
		cardio: minutes === null && distanceM === null ? null : { minutes, distanceM },
	}
}

/** All working sets are without weight (null or 0) and have reps: «· власна вага». */
export const isBodyweightExercise = (
	exercise: Pick<WorkoutExerciseResponse, 'kind' | 'sets'>,
): boolean => {
	if (isCardio(exercise)) return false
	const working = exercise.sets.filter(isWorking)
	return (
		working.length > 0 && working.every((set) => (set.weightKg ?? 0) === 0 && set.reps !== null)
	)
}
