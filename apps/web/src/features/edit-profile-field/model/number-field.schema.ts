import type { TFunction } from 'i18next'
import { z } from 'zod'

import { formatInteger, parseDecimalInput } from '@/shared/lib'

import type { NumberLimits } from './field-definitions.types'

interface NumberFieldSchemaOptions extends NumberLimits {
	isInteger: boolean
}

/** The typed text (comma or dot) → a number within the limits of the field. */
export const createNumberFieldSchema = (
	t: TFunction,
	{ isInteger, min, max }: NumberFieldSchemaOptions,
) => {
	const range = t('profile.data.edit.validation.range', {
		min: formatInteger(min),
		max: formatInteger(max),
	})
	const base = z.number({ error: t('profile.data.edit.validation.number') })
	const whole = isInteger ? base.int(t('profile.data.edit.validation.integer')) : base

	return z.object({
		value: z
			.string()
			.trim()
			.min(1, { error: t('profile.data.edit.validation.required'), abort: true })
			.transform(parseDecimalInput)
			.pipe(whole.min(min, range).max(max, range)),
	})
}

export type NumberFieldInput = z.input<ReturnType<typeof createNumberFieldSchema>>
export type NumberFieldValues = z.output<ReturnType<typeof createNumberFieldSchema>>
