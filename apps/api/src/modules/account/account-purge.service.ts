import { Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { Cron, CronExpression } from '@nestjs/schedule'

import type { Env } from '../../config'
import { PrismaService } from '../../prisma'
import { buildUserPrefix } from '../storage/storage-key'
import { StorageService } from '../storage/storage.service'
import {
	PURGE_BATCH_SIZE,
	PURGE_MAX_CONSECUTIVE_STORAGE_FAILURES,
	PURGE_TRANSACTION_TIMEOUT_MS,
	USER_ID_PATTERN,
} from './account.constants'
import { AccountRepository } from './account.repository'

interface PurgeResult {
	purged: number
	skipped: number
}

/** What happened to one user; only a storage failure counts towards the circuit breaker. */
type PurgeOutcome = 'purged' | 'skipped' | 'storage-failed'

const getErrorName = (error: unknown): string => (error instanceof Error ? error.name : 'unknown')

/**
 * Hard-deletes accounts past their 30-day grace, one user at a time: the user's files in object
 * storage go first, the database row (and its cascade) only after that succeeded. A user whose
 * storage cleanup failed stays with a past purgeAt and is retried by the next run. After
 * PURGE_MAX_CONSECUTIVE_STORAGE_FAILURES storage failures in a row the run stops (storage is down).
 * Logs counts and userIds only: never keys, prefixes or SDK error text.
 */
@Injectable()
export class AccountPurgeService {
	private readonly logger = new Logger(AccountPurgeService.name)
	private readonly keyPrefix: string

	constructor(
		private readonly prisma: PrismaService,
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
			this.logger.error(`Account purge failed (${getErrorName(error)})`)
		}
	}

	/** Returns how many accounts were deleted; skipped ones are logged and retried next run. */
	async purgeExpired(now: Date): Promise<number> {
		const result: PurgeResult = { purged: 0, skipped: 0 }
		let consecutiveStorageFailures = 0
		let afterId: string | undefined

		for (;;) {
			const userIds = await this.accountRepository.findExpiredUserIds({
				now,
				limit: PURGE_BATCH_SIZE,
				afterId,
			})
			if (userIds.length === 0) break

			for (const userId of userIds) {
				const outcome = await this.purgeUser(userId, now)
				if (outcome === 'purged') result.purged += 1
				else result.skipped += 1

				// restored, invalid or database-failed users say nothing about the storage: they reset it
				consecutiveStorageFailures =
					outcome === 'storage-failed' ? consecutiveStorageFailures + 1 : 0
				if (consecutiveStorageFailures >= PURGE_MAX_CONSECUTIVE_STORAGE_FAILURES) {
					this.logger.warn(
						`Account purge stopped after ${consecutiveStorageFailures} consecutive storage failures; the rest next run`,
					)
					return this.finish(result)
				}
			}
			// skipped users stay expired, so the cursor (not a re-query) moves the loop forward
			afterId = userIds[userIds.length - 1]
		}

		return this.finish(result)
	}

	private finish(result: PurgeResult): number {
		if (result.purged > 0 || result.skipped > 0) {
			this.logger.log(
				`Account purge done: purged ${result.purged}, skipped ${result.skipped} (retried next run)`,
			)
		}
		return result.purged
	}

	/** Anything but 'purged' leaves the user in place (bad id, restored meanwhile, or a failure). */
	private async purgeUser(userId: string, now: Date): Promise<PurgeOutcome> {
		// an id that is not a uuid would build a short prefix that could match other users' files
		if (!USER_ID_PATTERN.test(userId)) {
			// the value itself stays out of the log: it is not a uuid, so it is not ours to print
			this.logger.error(`Account purge skipped: invalid user id, skipped (length ${userId.length})`)
			return 'skipped'
		}

		// Lock, storage delete and row delete are one transaction: storage deletion is irreversible, so
		// a restore must not slip in between the check and the delete. The row lock makes a parallel
		// restore wait for our commit (and then find no user); a restore that won the race makes the
		// lock query match nothing. The connection is held while storage works: that is the price,
		// bounded by PURGE_TRANSACTION_TIMEOUT_MS.
		try {
			return await this.prisma.$transaction(
				async (tx): Promise<PurgeOutcome> => {
					if (!(await this.accountRepository.lockExpiredUser({ userId, now }, tx))) return 'skipped'

					try {
						await this.storage.deleteByPrefix(buildUserPrefix({ prefix: this.keyPrefix, userId }))
					} catch (error) {
						// StorageService already logged the operation and error class for a storage failure;
						// nothing was written yet, so the transaction just ends and releases the lock
						this.logger.warn(
							`Account purge skipped: storage cleanup failed (user ${userId}, ${getErrorName(error)})`,
						)
						return 'storage-failed'
					}

					return (await this.accountRepository.deleteExpiredUser({ userId, now }, tx))
						? 'purged'
						: 'skipped'
				},
				{ timeout: PURGE_TRANSACTION_TIMEOUT_MS },
			)
		} catch (error) {
			this.logger.error(`Account purge failed: database (user ${userId}, ${getErrorName(error)})`)
			return 'skipped'
		}
	}
}
