import { Injectable } from '@nestjs/common'

import {
	type Measurement,
	type MeasurementKind,
	MeasurementSource,
	type Prisma,
} from '../../generated/prisma/client'
import { PrismaService } from '../../prisma'

export interface UpsertMeasurementData {
	userId: string
	kind: MeasurementKind
	value: number
	localDate: Date
	measuredAt: Date
	source: MeasurementSource
	messageId: string | null
}

/** Every read skips soft-deleted rows, except the two that exist to show or restore them. */
@Injectable()
export class MeasurementsRepository {
	constructor(private readonly prisma: PrismaService) {}

	/**
	 * One value per kind per local day: a second one that day replaces it (and revives a deleted
	 * one, keeping its createdAt). A write without a message (the profile) keeps the message that
	 * already carries the day's value, so its chat card stays.
	 */
	upsert(
		{ userId, kind, value, localDate, measuredAt, source, messageId }: UpsertMeasurementData,
		tx?: Prisma.TransactionClient,
	): Promise<Measurement> {
		return (tx ?? this.prisma).measurement.upsert({
			where: { userId_kind_localDate: { userId, kind, localDate } },
			create: { userId, kind, value, localDate, measuredAt, source, messageId },
			update: {
				value,
				measuredAt,
				source,
				deletedAt: null,
				...(messageId === null ? {} : { messageId }),
			},
		})
	}

	/** The row by id for its owner, deleted or not: the caller decides what a deleted one means. */
	findByIdForUser(
		id: string,
		userId: string,
		tx?: Prisma.TransactionClient,
	): Promise<Measurement | null> {
		return (tx ?? this.prisma).measurement.findFirst({ where: { id, userId } })
	}

	/** Marks the owner's row deleted; false when it is not theirs or already deleted. */
	async softDelete(id: string, userId: string, tx?: Prisma.TransactionClient): Promise<boolean> {
		const { count } = await (tx ?? this.prisma).measurement.updateMany({
			where: { id, userId, deletedAt: null },
			data: { deletedAt: new Date() },
		})
		return count > 0
	}

	/** Brings the owner's deleted row back; false when it is not theirs or not deleted. */
	async restore(id: string, userId: string, tx?: Prisma.TransactionClient): Promise<boolean> {
		const { count } = await (tx ?? this.prisma).measurement.updateMany({
			where: { id, userId, deletedAt: { not: null } },
			data: { deletedAt: null },
		})
		return count > 0
	}

	/** A manual correction of the value; the day and the message stay. false when no live row. */
	async updateValue(
		id: string,
		userId: string,
		value: number,
		tx?: Prisma.TransactionClient,
	): Promise<boolean> {
		const { count } = await (tx ?? this.prisma).measurement.updateMany({
			where: { id, userId, deletedAt: null },
			data: { value, source: MeasurementSource.EDIT },
		})
		return count > 0
	}

	/** The most recent day, and the latest write within it. */
	findLatest(
		{ userId, kind }: { userId: string; kind: MeasurementKind },
		tx?: Prisma.TransactionClient,
	): Promise<Measurement | null> {
		return (tx ?? this.prisma).measurement.findFirst({
			where: { userId, kind, deletedAt: null },
			orderBy: [{ localDate: 'desc' }, { measuredAt: 'desc' }],
		})
	}

	/**
	 * The start as it is SHOWN (chat card, «Прогрес»): the earliest live row by its day, then by
	 * measuredAt, createdAt last. Not `findFirst`: that one is by creation time and belongs to the
	 * achievements, which must keep behaving as before. Two different things, don't merge them.
	 */
	findStart(
		{ userId, kind }: { userId: string; kind: MeasurementKind },
		tx?: Prisma.TransactionClient,
	): Promise<Measurement | null> {
		return (tx ?? this.prisma).measurement.findFirst({
			where: { userId, kind, deletedAt: null },
			orderBy: [{ localDate: 'asc' }, { measuredAt: 'asc' }, { createdAt: 'asc' }],
		})
	}

	/** The first live row by creation time: a backdated entry doesn't move the start (achievements). */
	findFirst(
		{ userId, kind }: { userId: string; kind: MeasurementKind },
		tx?: Prisma.TransactionClient,
	): Promise<Measurement | null> {
		return (tx ?? this.prisma).measurement.findFirst({
			where: { userId, kind, deletedAt: null },
			orderBy: { createdAt: 'asc' },
		})
	}

	/** Both bounds inclusive, oldest first. */
	findInRange(
		{ userId, kind, from, to }: { userId: string; kind: MeasurementKind; from: Date; to: Date },
		tx?: Prisma.TransactionClient,
	): Promise<Measurement[]> {
		return (tx ?? this.prisma).measurement.findMany({
			where: { userId, kind, deletedAt: null, localDate: { gte: from, lte: to } },
			orderBy: { localDate: 'asc' },
		})
	}

	findByDate(
		{ userId, kind, localDate }: { userId: string; kind: MeasurementKind; localDate: Date },
		tx?: Prisma.TransactionClient,
	): Promise<Measurement | null> {
		return (tx ?? this.prisma).measurement.findFirst({
			where: { userId, kind, localDate, deletedAt: null },
		})
	}

	/** The nearest day before `before`, optionally of one source; the latest write within it. */
	findBefore(
		{
			userId,
			kind,
			before,
			source,
		}: { userId: string; kind: MeasurementKind; before: Date; source?: MeasurementSource },
		tx?: Prisma.TransactionClient,
	): Promise<Measurement | null> {
		return (tx ?? this.prisma).measurement.findFirst({
			where: {
				userId,
				kind,
				deletedAt: null,
				localDate: { lt: before },
				...(source ? { source } : {}),
			},
			orderBy: [{ localDate: 'desc' }, { measuredAt: 'desc' }],
		})
	}

	/**
	 * The values that came from these user messages (the chat cards), WEIGHT before WAIST. Deleted
	 * ones are included: the card stays in the chat as a «deleted» row.
	 */
	findByMessageIds({
		userId,
		messageIds,
	}: {
		userId: string
		messageIds: string[]
	}): Promise<Measurement[]> {
		return this.prisma.measurement.findMany({
			where: { userId, messageId: { in: messageIds } },
			orderBy: { kind: 'asc' },
		})
	}

	/** Newest day first. */
	findRecent(
		{ userId, kind, take }: { userId: string; kind: MeasurementKind; take: number },
		tx?: Prisma.TransactionClient,
	): Promise<Measurement[]> {
		return (tx ?? this.prisma).measurement.findMany({
			where: { userId, kind, deletedAt: null },
			orderBy: { localDate: 'desc' },
			take,
		})
	}
}
