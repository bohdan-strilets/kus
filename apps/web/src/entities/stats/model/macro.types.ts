/** Always in this order on screen: protein → carbs → fat (CLAUDE-design rule 3). */
export const MACRO_ORDER = ['protein', 'carbs', 'fat'] as const

export type MacroKey = (typeof MACRO_ORDER)[number]

export interface MacroProgress {
	/** grams eaten */
	value: number
	/** grams per day */
	goal: number
}

export type MacroProgressSet = Record<MacroKey, MacroProgress>
