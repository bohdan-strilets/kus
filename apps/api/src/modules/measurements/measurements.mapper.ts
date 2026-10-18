import type { Measurement, MeasurementKind, MeasurementSource } from '../../generated/prisma/client'

/** A stored value with the Decimal turned into a number (one decimal). */
export interface MeasurementValue {
	id: string
	kind: MeasurementKind
	value: number
	localDate: Date
	measuredAt: Date
	source: MeasurementSource
	messageId: string | null
	/** When the row was first written; a backdated entry is told by it from the day it is for. */
	createdAt: Date
	deletedAt: Date | null
}

export const toMeasurementValue = (row: Measurement): MeasurementValue => ({
	id: row.id,
	kind: row.kind,
	value: row.value.toNumber(),
	localDate: row.localDate,
	measuredAt: row.measuredAt,
	source: row.source,
	messageId: row.messageId,
	createdAt: row.createdAt,
	deletedAt: row.deletedAt,
})
