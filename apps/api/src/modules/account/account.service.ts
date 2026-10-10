import { Injectable, Logger } from '@nestjs/common'
import { ACCOUNT_DELETION_GRACE_DAYS, type AuthUser } from '@kus/shared'

import { addDays } from '../../common/time'
import { PrismaService } from '../../prisma'
import { AuthService } from '../auth/auth.service'
import { SessionService } from '../auth/session.service'
import { UsersService } from '../users/users.service'
import { AccountRepository } from './account.repository'

/**
 * Deletion with a grace period (settings-delete-confirm, account-restore): the data is hidden at
 * once by PendingDeletionGuard and hard-deleted by AccountPurgeService after purgeAt.
 */
@Injectable()
export class AccountService {
	private readonly logger = new Logger(AccountService.name)

	constructor(
		private readonly prisma: PrismaService,
		private readonly accountRepository: AccountRepository,
		private readonly authService: AuthService,
		private readonly sessionService: SessionService,
		private readonly usersService: UsersService,
	) {}

	/** Confirms with the password, marks the account and ends every session (the cookies die with them). */
	async requestDeletion(userId: string, password: string): Promise<void> {
		await this.authService.verifyPasswordOrThrow(userId, password)

		const requestedAt = new Date()
		const purgeAt = addDays(requestedAt, ACCOUNT_DELETION_GRACE_DAYS)
		await this.prisma.$transaction(async (tx) => {
			await this.accountRepository.requestDeletion({ userId, requestedAt, purgeAt }, tx)
			await this.sessionService.logoutAll(userId, tx)
		})
		this.logger.log(`Account deletion requested userId=${userId}`)
	}

	/** Idempotent: restoring an account that isn't pending just returns it. */
	async restore(userId: string): Promise<AuthUser> {
		await this.accountRepository.restore(userId)
		this.logger.log(`Account restored userId=${userId}`)
		return this.usersService.getMe(userId)
	}
}
