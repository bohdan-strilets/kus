import { Injectable } from '@nestjs/common'

import type {
	Measurement,
	MeasurementKind,
	MeasurementSource,
	Prisma,
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

@Injectable()
export class MeasurementsRepository {
	constructor(private readonly prisma: PrismaService) {}

	/**
	 * One value per kind per local day: a second one that day replaces it. A write without a
	 * message (the profile) keeps the message that already carries the day's value, so its chat card stays.
	 */
	upsert(
		{ userId, kind, value, localDate, measuredAt, source, messageId }: UpsertMeasurementData,
		tx?: Prisma.TransactionClient,
	): Promise<Measurement> {
		return (tx ?? this.prisma).measurement.upsert({
			where: { userId_kind_localDate: { userId, kind, localDate } },
			create: { userId, kind, value, localDate, measuredAt, source, messageId },
			update: { value, measuredAt, source, ...(messageId === null ? {} : { messageId }) },
		})
	}

	/** The most recent day, and the latest write within it. */
	findLatest(
		{ userId, kind }: { userId: string; kind: MeasurementKind },
		tx?: Prisma.TransactionClient,
	): Promise<Measurement | null> {
		return (tx ?? this.prisma).measurement.findFirst({
			where: { userId, kind },
			orderBy: [{ localDate: 'desc' }, { measuredAt: 'desc' }],
		})
	}

	/** The first row ever written, by creation time: a backdated entry doesn't move the start. */
	findFirst(
		{ userId, kind }: { userId: string; kind: MeasurementKind },
		tx?: Prisma.TransactionClient,
	): Promise<Measurement | null> {
		return (tx ?? this.prisma).measurement.findFirst({
			where: { userId, kind },
			orderBy: { createdAt: 'asc' },
		})
	}

	/** Both bounds inclusive, oldest first. */
	findInRange(
		{ userId, kind, from, to }: { userId: string; kind: MeasurementKind; from: Date; to: Date },
		tx?: Prisma.TransactionClient,
	): Promise<Measurement[]> {
		return (tx ?? this.prisma).measurement.findMany({
			where: { userId, kind, localDate: { gte: from, lte: to } },
			orderBy: { localDate: 'asc' },
		})
	}

	findByDate(
		{ userId, kind, localDate }: { userId: string; kind: MeasurementKind; localDate: Date },
		tx?: Prisma.TransactionClient,
	): Promise<Measurement | null> {
		return (tx ?? this.prisma).measurement.findUnique({
			where: { userId_kind_localDate: { userId, kind, localDate } },
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
			where: { userId, kind, localDate: { lt: before }, ...(source ? { source } : {}) },
			orderBy: [{ localDate: 'desc' }, { measuredAt: 'desc' }],
		})
	}

	/** The values that came from these user messages (the chat cards), WEIGHT before WAIST. */
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
			where: { userId, kind },
			orderBy: { localDate: 'desc' },
			take,
		})
	}
}
