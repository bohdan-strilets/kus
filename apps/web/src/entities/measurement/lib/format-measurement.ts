import type { MeasurementKind } from '@kus/shared'
import type { TFunction } from 'i18next'

import { formatDecimal, formatInteger, formatSignedDecimal } from '@/shared/lib'

const UNIT_KEY = { WEIGHT: 'measurement.kg', WAIST: 'measurement.cm' } as const

const isWholeWaist = (value: number, kind: MeasurementKind): boolean =>
	kind === 'WAIST' && Number.isInteger(Number(value.toFixed(1)))

/** «82,4» for weight (always a tenth); «94» or «94,5» for waist. */
export const formatMeasurementNumber = (value: number, kind: MeasurementKind): string =>
	isWholeWaist(value, kind) ? formatInteger(value) : formatDecimal(value, 1)

/** «82,4 кг», «94 см». */
export const formatMeasurement = (value: number, kind: MeasurementKind, t: TFunction): string =>
	t(UNIT_KEY[kind], { value: formatMeasurementNumber(value, kind) })

/** «−1,6 кг», «+0,3 кг», «−2,0 см» — a change with the typographic minus, always a tenth. */
export const formatMeasurementDelta = (
	value: number,
	kind: MeasurementKind,
	t: TFunction,
): string => t(UNIT_KEY[kind], { value: formatSignedDecimal(value, 1) })

/** «78 кг», «78,5 кг» — a goal weight, with a decimal only when it has one. */
export const formatTargetWeight = (value: number, t: TFunction): string =>
	t(UNIT_KEY.WEIGHT, {
		value: Number.isInteger(Number(value.toFixed(1)))
			? formatInteger(value)
			: formatDecimal(value, 1),
	})
