import { normalizeExerciseName } from './exercise-name.js'

/**
 * Alternatives; every stem of one alternative must start some word of the name (as in the muscle
 * group rules), so endings do not matter.
 */
const BODYWEIGHT_NAME_RULES: readonly (readonly string[])[] = [
	['підтягув'],
	['подтягив'],
	['віджиман'],
	['отжиман'],
	['скручув'],
	['скручив'],
	['планк'],
	['підйом', 'ніг', 'вис'],
	['подъем', 'ног', 'вис'],
	['бурпі'],
	['бурпи'],
	['pull', 'up'],
	['pullup'],
	['chin', 'up'],
	['chinup'],
	['push', 'up'],
	['pushup'],
	['plank'],
	['burpee'],
	['crunch'],
	['dip'],
]

const matchesStems = (words: readonly string[], stems: readonly string[]): boolean =>
	stems.every((stem) => words.some((word) => word.startsWith(stem)))

/**
 * The last resort for «no weight on the bar»: an exercise whose name says the body is the load.
 * Used only when neither the entry nor the dictionary knows.
 */
export const isBodyweightByName = (name: string): boolean => {
	const words = normalizeExerciseName(name).split(' ').filter(Boolean)
	return BODYWEIGHT_NAME_RULES.some((stems) => matchesStems(words, stems))
}
