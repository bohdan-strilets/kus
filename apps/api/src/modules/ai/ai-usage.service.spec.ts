import { HttpStatus } from '@nestjs/common'
import type { ConfigService } from '@nestjs/config'
import { beforeEach, describe, expect, it, vi, type Mocked } from 'vitest'

import { ErrorCodes } from '../../common/exceptions'
import type { Env } from '../../config'
import { AiUsageService } from './ai-usage.service'
import { DailyPhotoLimitReachedException } from './ai.exceptions'
import type { AiRepository } from './ai.repository'

const USER_ID = '0192a000-0000-7000-8000-000000000001'
const LOCAL_DATE = new Date('2026-10-15T00:00:00Z')
const MESSAGE_LIMIT = 40
const PHOTO_LIMIT = 7

describe('AiUsageService photo limit', () => {
	let repository: Mocked<Pick<AiRepository, 'isPhotoLimitUsedUp' | 'reserveDailyUsage'>>
	let service: AiUsageService

	beforeEach(() => {
		repository = {
			isPhotoLimitUsedUp: vi.fn().mockResolvedValue(false),
			reserveDailyUsage: vi.fn().mockResolvedValue(true),
		}
		const values: Record<string, number> = {
			AI_DAILY_MESSAGE_LIMIT: MESSAGE_LIMIT,
			AI_DAILY_PHOTO_LIMIT: PHOTO_LIMIT,
		}
		service = new AiUsageService(
			repository as unknown as AiRepository,
			{
				get: (key: string) => values[key],
			} as unknown as ConfigService<Env, true>,
		)
	})

	it.each([[true], [false]])('isPhotoLimitReached returns %s from the repository', async (used) => {
		repository.isPhotoLimitUsedUp.mockResolvedValue(used)

		await expect(
			service.isPhotoLimitReached({ userId: USER_ID, localDate: LOCAL_DATE }),
		).resolves.toBe(used)

		expect(repository.isPhotoLimitUsedUp).toHaveBeenCalledWith({
			userId: USER_ID,
			localDate: LOCAL_DATE,
			photoLimit: PHOTO_LIMIT,
		})
	})

	it('isPhotoLimitReached counts nothing', async () => {
		await service.isPhotoLimitReached({ userId: USER_ID, localDate: LOCAL_DATE })

		expect(repository.reserveDailyUsage).not.toHaveBeenCalled()
	})

	it('getDailyPhotoLimit returns the configured limit', () => {
		expect(service.getDailyPhotoLimit()).toBe(PHOTO_LIMIT)
	})

	it('reserveUsage still reports the photo limit without resetsAt', async () => {
		repository.reserveDailyUsage.mockResolvedValue(false)
		repository.isPhotoLimitUsedUp.mockResolvedValue(true)

		const error: unknown = await service
			.reserveUsage({ userId: USER_ID, localDate: LOCAL_DATE, hasPhoto: true })
			.catch((caught: unknown) => caught)

		expect(error).toBeInstanceOf(DailyPhotoLimitReachedException)
		expect((error as DailyPhotoLimitReachedException).details).toEqual({ limit: PHOTO_LIMIT })
	})
})

describe('DailyPhotoLimitReachedException', () => {
	it('is a 429 with the limit only when there is no resetsAt', () => {
		const error = new DailyPhotoLimitReachedException(5)

		expect(error.getStatus()).toBe(HttpStatus.TOO_MANY_REQUESTS)
		expect(error.errorCode).toBe(ErrorCodes.DAILY_PHOTO_LIMIT_REACHED)
		expect(error.details).toEqual({ limit: 5 })
		expect(error.details).not.toHaveProperty('resetsAt')
	})

	it('adds resetsAt as an ISO string', () => {
		const error = new DailyPhotoLimitReachedException(5, new Date('2026-10-15T22:00:00Z'))

		expect(error.details).toEqual({ limit: 5, resetsAt: '2026-10-15T22:00:00.000Z' })
	})
})
