import type { TFunction } from 'i18next'

const SECOND_CHAR_INDEX = 1

/** «Кабаноси Tarczyński» reads «кабаноси Tarczyński» in a sentence; «KFC бургер» keeps its acronym. */
export const lowercaseFirst = (name: string): string => {
	const first = name.charAt(0)
	const second = name.charAt(SECOND_CHAR_INDEX)
	if (second !== '' && second !== second.toLowerCase()) return name
	return first.toLowerCase() + name.slice(SECOND_CHAR_INDEX)
}

/**
 * The line that replaces the button: one food by name, several by count. A list of names would
 * not fit one line of the card.
 */
export const getRememberedLabel = (names: readonly string[], t: TFunction): string => {
	const [only] = names
	if (names.length === 1 && only !== undefined) {
		return t('remember.done', { name: lowercaseFirst(only) })
	}
	return t('remember.doneMany', { count: names.length })
}
