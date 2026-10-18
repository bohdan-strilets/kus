import { MEASUREMENT_LIMITS, type MeasurementKind } from '@kus/shared'
import type { TFunction } from 'i18next'
import { z } from 'zod'

import { formatMeasurementLimit } from '@/entities/measurement'
import { parseDecimalInput } from '@/shared/lib'

/** The messages for a value outside the limits of the kind; they name the bounds. */
export const getBoundMessage = (
	t: TFunction,
	kind: MeasurementKind,
	code: 'TOO_SMALL' | 'TOO_LARGE',
): string => {
	const { min, max } = MEASUREMENT_LIMITS[kind]
	return code === 'TOO_SMALL'
		? t('editMeasurement.validation.tooSmall', { min: formatMeasurementLimit(min, kind, t) })
		: t('editMeasurement.validation.tooLarge', { max: formatMeasurementLimit(max, kind, t) })
}

/** The typed text (comma or dot) → a number within the limits of the kind. */
export const createEditMeasurementSchema = (t: TFunction, kind: MeasurementKind) => {
	const { min, max } = MEASUREMENT_LIMITS[kind]
	return z.object({
		value: z
			.string()
			.trim()
			.min(1, { error: t('editMeasurement.validation.required'), abort: true })
			.transform(parseDecimalInput)
			.pipe(
				z
					.number({ error: t('editMeasurement.validation.number') })
					.min(min, getBoundMessage(t, kind, 'TOO_SMALL'))
					.max(max, getBoundMessage(t, kind, 'TOO_LARGE')),
			),
	})
}

export type EditMeasurementInput = z.input<ReturnType<typeof createEditMeasurementSchema>>
export type EditMeasurementValues = z.output<ReturnType<typeof createEditMeasurementSchema>>
