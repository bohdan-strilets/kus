import { Injectable } from '@nestjs/common'

import type { GoalType, Prisma, UserGoal } from '../../generated/prisma/client'
import { PrismaService } from '../../prisma'

export interface GoalValues {
	type: GoalType
	dailyKcal: number
	proteinG: number
	fatG: number
	carbsG: number
}

@Injectable()
export class GoalsRepository {
	constructor(private readonly prisma: PrismaService) {}

	/** The goal in force on a day: the latest one that started on or before it. */
	findForDate(
		{ userId, localDate }: { userId: string; localDate: Date },
		tx?: Prisma.TransactionClient,
	): Promise<UserGoal | null> {
		return (tx ?? this.prisma).userGoal.findFirst({
			where: { userId, validFrom: { lte: localDate } },
			orderBy: { validFrom: 'desc' },
		})
	}

	/** One goal per start day: a second change on the same day rewrites it. */
	upsertForDate(
		{ userId, validFrom, values }: { userId: string; validFrom: Date; values: GoalValues },
		tx?: Prisma.TransactionClient,
	): Promise<UserGoal> {
		return (tx ?? this.prisma).userGoal.upsert({
			where: { userId_validFrom: { userId, validFrom } },
			create: { userId, validFrom, ...values },
			update: values,
		})
	}
}
