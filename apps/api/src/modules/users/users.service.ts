import { Injectable } from '@nestjs/common'
import type { AuthUser } from '@kus/shared'

import type { Prisma, User } from '../../generated/prisma/client'
import { UserNotFoundException } from './users.exceptions'
import { type CreateUserData, UsersRepository } from './users.repository'

/** Whitelist mapping: credentials, lockout state and sessions never leave the backend. */
const toAuthUser = (user: User): AuthUser => ({
	id: user.id,
	email: user.email,
	name: user.name,
	locale: user.locale,
	timezone: user.timezone,
	createdAt: user.createdAt.toISOString(),
})

@Injectable()
export class UsersService {
	constructor(private readonly usersRepository: UsersRepository) {}

	/** `email` must already be normalized (lowercase) — the DB rejects anything else. */
	async createUser(data: CreateUserData, tx?: Prisma.TransactionClient): Promise<AuthUser> {
		return toAuthUser(await this.usersRepository.create(data, tx))
	}

	async findByEmail(email: string): Promise<AuthUser | null> {
		const user = await this.usersRepository.findByEmail(email)
		return user ? toAuthUser(user) : null
	}

	async getMe(userId: string): Promise<AuthUser> {
		const user = await this.usersRepository.findById(userId)
		if (!user) throw new UserNotFoundException()
		return toAuthUser(user)
	}
}
