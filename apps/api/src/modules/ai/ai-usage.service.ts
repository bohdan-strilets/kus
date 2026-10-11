import { Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'

import type { Env } from '../../config'
import { DailyLimitReachedException, DailyPhotoLimitReachedException } from './ai.exceptions'
import { AiRepository } from './ai.repository'

interface ReserveUsageParams {
	userId: string
	localDate: Date
	hasPhoto: boolean
}

/** Per-user daily budget of AI requests and photos (CLAUDE.md §10, «Rate limiting»). */
@Injectable()
export class AiUsageService {
	private readonly dailyMessageLimit: number
	private readonly dailyPhotoLimit: number

	constructor(
		private readonly aiRepository: AiRepository,
		config: ConfigService<Env, true>,
	) {
		this.dailyMessageLimit = config.get('AI_DAILY_MESSAGE_LIMIT', { infer: true })
		this.dailyPhotoLimit = config.get('AI_DAILY_PHOTO_LIMIT', { infer: true })
	}

	/**
	 * Counts one request (and one photo, if it has any) for the user's local day; throws when a
	 * limit is used up. A photo message counts in both limits.
	 */
	async reserveUsage({ userId, localDate, hasPhoto }: ReserveUsageParams): Promise<void> {
		const isReserved = await this.aiRepository.reserveDailyUsage({
			userId,
			localDate,
			hasPhoto,
			messageLimit: this.dailyMessageLimit,
			photoLimit: this.dailyPhotoLimit,
		})
		if (isReserved) return
		// the photo limit is checked first: a text can still go through when only it is used up
		const isPhotoLimit =
			hasPhoto &&
			(await this.aiRepository.isPhotoLimitUsedUp({
				userId,
				localDate,
				photoLimit: this.dailyPhotoLimit,
			}))
		if (isPhotoLimit) throw new DailyPhotoLimitReachedException(this.dailyPhotoLimit)
		throw new DailyLimitReachedException(this.dailyMessageLimit)
	}
}
