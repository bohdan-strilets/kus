const DECIMAL_PATTERN = /^\d+(\.\d+)?$/

/** «82,4» → 82.4: a number typed in a text field, comma or dot; anything else is null. */
export const parseDecimalInput = (raw: string): number | null => {
	const normalized = raw.replace(/\s+/g, '').replace(',', '.')
	if (!DECIMAL_PATTERN.test(normalized)) return null
	return Number(normalized)
}
