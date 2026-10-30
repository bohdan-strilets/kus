import {
	MAX_ENTRY_GRAMS,
	MAX_KCAL_PER_GRAM,
	MIN_ENTRY_GRAMS,
	MY_FOOD_NAME_MAX_LENGTH,
} from '@kus/shared'
import type { TFunction } from 'i18next'
import { z } from 'zod'

import { parseDecimalInput } from '@/shared/lib'

const GRAMS_PER_100 = 100
const MAX_KCAL_PER_100G = MAX_KCAL_PER_GRAM * GRAMS_PER_100
const WHITESPACE = /\s+/g
const TENTHS = 10

/** The grams of the usual portion: the field is pieces when «1 шт =» is filled, grams otherwise. */
export const getPortionGrams = (portion: number, pieceGrams: number | null): number =>
	pieceGrams === null ? portion : Math.round(portion * pieceGrams * TENTHS) / TENTHS

const isNumber = (value: unknown): value is number => typeof value === 'number'

const isGramsInRange = (grams: number): boolean =>
	grams >= MIN_ENTRY_GRAMS && grams <= MAX_ENTRY_GRAMS

interface SchemaOptions {
	/** Saved fiber is not on the sheet, but it counts into the 100 g of macros. */
	fiber?: number | null
}

/** The typed text (comma or dot) → numbers within the limits the API checks. */
export const createEditMyFoodSchema = (t: TFunction, { fiber = null }: SchemaOptions = {}) => {
	const numberMessage = t('editMyFood.validation.number')
	const gramsRangeMessage = t('editMyFood.validation.gramsRange', {
		min: MIN_ENTRY_GRAMS,
		max: MAX_ENTRY_GRAMS,
	})
	const macrosMessage = t('editMyFood.validation.macrosTooHigh')

	const requiredNumber = (max: number, tooHighMessage: string) =>
		z
			.string()
			.trim()
			.min(1, { error: t('editMyFood.validation.required'), abort: true })
			.transform(parseDecimalInput)
			.pipe(z.number({ error: numberMessage }).min(0, numberMessage).max(max, tooHighMessage))

	// empty is fine (null); a text that is not a number is not
	const optionalNumber = z
		.string()
		.trim()
		.superRefine((text, context) => {
			if (text !== '' && parseDecimalInput(text) === null) {
				context.addIssue({ code: 'custom', message: numberMessage })
			}
		})
		.transform((text) => (text === '' ? null : parseDecimalInput(text)))
		.pipe(z.number().positive(numberMessage).nullable())

	return z
		.object({
			name: z
				.string()
				.transform((name) => name.replace(WHITESPACE, ' ').trim())
				.pipe(
					z
						.string()
						.min(1, t('editMyFood.validation.nameRequired'))
						.max(
							MY_FOOD_NAME_MAX_LENGTH,
							t('editMyFood.validation.nameTooLong', { count: MY_FOOD_NAME_MAX_LENGTH }),
						),
				),
			kcal: requiredNumber(
				MAX_KCAL_PER_100G,
				t('editMyFood.validation.kcalTooHigh', { max: MAX_KCAL_PER_100G }),
			),
			protein: requiredNumber(GRAMS_PER_100, macrosMessage),
			carbs: requiredNumber(GRAMS_PER_100, macrosMessage),
			fat: requiredNumber(GRAMS_PER_100, macrosMessage),
			pieceGrams: optionalNumber,
			portion: optionalNumber,
		})
		.superRefine((values, context) => {
			// a field that failed leaves its raw text here: the cross-field checks wait for valid fields
			const { protein, carbs, fat, pieceGrams, portion } = values
			if (
				isNumber(protein) &&
				isNumber(carbs) &&
				isNumber(fat) &&
				protein + carbs + fat + (fiber ?? 0) > GRAMS_PER_100
			) {
				context.addIssue({ code: 'custom', path: ['protein'], message: macrosMessage })
			}
			if (isNumber(pieceGrams) && !isGramsInRange(pieceGrams)) {
				context.addIssue({ code: 'custom', path: ['pieceGrams'], message: gramsRangeMessage })
			}
			if (!isNumber(portion) || (pieceGrams !== null && !isNumber(pieceGrams))) return
			// with «1 шт» a portion is a piece count; the grams it makes must fit too
			if (!isGramsInRange(getPortionGrams(portion, pieceGrams))) {
				context.addIssue({ code: 'custom', path: ['portion'], message: gramsRangeMessage })
			}
		})
}

export type EditMyFoodInput = z.input<ReturnType<typeof createEditMyFoodSchema>>
export type EditMyFoodValues = z.output<ReturnType<typeof createEditMyFoodSchema>>
