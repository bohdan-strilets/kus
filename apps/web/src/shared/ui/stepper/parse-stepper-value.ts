export interface StepperValueLimits {
	min: number
	max: number
	/** Digits after the separator; 0 = whole numbers only. */
	decimals: number
}

const NUMBER_PATTERN = /^\d+(?:[.,]\d+)?$/

/** «2,5» and «2.5» alike; null when it is not a number, has too many digits or is out of range. */
export const parseStepperValue = (
	text: string,
	{ min, max, decimals }: StepperValueLimits,
): number | null => {
	const trimmed = text.trim()
	if (!NUMBER_PATTERN.test(trimmed)) return null
	const value = Number(trimmed.replace(',', '.'))
	if (!Number.isFinite(value)) return null
	const fraction = trimmed.split(/[.,]/)[1] ?? ''
	if (fraction.length > decimals) return null
	return value < min || value > max ? null : value
}
