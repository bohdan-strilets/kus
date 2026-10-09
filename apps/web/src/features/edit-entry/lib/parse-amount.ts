/** Digits only: «150», never «12,5» or «150 г». */
export const WHOLE_NUMBER = /^\d+$/

/** The typed weight as a number; null while it is not a whole number yet. */
export const parseAmount = (value: string): number | null => {
	const trimmed = value.trim()
	return WHOLE_NUMBER.test(trimmed) ? Number(trimmed) : null
}
