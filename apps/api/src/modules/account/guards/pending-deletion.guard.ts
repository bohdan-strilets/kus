import { type CanActivate, type ExecutionContext, Injectable } from '@nestjs/common'
import { Reflector } from '@nestjs/core'

import {
	ALLOW_PENDING_DELETION_KEY,
	type AuthenticatedRequest,
	IS_PUBLIC_KEY,
} from '../../../common/decorators'
import { AccountPendingDeletionException } from '../account.exceptions'
import { AccountRepository } from '../account.repository'

/**
 * Global guard after JwtAuthGuard: an account waiting to be purged gets 403 everywhere except
 * the routes marked @AllowPendingDeletion() (restore, «who am I») and the public ones (logout).
 * One primary-key read per request; the status is not in the token so a restore applies at once.
 */
@Injectable()
export class PendingDeletionGuard implements CanActivate {
	constructor(
		private readonly reflector: Reflector,
		private readonly accountRepository: AccountRepository,
	) {}

	async canActivate(context: ExecutionContext): Promise<boolean> {
		const targets = [context.getHandler(), context.getClass()]
		if (this.reflector.getAllAndOverride<boolean | undefined>(IS_PUBLIC_KEY, targets)) return true
		if (
			this.reflector.getAllAndOverride<boolean | undefined>(ALLOW_PENDING_DELETION_KEY, targets)
		) {
			return true
		}

		const { user } = context.switchToHttp().getRequest<AuthenticatedRequest>()
		// no user means JwtAuthGuard didn't run on this route; nothing to check here
		if (!user) return true

		const state = await this.accountRepository.findDeletionState(user.sub)
		// a purged user: the next read answers USER_NOT_FOUND on its own
		if (state?.purgeAt) throw new AccountPendingDeletionException(state.purgeAt)
		return true
	}
}
