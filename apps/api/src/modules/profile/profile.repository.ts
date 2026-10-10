import { Injectable } from '@nestjs/common'

import type { Prisma, UserProfile, WeightEntry } from '../../generated/prisma/client'
import { PrismaService } from '../../prisma'

/** The editable scalars of «Мої дані»; undefined = leave as is, null = clear. */
export type ProfileFields = Partial<
	Pick<
		UserProfile,
		| 'sex'
		| 'birthYear'
		| 'heightCm'
		| 'activityLevel'
		| 'targetWeightKg'
		| 'goalType'
		| 'paceKgPerWeek'
	>
>

export interface UpsertWeightData {
	userId: string
	localDate: Date
	measuredAt: Date
	weightKg: number
}

@Injectable()
export class ProfileRepository {
	constructor(private readonly prisma: PrismaService) {}

	findProfile(userId: string, tx?: Prisma.TransactionClient): Promise<UserProfile | null> {
		return (tx ?? this.prisma).userProfile.findUnique({ where: { userId } })
	}

	/** The profile row appears with the first edit; later edits touch only the given fields. */
	upsertProfile(
		{ userId, data }: { userId: string; data: ProfileFields },
		tx?: Prisma.TransactionClient,
	): Promise<UserProfile> {
		return (tx ?? this.prisma).userProfile.upsert({
			where: { userId },
			create: { userId, ...data },
			update: data,
		})
	}

	/** «Вага зараз»: the most recent day, and the latest write within it. */
	findLatestWeight(userId: string, tx?: Prisma.TransactionClient): Promise<WeightEntry | null> {
		return (tx ?? this.prisma).weightEntry.findFirst({
			where: { userId },
			orderBy: [{ localDate: 'desc' }, { createdAt: 'desc' }],
		})
	}

	/** One weigh-in per local day: a second one that day replaces it (full unique, so upsert is safe). */
	upsertWeight(
		{ userId, localDate, measuredAt, weightKg }: UpsertWeightData,
		tx?: Prisma.TransactionClient,
	): Promise<WeightEntry> {
		return (tx ?? this.prisma).weightEntry.upsert({
			where: { userId_localDate: { userId, localDate } },
			create: { userId, localDate, measuredAt, weightKg },
			update: { measuredAt, weightKg },
		})
	}
}
