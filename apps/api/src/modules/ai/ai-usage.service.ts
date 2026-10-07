import { Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'

import type { Env } from '../../config'
import { DailyLimitReachedException } from './ai.exceptions'
import { AiRepository } from './ai.repository'

/** Per-user daily budget of AI requests (CLAUDE.md §10, «Rate limiting»). */
@Injectable()
export class AiUsageService {
	private readonly dailyMessageLimit: number

	constructor(
		private readonly aiRepository: AiRepository,
		config: ConfigService<Env, true>,
	) {
		this.dailyMessageLimit = config.get('AI_DAILY_MESSAGE_LIMIT', { infer: true })
	}

	/** Counts one request for the user's local day; throws when the limit is used up. */
	async reserveMessage(userId: string, localDate: Date): Promise<void> {
		const isReserved = await this.aiRepository.reserveDailyMessage({
			userId,
			localDate,
			limit: this.dailyMessageLimit,
		})
		if (!isReserved) throw new DailyLimitReachedException(this.dailyMessageLimit)
	}
}
