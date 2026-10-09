import { loggableMealTypeSchema, MAX_ENTRY_GRAMS, MIN_ENTRY_GRAMS } from '@kus/shared'
import type { TFunction } from 'i18next'
import { z } from 'zod'

import { formatInteger } from '@/shared/lib'

import type { AmountUnit } from '../lib/get-amount-unit'
import { WHOLE_NUMBER } from '../lib/parse-amount'

/** «Від 1 до 5 000 г» — the range error under the stepper. */
export const getAmountRangeText = (t: TFunction, unit: AmountUnit): string =>
	t(unit === 'ml' ? 'editEntry.validation.rangeMl' : 'editEntry.validation.rangeGrams', {
		min: formatInteger(MIN_ENTRY_GRAMS),
		max: formatInteger(MAX_ENTRY_GRAMS),
	})

/** The typed digits → a whole weight within the API bounds (packages/shared food-entry.ts). */
export const createEditEntrySchema = (t: TFunction, { unit }: { unit: AmountUnit }) => {
	const range = getAmountRangeText(t, unit)
	return z.object({
		grams: z
			.string()
			.trim()
			.min(1, { error: t('editEntry.validation.required'), abort: true })
			.regex(WHOLE_NUMBER, t('editEntry.validation.wholeNumber'))
			.transform(Number)
			.pipe(z.number().min(MIN_ENTRY_GRAMS, range).max(MAX_ENTRY_GRAMS, range)),
		// OTHER is never logged by the chat, so a meal of that type starts without a chip chosen
		mealType: z.enum(loggableMealTypeSchema.options, {
			error: t('editEntry.validation.mealRequired'),
		}),
	})
}

export type EditEntryFormInput = z.input<ReturnType<typeof createEditEntrySchema>>
export type EditEntryFormValues = z.output<ReturnType<typeof createEditEntrySchema>>
