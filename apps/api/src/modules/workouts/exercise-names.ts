import { normalizeExerciseName } from '@kus/shared'

const STEM_LENGTH = 5
const MIN_WORD_LENGTH = 3

const tokenize = (text: string): string[] => normalizeExerciseName(text).split(' ').filter(Boolean)

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
