import type { Measurement, MeasurementKind, MeasurementSource } from '../../generated/prisma/client'

/** A stored value with the Decimal turned into a number (one decimal). */
export interface MeasurementValue {
	kind: MeasurementKind
	value: number
	localDate: Date
	measuredAt: Date
	source: MeasurementSource
	messageId: string | null
}

export const toMeasurementValue = (row: Measurement): MeasurementValue => ({
	kind: row.kind,
	value: row.value.toNumber(),
	localDate: row.localDate,
	measuredAt: row.measuredAt,
	source: row.source,
	messageId: row.messageId,
})
