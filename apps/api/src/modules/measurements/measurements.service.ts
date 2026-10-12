import { Injectable } from '@nestjs/common'

import type { MeasurementKind, Prisma } from '../../generated/prisma/client'
import { type MeasurementValue, toMeasurementValue } from './measurements.mapper'
import { MeasurementsRepository, type UpsertMeasurementData } from './measurements.repository'

export type RecordMeasurementData = Omit<UpsertMeasurementData, 'messageId'> & {
	messageId?: string | null
}

/** Weight and waist values: one per kind per local day, read back as numbers. */
@Injectable()
export class MeasurementsService {
	constructor(private readonly measurementsRepository: MeasurementsRepository) {}

	async record(
		data: RecordMeasurementData,
		tx?: Prisma.TransactionClient,
	): Promise<MeasurementValue> {
		const row = await this.measurementsRepository.upsert(
			{ ...data, messageId: data.messageId ?? null },
			tx,
		)
		return toMeasurementValue(row)
	}

	async findLatest(
		query: { userId: string; kind: MeasurementKind },
		tx?: Prisma.TransactionClient,
	): Promise<MeasurementValue | null> {
		const row = await this.measurementsRepository.findLatest(query, tx)
		return row ? toMeasurementValue(row) : null
	}

	async findFirst(
		query: { userId: string; kind: MeasurementKind },
		tx?: Prisma.TransactionClient,
	): Promise<MeasurementValue | null> {
		const row = await this.measurementsRepository.findFirst(query, tx)
		return row ? toMeasurementValue(row) : null
	}

	async findInRange(
		query: { userId: string; kind: MeasurementKind; from: Date; to: Date },
		tx?: Prisma.TransactionClient,
	): Promise<MeasurementValue[]> {
		const rows = await this.measurementsRepository.findInRange(query, tx)
		return rows.map(toMeasurementValue)
	}
}
