const WORD_PATTERN = /\p{L}+/gu
const CYRILLIC_PATTERN = /\p{Script=Cyrillic}/u
const LATIN_PATTERN = /\p{Script=Latin}/u

/** Words (runs of letters) that mix Cyrillic and Latin letters — a Latin "a" slipped into «курячa». */
export const findMixedScriptWords = (text: string): string[] => {
	const words = text.match(WORD_PATTERN) ?? []
	const mixed = words.filter((word) => CYRILLIC_PATTERN.test(word) && LATIN_PATTERN.test(word))
	return [...new Set(mixed)]
}
