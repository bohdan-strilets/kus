import { Injectable, Logger } from '@nestjs/common'
import { Cron } from '@nestjs/schedule'

import { addDays } from '../../common/time'
import {
	DELETED_FACT_RETENTION_DAYS,
	FACTS_CLEANUP_CRON,
	UNANSWERED_FACT_RETENTION_DAYS,
} from './facts.constants'
import { FactsRepository } from './facts.repository'

/**
 * Physically removes facts the app no longer needs: deleted ones after the undo window and
 * proposals nobody answered (or the user rejected) after a week. Logs counts only.
 */
@Injectable()
export class FactsCleanupService {
	private readonly logger = new Logger(FactsCleanupService.name)

	constructor(private readonly factsRepository: FactsRepository) {}

	@Cron(FACTS_CLEANUP_CRON)
	async cleanupOnSchedule(): Promise<void> {
		try {
			await this.deleteExpired(new Date())
		} catch (error) {
			// the scheduler would swallow it; the next run retries, nothing is lost
			this.logger.error(`Fact cleanup failed (${error instanceof Error ? error.name : 'unknown'})`)
		}
	}

	async deleteExpired(now: Date): Promise<number> {
		const count = await this.factsRepository.deleteExpired({
			deletedBefore: addDays(now, -DELETED_FACT_RETENTION_DAYS),
			staleBefore: addDays(now, -UNANSWERED_FACT_RETENTION_DAYS),
		})
		this.logger.log(`Fact cleanup done: removed ${count}`)
		return count
	}
}
