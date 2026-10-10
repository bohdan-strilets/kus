import { Injectable, Logger } from '@nestjs/common'
import { Cron, CronExpression } from '@nestjs/schedule'

import { AccountRepository } from './account.repository'

/** Hard-deletes accounts past their 30-day grace. Idempotent; logs only a count, never who. */
@Injectable()
export class AccountPurgeService {
	private readonly logger = new Logger(AccountPurgeService.name)

	constructor(private readonly accountRepository: AccountRepository) {}

	@Cron(CronExpression.EVERY_DAY_AT_4AM)
	async purgeOnSchedule(): Promise<void> {
		try {
			await this.purgeExpired(new Date())
		} catch (error) {
			// the scheduler would swallow it; the next run retries, nothing is lost
			this.logger.error('Account purge failed', error instanceof Error ? error.stack : error)
		}
	}

	async purgeExpired(now: Date): Promise<number> {
		const count = await this.accountRepository.deleteExpired(now)
		if (count > 0) this.logger.log(`Purged ${count} accounts past their deletion date`)
		return count
	}
}
