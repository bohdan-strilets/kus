import { Injectable, Logger } from '@nestjs/common'
import { ACCOUNT_DELETION_GRACE_DAYS, type AuthUser } from '@kus/shared'

import { addDays } from '../../common/time'
import { PrismaService } from '../../prisma'
import { AuthService } from '../auth/auth.service'
import { SessionService } from '../auth/session.service'
import { ChatGreetingsService } from '../chat/chat-greetings.service'
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
		private readonly chatGreetings: ChatGreetingsService,
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

	/**
	 * Idempotent: restoring an account that isn't pending just returns it. An account that really
	 * came back gets Kusik's welcome in the chat, in the same transaction.
	 */
	async restore(userId: string): Promise<AuthUser> {
		const { user, wasPending } = await this.prisma.$transaction(async (tx) => {
			const wasPending = await this.accountRepository.restore(userId, tx)
			const user = await this.usersService.getMe(userId, tx)
			if (wasPending) await this.chatGreetings.postWelcomeBack(user, tx)
			return { user, wasPending }
		})
		if (wasPending) this.logger.log(`Account restored userId=${userId}`)
		return user
	}
}
