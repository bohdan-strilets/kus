// Cheap fuzzy match of saved foods (MyFood) against a chat message, tolerant to Ukrainian endings
// ("гречка" ↔ "гречки"). Shared by the backend and the eval; runs in memory (docs/database.md).

const MIN_WORD_LENGTH = 3
const MIN_PREFIX_LENGTH = 3
/** Characters an inflected ending may change: "яйце" → "яйця", "гречка" → "гречкою". */
const ENDING_LENGTH = 2

/** Same normalization as MyFood.nameNormalized: lowercase, trimmed, single spaces. */
export const normalizeName = (name: string): string =>
	name.trim().toLowerCase().replace(/\s+/g, ' ')

const toWords = (text: string): string[] =>
	normalizeName(text)
		.split(/[^\p{L}\p{N}]+/u)
		.filter((word) => word.length > 0)

const getStem = (word: string): string =>
	word.slice(0, Math.max(MIN_PREFIX_LENGTH, word.length - ENDING_LENGTH))

/** Every significant word of the name occurs in the text, up to its ending. */
const isNameMentioned = (name: string, textWords: string[]): boolean => {
	const nameWords = toWords(name).filter((word) => word.length >= MIN_WORD_LENGTH)
	if (nameWords.length === 0) return false
	return nameWords.every((nameWord) => {
		const stem = getStem(nameWord)
		return textWords.some((textWord) => textWord.startsWith(stem))
	})
}

export const isFoodMentioned = (
	food: { nameNormalized: string; aliases: string[] },
	text: string,
): boolean => {
	const textWords = toWords(text)
	return [food.nameNormalized, ...food.aliases].some((name) => isNameMentioned(name, textWords))
}
