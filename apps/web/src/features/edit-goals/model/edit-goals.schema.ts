import { GOAL_KCAL, GOAL_MACRO_GRAMS, getMacroKcal, isGoalConsistent } from '@kus/shared'
import type { TFunction } from 'i18next'
import { z } from 'zod'

import { formatInteger } from '@/shared/lib'

const WHOLE_NUMBER = /^\d+$/
const PERCENT = 100

/** A field of digits → a whole number within the API bounds (packages/shared goals.ts). */
const createNumberField = (
	t: TFunction,
	{ min, max, rangeMessage }: { min: number; max: number; rangeMessage: string },
) =>
	z
		.string()
		.trim()
		.min(1, { error: t('goal.validation.required'), abort: true })
		.regex(WHOLE_NUMBER, t('goal.validation.wholeNumber'))
		.transform(Number)
		.pipe(z.number().min(min, rangeMessage).max(max, rangeMessage))

/** «Від 800 до 6 000 ккал» — the range error of a field. */
export const getGoalRangeTexts = (t: TFunction): { kcal: string; macro: string } => ({
	kcal: t('goal.validation.kcalRange', {
		min: formatInteger(GOAL_KCAL.min),
		max: formatInteger(GOAL_KCAL.max),
	}),
	macro: t('goal.validation.macroRange', {
		min: formatInteger(GOAL_MACRO_GRAMS.min),
		max: formatInteger(GOAL_MACRO_GRAMS.max),
	}),
})

/** «З Б/В/Ж виходить ≈ N ккал — на X % більше/менше за ціль. Різниця має бути до 15 %.» */
export const getMacroMismatchText = (
	t: TFunction,
	{ macroKcal, kcal }: { macroKcal: number; kcal: number },
): string => {
	const share = (macroKcal - kcal) / kcal
	return t(share > 0 ? 'editGoals.hintMore' : 'editGoals.hintLess', {
		macroKcal: formatInteger(macroKcal),
		delta: Math.round(Math.abs(share) * PERCENT),
	})
}

export const createEditGoalsSchema = (t: TFunction) => {
	const ranges = getGoalRangeTexts(t)
	const macro = createNumberField(t, { ...GOAL_MACRO_GRAMS, rangeMessage: ranges.macro })
	return z
		.object({
			kcal: createNumberField(t, { ...GOAL_KCAL, rangeMessage: ranges.kcal }),
			protein: macro,
			carbs: macro,
			fat: macro,
			/** Not a field: the place of the «Б/В/Ж do not add up» error, so it can be set by key. */
			macros: z.string().optional(),
		})
		.superRefine(({ kcal, protein, carbs, fat }, context) => {
			const macros = { proteinG: protein, carbsG: carbs, fatG: fat }
			if (isGoalConsistent(kcal, macros)) return
			context.addIssue({
				code: 'custom',
				path: ['macros'],
				message: getMacroMismatchText(t, { macroKcal: getMacroKcal(macros), kcal }),
			})
		})
}

export type EditGoalsFormInput = z.input<ReturnType<typeof createEditGoalsSchema>>
export type EditGoalsFormValues = z.output<ReturnType<typeof createEditGoalsSchema>>
