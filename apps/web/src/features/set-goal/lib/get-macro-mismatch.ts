import { KCAL_PER_GRAM } from '@kus/shared'

/** Beyond this the macros describe a noticeably different day than the kcal goal. */
export const MACRO_MISMATCH_SHARE = 0.1

const WHOLE_NUMBER = /^\d+$/

export interface MacroMismatch {
	/** 4·Б + 4·В + 9·Ж */
	macroKcal: number
	/** Rounded % of the kcal goal; positive — the macros give more. */
	deltaPct: number
}

const toNumber = (value: string | undefined): number | null => {
	const trimmed = value?.trim() ?? ''
	return WHOLE_NUMBER.test(trimmed) ? Number(trimmed) : null
}

/**
 * The soft check under the goal fields: null while a field is not a number yet or the macros fit
 * the kcal within 10 %. Never blocks saving — the user may want a different split on purpose.
 */
export const getMacroMismatch = (values: {
	kcal?: string
	protein?: string
	carbs?: string
	fat?: string
}): MacroMismatch | null => {
	const kcal = toNumber(values.kcal)
	const protein = toNumber(values.protein)
	const carbs = toNumber(values.carbs)
	const fat = toNumber(values.fat)
	if (kcal === null || protein === null || carbs === null || fat === null || kcal === 0) {
		return null
	}
	const macroKcal =
		protein * KCAL_PER_GRAM.protein + carbs * KCAL_PER_GRAM.carbs + fat * KCAL_PER_GRAM.fat
	const share = (macroKcal - kcal) / kcal
	if (Math.abs(share) <= MACRO_MISMATCH_SHARE) return null
	return { macroKcal, deltaPct: Math.round(share * 100) }
}
