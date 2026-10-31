/**
 * Case, punctuation and spacing do not make a different exercise: «Жим  лежачи.» = «жим лежачи».
 * A name of nothing but symbols keeps its own (lower-cased) text, so such names do not all collapse
 * into one dictionary row.
 */
export const normalizeExerciseName = (name: string): string =>
	name
		.toLowerCase()
		.replace(/[^\p{L}\p{N}]+/gu, ' ')
		.trim() || name.trim().toLowerCase()
