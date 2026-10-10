import { getMacroKcal, isGoalConsistent } from '@kus/shared'

const WHOLE_NUMBER = /^\d+$/
const PERCENT = 100

export interface MacroHint {
	/** 4·Б + 4·В + 9·Ж */
	macroKcal: number
	/** Rounded % of the kcal goal; positive — the macros give more. */
	deltaPct: number
	/** Within the tolerance the API accepts. */
	isConsistent: boolean
}

const toNumber = (value: string | undefined): number | null => {
	const trimmed = value?.trim() ?? ''
	return WHOLE_NUMBER.test(trimmed) ? Number(trimmed) : null
}

/** The line under the goal fields: null while a field is not a number yet or kcal is 0. */
export const getMacroHint = (values: {
	kcal?: string
	protein?: string
	carbs?: string
	fat?: string
}): MacroHint | null => {
	const kcal = toNumber(values.kcal)
	const proteinG = toNumber(values.protein)
	const carbsG = toNumber(values.carbs)
	const fatG = toNumber(values.fat)
	if (kcal === null || proteinG === null || carbsG === null || fatG === null || kcal === 0) {
		return null
	}
	const macros = { proteinG, carbsG, fatG }
	const macroKcal = getMacroKcal(macros)
	return {
		macroKcal,
		// the size rounded half away from zero, so it reads the same as the schema's message
		deltaPct:
			Math.sign(macroKcal - kcal) * Math.round((Math.abs(macroKcal - kcal) / kcal) * PERCENT),
		isConsistent: isGoalConsistent(kcal, macros),
	}
}
