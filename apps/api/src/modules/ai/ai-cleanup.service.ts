import { Injectable, Logger } from '@nestjs/common'
import { Cron, CronExpression } from '@nestjs/schedule'

import { addDays } from '../../common/time'
import { TOOL_CALL_RETENTION_DAYS } from './ai.constants'
import { AiRepository } from './ai.repository'

/** Tool call inputs contain parsed food (RODO), so they live 30 days — enough to debug a prompt. */
@Injectable()
export class AiCleanupService {
	private readonly logger = new Logger(AiCleanupService.name)

	constructor(private readonly aiRepository: AiRepository) {}

	@Cron(CronExpression.EVERY_DAY_AT_3AM)
	async deleteOldToolCalls(): Promise<void> {
		const cutoff = addDays(new Date(), -TOOL_CALL_RETENTION_DAYS)
		const count = await this.aiRepository.deleteToolCallsBefore(cutoff)
		this.logger.log(`Deleted ${count} AI tool calls older than ${TOOL_CALL_RETENTION_DAYS} days`)
	}
}
