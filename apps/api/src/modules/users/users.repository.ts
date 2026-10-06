import { Injectable } from '@nestjs/common'

import type { Prisma, User } from '../../generated/prisma/client'
import { PrismaService } from '../../prisma'

export interface CreateUserData {
	email: string
	name: string
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
}
