import { Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { Cron, CronExpression } from '@nestjs/schedule'

import type { Env } from '../../config'
import { buildUserPrefix } from '../storage/storage-key'
import { StorageService } from '../storage/storage.service'
import { PURGE_BATCH_SIZE, USER_ID_PATTERN } from './account.constants'
import { AccountRepository } from './account.repository'

export interface PurgeResult {
	purged: number
	skipped: number
}

/**
 * Hard-deletes accounts past their 30-day grace, one user at a time: the user's files in object
 * storage go first, the database row (and its cascade) only after that succeeded. A user whose
 * storage cleanup failed stays with a past purgeAt and is retried by the next run.
 * Logs counts and userIds only: never keys, prefixes or SDK error text.
 */
@Injectable()
export class AccountPurgeService {
	private readonly logger = new Logger(AccountPurgeService.name)
	private readonly keyPrefix: string

	constructor(
		private readonly accountRepository: AccountRepository,
		private readonly storage: StorageService,
		config: ConfigService<Env, true>,
	) {
		this.keyPrefix = config.get('STORAGE_KEY_PREFIX', { infer: true })
	}

	@Cron(CronExpression.EVERY_DAY_AT_4AM)
	async purgeOnSchedule(): Promise<void> {
		try {
			await this.purgeExpired(new Date())
		} catch (error) {
			// the scheduler would swallow it; the next run retries, nothing is lost
			this.logger.error('Account purge failed', error instanceof Error ? error.stack : error)
		}
	}

	/** Returns how many accounts were deleted; skipped ones are logged and retried next run. */
	async purgeExpired(now: Date): Promise<number> {
		const result: PurgeResult = { purged: 0, skipped: 0 }
		let afterId: string | undefined

		for (;;) {
			const userIds = await this.accountRepository.findExpiredUserIds({
				now,
				limit: PURGE_BATCH_SIZE,
				afterId,
			})
			if (userIds.length === 0) break

			for (const userId of userIds) {
				if (await this.purgeUser(userId, now)) result.purged += 1
				else result.skipped += 1
			}
			// skipped users stay expired, so the cursor (not a re-query) moves the loop forward
			afterId = userIds[userIds.length - 1]
		}

		if (result.purged > 0 || result.skipped > 0) {
			this.logger.log(
				`Account purge done: purged ${result.purged}, skipped ${result.skipped} (retried next run)`,
			)
		}
		return result.purged
	}

	/** false = the user was left in place (bad id, restored meanwhile, or a storage/database failure). */
	private async purgeUser(userId: string, now: Date): Promise<boolean> {
		// an id that is not a uuid would build a short prefix that could match other users' files
		if (!USER_ID_PATTERN.test(userId)) {
			// the value itself stays out of the log: it is not a uuid, so it is not ours to print
			this.logger.error(`Account purge skipped: invalid user id, skipped (length ${userId.length})`)
			return false
		}

		try {
			// storage deletion is irreversible: do not start it for an account restored since the page was read
			const state = await this.accountRepository.findDeletionState(userId)
			if (!state?.purgeAt || state.purgeAt > now) return false
			await this.storage.deleteByPrefix(buildUserPrefix({ prefix: this.keyPrefix, userId }))
		} catch {
			// StorageService already logged the operation and error class for a storage failure
			this.logger.warn(`Account purge skipped: pre-delete step failed (user ${userId})`)
			return false
		}

		try {
			return await this.accountRepository.deleteExpiredUser({ userId, now })
		} catch (error) {
			this.logger.error(
				`Account purge failed: database delete (user ${userId}, ${error instanceof Error ? error.name : 'unknown'})`,
			)
			return false
		}
	}
}
