import { GOAL_KCAL, GOAL_MACRO_GRAMS } from '@kus/shared'
import type { TFunction } from 'i18next'
import { z } from 'zod'

import { formatInteger } from '@/shared/lib'

const WHOLE_NUMBER = /^\d+$/

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

/** «Від 800 до 6 000 ккал» — the hint under a field and its range error. */
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

export const createSetGoalSchema = (t: TFunction) => {
	const ranges = getGoalRangeTexts(t)
	const macro = createNumberField(t, { ...GOAL_MACRO_GRAMS, rangeMessage: ranges.macro })
	return z.object({
		kcal: createNumberField(t, { ...GOAL_KCAL, rangeMessage: ranges.kcal }),
		protein: macro,
		carbs: macro,
		fat: macro,
	})
}

export type SetGoalFormInput = z.input<ReturnType<typeof createSetGoalSchema>>
export type SetGoalFormValues = z.output<ReturnType<typeof createSetGoalSchema>>
