import { Logger } from '@nestjs/common'
import { afterAll, beforeEach, describe, expect, it, vi, type Mocked } from 'vitest'

import {
	DELETED_FACT_RETENTION_DAYS,
	FACTS_CLEANUP_CRON,
	UNANSWERED_FACT_RETENTION_DAYS,
} from './facts.constants'
import type { FactsRepository } from './facts.repository'
import { FactsCleanupService } from './facts-cleanup.service'

// the key @Cron stores its options under (not exported from the package index)
const SCHEDULE_CRON_OPTIONS = 'SCHEDULE_CRON_OPTIONS'
const NOW = new Date('2026-10-30T03:15:00Z')
const MS_PER_DAY = 86_400_000

describe('FactsCleanupService', () => {
	const logSpy = vi.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined)
	const errorSpy = vi.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined)
	let repository: Mocked<Pick<FactsRepository, 'deleteExpired'>>
	let service: FactsCleanupService

	beforeEach(() => {
		logSpy.mockClear()
		errorSpy.mockClear()
		repository = { deleteExpired: vi.fn().mockResolvedValue(4) }
		service = new FactsCleanupService(repository as unknown as FactsRepository)
	})

	afterAll(() => {
		logSpy.mockRestore()
		errorSpy.mockRestore()
	})

	it('is scheduled daily at 03:15', () => {
		expect(FACTS_CLEANUP_CRON).toBe('0 15 3 * * *')
		const handler: object = {
			...Object.getOwnPropertyDescriptor(FactsCleanupService.prototype, 'cleanupOnSchedule'),
		}.value as object
		const options: unknown = Reflect.getMetadata(SCHEDULE_CRON_OPTIONS, handler)
		expect(options).toMatchObject({ cronTime: FACTS_CLEANUP_CRON })
	})

	it('deletes facts deleted over 30 days ago and proposals untouched for over 7 days', async () => {
		const count = await service.deleteExpired(NOW)

		expect(count).toBe(4)
		expect(repository.deleteExpired).toHaveBeenCalledWith({
			deletedBefore: new Date(NOW.getTime() - DELETED_FACT_RETENTION_DAYS * MS_PER_DAY),
			staleBefore: new Date(NOW.getTime() - UNANSWERED_FACT_RETENTION_DAYS * MS_PER_DAY),
		})
		expect(DELETED_FACT_RETENTION_DAYS).toBe(30)
		expect(UNANSWERED_FACT_RETENTION_DAYS).toBe(7)
	})

	it('logs the count only', async () => {
		await service.deleteExpired(NOW)

		expect(logSpy).toHaveBeenCalledWith('Fact cleanup done: removed 4')
	})

	it('logs a failed scheduled run without rethrowing', async () => {
		repository.deleteExpired.mockRejectedValue(new Error('db down'))

		await expect(service.cleanupOnSchedule()).resolves.toBeUndefined()

		expect(errorSpy).toHaveBeenCalledWith('Fact cleanup failed (Error)')
	})
})
