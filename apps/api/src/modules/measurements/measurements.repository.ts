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

	/** One value per kind per local day: a second one that day replaces it. */
	upsert(
		{ userId, kind, value, localDate, measuredAt, source, messageId }: UpsertMeasurementData,
		tx?: Prisma.TransactionClient,
	): Promise<Measurement> {
		return (tx ?? this.prisma).measurement.upsert({
			where: { userId_kind_localDate: { userId, kind, localDate } },
			create: { userId, kind, value, localDate, measuredAt, source, messageId },
			update: { value, measuredAt, source, messageId },
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
}
