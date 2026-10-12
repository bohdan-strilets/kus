import { Injectable } from '@nestjs/common'

import type { Prisma, UserProfile } from '../../generated/prisma/client'
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
}
