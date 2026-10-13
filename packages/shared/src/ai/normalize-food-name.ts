// Models sometimes put a Latin look-alike into a Cyrillic word ("курячa" with a Latin "a"). It
// looks the same but breaks search, memory matching and duplicates detection, so it is fixed
// before an AI name is saved.

const LATIN_TO_CYRILLIC: Readonly<Record<string, string>> = {
	a: 'а',
	e: 'е',
	o: 'о',
	p: 'р',
	c: 'с',
	x: 'х',
	i: 'і',
	A: 'А',
	E: 'Е',
	O: 'О',
	P: 'Р',
	C: 'С',
	X: 'Х',
	I: 'І',
}

const WORD_PATTERN = /[\p{L}\p{N}\p{M}]+/gu
const CYRILLIC_PATTERN = /\p{Script=Cyrillic}/u
const LOOKALIKE_PATTERN = /[aeopcxiAEOPCXI]/g
const LONE_LETTER_PATTERN = /^[acio]$/

/**
 * Replaces Latin look-alikes (a e o p c x i) with Cyrillic ones in every word that already has a
 * Cyrillic letter. A word is a run of letters and digits, so a hyphen or an apostrophe splits
 * words: "Coca-Cola", "Milka" and "KFC" stay as they are, and in "Кока-Cola" the brand part is
 * left alone (a Latin-only word is a brand until proven otherwise).
 *
 * Exception: a lone lowercase Latin "c i o a" is a Cyrillic preposition or conjunction when the
 * name has Cyrillic anywhere ("кава c молоком" → "кава с молоком"). Uppercase ("Вітамін C") and
 * "x" ("2 x 100 г гречки") stay as they are; a name with no Cyrillic is never touched.
 */
export const normalizeFoodName = (name: string): string => {
	const hasCyrillic = CYRILLIC_PATTERN.test(name)
	return name.replace(WORD_PATTERN, (word) => {
		if (CYRILLIC_PATTERN.test(word)) {
			return word.replace(LOOKALIKE_PATTERN, (letter) => LATIN_TO_CYRILLIC[letter] ?? letter)
		}
		const isLoneLetter = hasCyrillic && LONE_LETTER_PATTERN.test(word)
		return isLoneLetter ? (LATIN_TO_CYRILLIC[word] ?? word) : word
	})
}
