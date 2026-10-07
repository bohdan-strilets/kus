import { Injectable } from '@nestjs/common'

import type { Prisma, User, UserGoal } from '../../generated/prisma/client'
import { PrismaService } from '../../prisma'

export interface CreateUserData {
	email: string
	name: string
	consentAt: Date
}

@Injectable()
export class UsersRepository {
	constructor(private readonly prisma: PrismaService) {}

	create(data: CreateUserData, tx?: Prisma.TransactionClient): Promise<User> {
		return (tx ?? this.prisma).user.create({ data })
	}

	findById(id: string, tx?: Prisma.TransactionClient): Promise<User | null> {
		return (tx ?? this.prisma).user.findUnique({ where: { id } })
	}

	findByEmail(email: string, tx?: Prisma.TransactionClient): Promise<User | null> {
		return (tx ?? this.prisma).user.findUnique({ where: { email } })
	}

	/** The goal in force on a day: the latest one that started on or before it. */
	findGoalForDate(
		userId: string,
		localDate: Date,
		tx?: Prisma.TransactionClient,
	): Promise<UserGoal | null> {
		return (tx ?? this.prisma).userGoal.findFirst({
			where: { userId, validFrom: { lte: localDate } },
			orderBy: { validFrom: 'desc' },
		})
	}
}
