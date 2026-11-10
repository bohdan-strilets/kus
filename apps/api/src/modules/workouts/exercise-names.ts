import { matchMuscleGroup, normalizeExerciseName } from '@kus/shared'

import type { ExerciseKind, MuscleGroup } from '../../generated/prisma/enums'

const STEM_LENGTH = 5
const MIN_WORD_LENGTH = 3

/**
 * Whether the name the model wrote can be the dictionary exercise it pointed at by x-ref: the name
 * or an alias contains it or is contained in it («жим» for «Жим лежачи»). Nothing in common = the
 * model took the wrong ref, and the name decides.
 */
export const isSameExercise = (
	givenName: string,
	{ name, aliases }: { name: string; aliases?: readonly string[] },
): boolean => {
	const given = normalizeExerciseName(givenName)
	if (!given) return false
	return [name, ...(aliases ?? [])].some((candidate) => {
		const known = normalizeExerciseName(candidate)
		return known !== '' && (known.includes(given) || given.includes(known))
	})
}

const tokenize = (text: string): string[] => normalizeExerciseName(text).split(' ').filter(Boolean)

const toWords = (text: string): string[] =>
	tokenize(text).filter((word) => word.length >= MIN_WORD_LENGTH)

/** Same word up to the ending: «жим» = «жимом», «лежачи» = «лежачим». */
const isSameWord = (first: string, second: string): boolean =>
	first.startsWith(second) ||
	second.startsWith(first) ||
	first.slice(0, STEM_LENGTH) === second.slice(0, STEM_LENGTH)

const isSubset = (small: readonly string[], big: readonly string[]): boolean =>
	small.length > 0 && small.every((word) => big.some((other) => isSameWord(word, other)))

/** What the model wrote for an exercise, as far as the same-exercise check needs it. */
export interface GivenExercise {
	name: string
	kind: ExerciseKind
	/** The group the model (or a program draft) holds; the dictionary of names fills the gap. */
	muscleGroup?: MuscleGroup | null
}

interface KnownExercise {
	name: string
	kind: ExerciseKind
	muscleGroup: MuscleGroup | null
	aliases?: readonly string[]
}

/**
 * Whether the given name can mean this dictionary row: one name holds the other (isSameExercise),
 * or every word of the shorter one is a word of the longer one, whatever the endings («жимом
 * лежачи» = «Жим лежачи»). «Жим від грудей» is NOT «Жим лежачи»: each has a word the other lacks,
 * so they stay two exercises. Cardio never meets strength, and two different groups never meet.
 */
export const canBeSameExercise = (given: GivenExercise, row: KnownExercise): boolean => {
	if ((given.kind === 'CARDIO') !== (row.kind === 'CARDIO')) return false
	const givenGroup = given.muscleGroup ?? matchMuscleGroup(given.name)
	const rowGroup = row.muscleGroup ?? matchMuscleGroup(row.name)
	if (givenGroup !== null && rowGroup !== null && givenGroup !== rowGroup) return false
	if (isSameExercise(given.name, row)) return true
	const givenWords = toWords(given.name)
	return [row.name, ...(row.aliases ?? [])].some((candidate) => {
		const known = toWords(candidate)
		return isSubset(givenWords, known) || isSubset(known, givenWords)
	})
}

/** Whether the row already is this name or has it as an alias (both normalized). */
export const hasExerciseName = (
	givenName: string,
	{ name, aliases }: { name: string; aliases?: readonly string[] },
): boolean => {
	const given = normalizeExerciseName(givenName)
	return [name, ...(aliases ?? [])].some((known) => normalizeExerciseName(known) === given)
}

/**
 * What to do with an x-ref of the model against the user's dictionary:
 * - `exact`: the row has this very name or alias;
 * - `alias`: the only row the name can mean, and it adds something the row does not know;
 * - `accept`: the ref stays, nothing is learned: several rows fit the name («жим» with «Жим лежачи»
 *   and «Жим від грудей» — the ref is the model's pick among the listed ones), or the name is a
 *   shorter wording of the row;
 * - `reject`: the ref is another exercise than the name says; the name decides.
 */
export type RefVerdict = 'exact' | 'alias' | 'accept' | 'reject'

export const judgeExerciseRef = (
	given: GivenExercise,
	ref: KnownExercise & { id: string },
	dictionary: readonly (KnownExercise & { id: string })[],
): RefVerdict => {
	if (hasExerciseName(given.name, ref)) return 'exact'
	if (!canBeSameExercise(given, ref)) return 'reject'
	const fits = dictionary.filter((row) => row.id === ref.id || canBeSameExercise(given, row))
	if (fits.length > 1) return 'accept'
	// a shorter wording («жим» for «Жим лежачи») is a nickname that would claim every «жим» later
	const isShorter = normalizeExerciseName(ref.name).includes(normalizeExerciseName(given.name))
	return isShorter ? 'accept' : 'alias'
}

/**
 * Whether the words of the message may mean this exercise: one word of its name (or of an alias)
 * starts like a word of the message. «жим» finds «Жим лежачи» (so does «жимом» — the stem ignores
 * endings), and «Жим стоячи» comes along: the model picks the right one from the list.
 */
export const isExerciseNamed = (
	text: string,
	{ name, aliases }: { name: string; aliases: readonly string[] },
): boolean => {
	const words = tokenize(text)
	if (words.length === 0) return false
	return [name, ...aliases].some((candidate) =>
		tokenize(candidate).some(
			(part) =>
				part.length >= MIN_WORD_LENGTH &&
				words.some((word) => word.startsWith(part.slice(0, STEM_LENGTH))),
		),
	)
}
