import { Injectable, Logger } from '@nestjs/common'
import type { AuthUser, UpdateMeRequest } from '@kus/shared'

import type { Prisma, User } from '../../generated/prisma/client'
import { UserNotFoundException } from './users.exceptions'
import { type CreateUserData, UsersRepository } from './users.repository'

/** Whitelist mapping: credentials, lockout state and sessions never leave the backend. */
const toAuthUser = (user: User): AuthUser => ({
	id: user.id,
	email: user.email,
	name: user.name,
	addressAs: user.addressAs,
	locale: user.locale,
	timezone: user.timezone,
	createdAt: user.createdAt.toISOString(),
	pendingDeletion: user.purgeAt !== null,
	purgeAt: user.purgeAt?.toISOString() ?? null,
})

@Injectable()
export class UsersService {
	private readonly logger = new Logger(UsersService.name)

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

	async updateMe(userId: string, { addressAs }: UpdateMeRequest): Promise<AuthUser> {
		const user = await this.usersRepository.update({ id: userId, data: { addressAs } })
		if (!user) throw new UserNotFoundException()
		this.logger.log(`Profile updated user=${userId}`)
		return toAuthUser(user)
	}
}
