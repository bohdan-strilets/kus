import type { MuscleGroup } from '../schemas/enums.js'
import { normalizeExerciseName } from './exercise-name.js'
import { MUSCLE_GROUP_RULES } from './muscle-group-rules.js'

/** The fixed order groups are shown in everywhere (design/docs/training-groups.md). */
export const TRAINING_GROUP_ORDER = [
	'CARDIO',
	'CHEST',
	'BACK',
	'LEGS',
	'SHOULDERS',
	'ARMS',
	'CORE',
] as const
/** CARDIO is a display key, not a MuscleGroup: in the data it is ExerciseKind CARDIO. */
export type TrainingGroupKey = (typeof TRAINING_GROUP_ORDER)[number]

const matchesStems = (words: readonly string[], stems: readonly string[]): boolean =>
	stems.every((stem) => words.some((word) => word.startsWith(stem)))

/**
 * The main muscle group of a strength exercise by its name, or null when the name is cardio or
 * unknown: then the model (or the person) decides.
 */
export const matchMuscleGroup = (name: string): MuscleGroup | null => {
	const words = normalizeExerciseName(name).split(' ').filter(Boolean)
	if (words.length === 0) return null
	const rule = MUSCLE_GROUP_RULES.find(({ keywords }) =>
		keywords.some((stems) => matchesStems(words, stems)),
	)
	if (!rule || rule.group === null || rule.group === 'CARDIO') return null
	return rule.group
}
