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

	/** Holds the profile row until the transaction ends: parallel writers of the user queue behind it. */
	async lockProfile(userId: string, tx: Prisma.TransactionClient): Promise<void> {
		await tx.$queryRaw`SELECT user_id FROM user_profiles WHERE user_id = ${userId}::uuid FOR UPDATE`
	}

	/** Sets when the training onboarding was taken up or declined, once: a set time is kept. */
	async markTrainingOnboarding(
		{ userId, at }: { userId: string; at: Date },
		tx?: Prisma.TransactionClient,
	): Promise<void> {
		const client = tx ?? this.prisma
		await client.userProfile.upsert({
			where: { userId },
			create: { userId, trainingOnboardingAt: at },
			update: {},
		})
		await client.userProfile.updateMany({
			where: { userId, trainingOnboardingAt: null },
			data: { trainingOnboardingAt: at },
		})
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
