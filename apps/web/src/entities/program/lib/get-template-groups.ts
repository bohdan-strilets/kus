import {
	type ExerciseKind,
	type MuscleGroup,
	TRAINING_GROUP_ORDER,
	type TrainingGroupKey,
} from '@kus/shared'

/** The groups of a template in the fixed display order: «Кардіо» first, then the muscle groups. */
export const getTemplateGroups = (
	exercises: readonly { kind: ExerciseKind; muscleGroup: MuscleGroup | null }[],
): TrainingGroupKey[] => {
	const present = new Set<TrainingGroupKey>()
	for (const exercise of exercises) {
		if (exercise.kind === 'CARDIO') present.add('CARDIO')
		else if (exercise.muscleGroup !== null) present.add(exercise.muscleGroup)
	}
	return TRAINING_GROUP_ORDER.filter((group) => present.has(group))
}

/** The dot of an exercise row; an exercise with no group has none. */
export const getExerciseGroup = (exercise: {
	kind: ExerciseKind
	muscleGroup: MuscleGroup | null
}): TrainingGroupKey | null => (exercise.kind === 'CARDIO' ? 'CARDIO' : exercise.muscleGroup)
