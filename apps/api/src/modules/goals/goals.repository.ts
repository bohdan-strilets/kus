import { Injectable } from '@nestjs/common'

import type { Prisma, UserGoal } from '../../generated/prisma/client'
import { PrismaService } from '../../prisma'

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
}
