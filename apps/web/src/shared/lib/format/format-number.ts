import { INTL_LOCALE as LOCALE } from './locale'

/** The typographic minus (CLAUDE-design rule 5: «−1,6», not a hyphen). */
export const MINUS_SIGN = '−'

/** «1 370»: rounded, with the Ukrainian thousands separator. */
export const formatInteger = (value: number): string => Math.round(value).toLocaleString(LOCALE)

/** «82,4»: a decimal comma and a fixed number of fraction digits. */
export const formatDecimal = (value: number, fractionDigits = 1): string =>
	value.toLocaleString(LOCALE, {
		minimumFractionDigits: fractionDigits,
		maximumFractionDigits: fractionDigits,
	})

const withSign = (value: number, formatted: string): string => {
	if (value > 0) return `+${formatted}`
	if (value < 0) return `${MINUS_SIGN}${formatted}`
	return formatted
}

/** «+180», «−40», «0» — over-goal kcal and other integer deltas. */
export const formatSignedInteger = (value: number): string => {
	// round once, so the sign and the digits agree (−0.5 → «0», not «1» without a sign)
	const rounded = Math.round(value)
	return withSign(rounded, formatInteger(Math.abs(rounded)))
}

/** «−1,6», «+0,3» — weight and other decimal deltas. */
export const formatSignedDecimal = (value: number, fractionDigits = 1): string => {
	const rounded = Number(value.toFixed(fractionDigits))
	return withSign(rounded, formatDecimal(Math.abs(rounded), fractionDigits))
}
