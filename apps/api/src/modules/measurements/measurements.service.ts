import { Injectable } from '@nestjs/common'

import type { MeasurementKind, MeasurementSource, Prisma } from '../../generated/prisma/client'
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

	/** The owner's row by id, deleted or not. */
	async findByIdForUser(id: string, userId: string): Promise<MeasurementValue | null> {
		const row = await this.measurementsRepository.findByIdForUser(id, userId)
		return row ? toMeasurementValue(row) : null
	}

	/** false when the row is not the user's or is already deleted. */
	softDelete(id: string, userId: string, tx?: Prisma.TransactionClient): Promise<boolean> {
		return this.measurementsRepository.softDelete(id, userId, tx)
	}

	/** false when the row is not the user's or is not deleted. */
	restore(id: string, userId: string): Promise<boolean> {
		return this.measurementsRepository.restore(id, userId)
	}

	/** A manual correction (source EDIT); false when there is no live row of the user's. */
	updateValue(id: string, userId: string, value: number): Promise<boolean> {
		return this.measurementsRepository.updateValue(id, userId, value)
	}

	async findLatest(
		query: { userId: string; kind: MeasurementKind },
		tx?: Prisma.TransactionClient,
	): Promise<MeasurementValue | null> {
		const row = await this.measurementsRepository.findLatest(query, tx)
		return row ? toMeasurementValue(row) : null
	}

	/** The start for display: the earliest by day, not by creation time (see the repository). */
	async findStart(
		query: { userId: string; kind: MeasurementKind },
		tx?: Prisma.TransactionClient,
	): Promise<MeasurementValue | null> {
		const row = await this.measurementsRepository.findStart(query, tx)
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

	async findByDate(
		query: { userId: string; kind: MeasurementKind; localDate: Date },
		tx?: Prisma.TransactionClient,
	): Promise<MeasurementValue | null> {
		const row = await this.measurementsRepository.findByDate(query, tx)
		return row ? toMeasurementValue(row) : null
	}

	/** The nearest day before `before`, optionally of one source. */
	async findBefore(
		query: { userId: string; kind: MeasurementKind; before: Date; source?: MeasurementSource },
		tx?: Prisma.TransactionClient,
	): Promise<MeasurementValue | null> {
		const row = await this.measurementsRepository.findBefore(query, tx)
		return row ? toMeasurementValue(row) : null
	}

	async findByMessageIds(query: {
		userId: string
		messageIds: string[]
	}): Promise<MeasurementValue[]> {
		if (query.messageIds.length === 0) return []
		const rows = await this.measurementsRepository.findByMessageIds(query)
		return rows.map(toMeasurementValue)
	}

	/** Newest day first. */
	async findRecent(
		query: { userId: string; kind: MeasurementKind; take: number },
		tx?: Prisma.TransactionClient,
	): Promise<MeasurementValue[]> {
		const rows = await this.measurementsRepository.findRecent(query, tx)
		return rows.map(toMeasurementValue)
	}
}
