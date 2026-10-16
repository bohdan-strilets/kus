import { Logger } from '@nestjs/common'
import type { ConfigService } from '@nestjs/config'
import { afterAll, afterEach, beforeEach, describe, expect, it, vi, type Mocked } from 'vitest'

import type { Env } from '../../config'
import {
	CLEANUP_BATCH_SIZE,
	CLEANUP_CRON,
	CLEANUP_MAX_CONSECUTIVE_FAILURES,
} from './photos.constants'
import type { OrphanFileRef, PhotosRepository } from './photos.repository'
import {
	type PhotosService,
	REMOVE_ATTACHED,
	REMOVE_DONE,
	REMOVE_NOT_FOUND,
	type RemoveUnattachedResult,
} from './photos.service'
import { PhotosCleanupService } from './photos-cleanup.service'

// the key @Cron stores its options under (not exported from the package index)
const SCHEDULE_CRON_OPTIONS = 'SCHEDULE_CRON_OPTIONS'
const TTL_HOURS = 6
const MS_PER_HOUR = 3_600_000
const NOW = new Date('2026-10-16T12:00:00Z')
const USER_A = '0192a000-0000-7000-8000-000000000001'
const USER_B = '0192a000-0000-7000-8000-000000000002'
const SECRET = 'bucket kus-secret-bucket at https://acc.r2.example denied'

/** Ids sort the same as their numbers, like the uuids the keyset cursor compares. */
const fileId = (n: number): string => `0192a000-0000-7000-8000-${String(n).padStart(12, '0')}`
const orphan = (n: number, userId = USER_A): OrphanFileRef => ({ id: fileId(n), userId })

describe('PhotosCleanupService', () => {
	const logSpies = {
		log: vi.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined),
		warn: vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined),
		error: vi.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined),
	}
	let repository: Mocked<Pick<PhotosRepository, 'findOrphans'>>
	let photos: Mocked<Pick<PhotosService, 'removeUnattached'>>
	let service: PhotosCleanupService

	const allLogs = (): string =>
		Object.values(logSpies)
			.flatMap((spy) => spy.mock.calls.map((call) => String(call[0])))
			.join('\n')

	/** One page per call, in order; then empty. */
	const serve = (...pages: OrphanFileRef[][]): void => {
		for (const page of pages) repository.findOrphans.mockResolvedValueOnce(page)
		repository.findOrphans.mockResolvedValue([])
	}

	beforeEach(() => {
		repository = { findOrphans: vi.fn().mockResolvedValue([]) }
		photos = { removeUnattached: vi.fn().mockResolvedValue(REMOVE_DONE) }
		const values: Record<string, unknown> = { PHOTO_ORPHAN_TTL_HOURS: TTL_HOURS }
		const config = { get: (key: string) => values[key] } as unknown as ConfigService<Env, true>
		service = new PhotosCleanupService(
			repository as unknown as PhotosRepository,
			photos as unknown as PhotosService,
			config,
		)
	})

	afterEach(() => {
		for (const spy of Object.values(logSpies)) {
			spy.mockClear()
			spy.mockImplementation(() => undefined)
		}
	})

	afterAll(() => {
		for (const spy of Object.values(logSpies)) spy.mockRestore()
	})

	describe('cleanupOrphans', () => {
		it('removes every orphan through the guarded removal, for its own owner', async () => {
			serve([orphan(1, USER_A), orphan(2, USER_B)])

			const result = await service.cleanupOrphans(NOW)

			expect(result).toEqual({ removed: 2, skipped: 0 })
			expect(photos.removeUnattached.mock.calls).toEqual([
				[USER_A, fileId(1)],
				[USER_B, fileId(2)],
			])
		})

		it('asks for orphans older than now minus the configured TTL, one page at a time', async () => {
			await service.cleanupOrphans(NOW)

			expect(repository.findOrphans).toHaveBeenCalledWith({
				olderThan: new Date(NOW.getTime() - TTL_HOURS * MS_PER_HOUR),
				limit: CLEANUP_BATCH_SIZE,
				afterId: undefined,
			})
		})

		it('does nothing and logs nothing when there are no orphans', async () => {
			const result = await service.cleanupOrphans(NOW)

			expect(result).toEqual({ removed: 0, skipped: 0 })
			expect(photos.removeUnattached).not.toHaveBeenCalled()
			expect(logSpies.log).not.toHaveBeenCalled()
			expect(logSpies.warn).not.toHaveBeenCalled()
		})

		it.each([
			['attached to a message', REMOVE_ATTACHED],
			['already gone or not found', REMOVE_NOT_FOUND],
		] as [string, RemoveUnattachedResult][])(
			'skips a file that was %s meanwhile: no warning, not counted',
			async (_name, outcome) => {
				serve([orphan(1), orphan(2)])
				photos.removeUnattached.mockResolvedValueOnce(outcome)

				const result = await service.cleanupOrphans(NOW)

				expect(result).toEqual({ removed: 1, skipped: 0 })
				expect(logSpies.warn).not.toHaveBeenCalled()
			},
		)

		it('logs no summary when every file lost its race', async () => {
			serve([orphan(1), orphan(2)])
			photos.removeUnattached.mockResolvedValue(REMOVE_ATTACHED)

			const result = await service.cleanupOrphans(NOW)

			expect(result).toEqual({ removed: 0, skipped: 0 })
			expect(logSpies.log).not.toHaveBeenCalled()
		})

		it('logs a summary with the counts when something was removed or skipped', async () => {
			serve([orphan(1), orphan(2), orphan(3)])
			photos.removeUnattached
				.mockResolvedValueOnce(REMOVE_DONE)
				.mockRejectedValueOnce(new Error('storage down'))
				.mockResolvedValueOnce(REMOVE_DONE)

			await service.cleanupOrphans(NOW)

			expect(logSpies.log).toHaveBeenCalledTimes(1)
			expect(logSpies.log.mock.calls[0]?.[0]).toContain('removed 2, skipped 1')
		})

		it('logs the summary for a run that only skipped', async () => {
			serve([orphan(1)])
			photos.removeUnattached.mockRejectedValue(new Error('storage down'))

			await service.cleanupOrphans(NOW)

			expect(logSpies.log.mock.calls[0]?.[0]).toContain('removed 0, skipped 1')
		})

		it('keeps going after a failed file: the others are removed, the failed one counts as skipped', async () => {
			serve([orphan(1), orphan(2), orphan(3)])
			photos.removeUnattached.mockImplementation((_userId, id) =>
				id === fileId(2) ? Promise.reject(new Error(SECRET)) : Promise.resolve(REMOVE_DONE),
			)

			const result = await service.cleanupOrphans(NOW)

			expect(result).toEqual({ removed: 2, skipped: 1 })
			expect(photos.removeUnattached).toHaveBeenCalledTimes(3)
		})

		describe('circuit breaker', () => {
			it(`stops after ${CLEANUP_MAX_CONSECUTIVE_FAILURES} failures in a row and warns`, async () => {
				const page = Array.from({ length: CLEANUP_MAX_CONSECUTIVE_FAILURES + 3 }, (_v, i) =>
					orphan(i + 1),
				)
				serve(page)
				photos.removeUnattached.mockRejectedValue(new Error('storage down'))

				const result = await service.cleanupOrphans(NOW)

				expect(photos.removeUnattached).toHaveBeenCalledTimes(CLEANUP_MAX_CONSECUTIVE_FAILURES)
				expect(result).toEqual({ removed: 0, skipped: CLEANUP_MAX_CONSECUTIVE_FAILURES })
				expect(allLogs()).toContain(`stopped after ${CLEANUP_MAX_CONSECUTIVE_FAILURES} failures`)
				// no further page is requested after the stop
				expect(repository.findOrphans).toHaveBeenCalledTimes(1)
			})

			it('logs the summary after a stop', async () => {
				serve(Array.from({ length: CLEANUP_MAX_CONSECUTIVE_FAILURES }, (_v, i) => orphan(i + 1)))
				photos.removeUnattached.mockRejectedValue(new Error('storage down'))

				await service.cleanupOrphans(NOW)

				expect(logSpies.log.mock.calls[0]?.[0]).toContain(
					`removed 0, skipped ${CLEANUP_MAX_CONSECUTIVE_FAILURES}`,
				)
			})

			it('does not stop one failure short of the limit', async () => {
				const failures = CLEANUP_MAX_CONSECUTIVE_FAILURES - 1
				serve(Array.from({ length: failures + 1 }, (_v, i) => orphan(i + 1)))
				photos.removeUnattached.mockImplementation((_userId, id) =>
					id === fileId(failures + 1)
						? Promise.resolve(REMOVE_DONE)
						: Promise.reject(new Error('x')),
				)

				const result = await service.cleanupOrphans(NOW)

				expect(result).toEqual({ removed: 1, skipped: failures })
				expect(allLogs()).not.toContain('stopped after')
			})

			it('resets the counter on a success, so scattered failures never stop the run', async () => {
				const total = CLEANUP_MAX_CONSECUTIVE_FAILURES * 3
				serve(Array.from({ length: total }, (_v, i) => orphan(i + 1)))
				// fail, fail, ..., fail (limit - 1), succeed — repeated
				let call = 0
				photos.removeUnattached.mockImplementation(() => {
					call += 1
					return call % CLEANUP_MAX_CONSECUTIVE_FAILURES === 0
						? Promise.resolve(REMOVE_DONE)
						: Promise.reject(new Error('flaky'))
				})

				const result = await service.cleanupOrphans(NOW)

				expect(photos.removeUnattached).toHaveBeenCalledTimes(total)
				expect(result.removed).toBe(3)
				expect(result.skipped).toBe(total - 3)
				expect(allLogs()).not.toContain('stopped after')
			})

			it('a lost race between failures also resets the counter', async () => {
				const failures = CLEANUP_MAX_CONSECUTIVE_FAILURES - 1
				serve(Array.from({ length: failures * 2 + 1 }, (_v, i) => orphan(i + 1)))
				let call = 0
				photos.removeUnattached.mockImplementation(() => {
					call += 1
					return call === failures + 1
						? Promise.resolve(REMOVE_NOT_FOUND)
						: Promise.reject(new Error('x'))
				})

				await service.cleanupOrphans(NOW)

				expect(photos.removeUnattached).toHaveBeenCalledTimes(failures * 2 + 1)
				expect(allLogs()).not.toContain('stopped after')
			})
		})

		describe('pagination', () => {
			it('walks several pages by the id of the last orphan of the previous page', async () => {
				const first = Array.from({ length: CLEANUP_BATCH_SIZE }, (_v, i) => orphan(i + 1))
				const second = [orphan(CLEANUP_BATCH_SIZE + 1), orphan(CLEANUP_BATCH_SIZE + 2)]
				serve(first, second)

				const result = await service.cleanupOrphans(NOW)

				expect(result.removed).toBe(CLEANUP_BATCH_SIZE + 2)
				const cursors = repository.findOrphans.mock.calls.map(([args]) => args.afterId)
				expect(cursors).toEqual([
					undefined,
					fileId(CLEANUP_BATCH_SIZE),
					fileId(CLEANUP_BATCH_SIZE + 2),
				])
			})

			it('moves the cursor past files that failed, so a stuck file never loops forever', async () => {
				const first = Array.from({ length: CLEANUP_BATCH_SIZE }, (_v, i) => orphan(i + 1))
				serve(first, [orphan(CLEANUP_BATCH_SIZE + 1)])
				// every 3rd fails, never 5 in a row; the last file of the first page fails too
				photos.removeUnattached.mockImplementation((_userId, id) =>
					id === fileId(CLEANUP_BATCH_SIZE) || id === fileId(3)
						? Promise.reject(new Error('stuck'))
						: Promise.resolve(REMOVE_DONE),
				)

				const result = await service.cleanupOrphans(NOW)

				expect(result).toEqual({ removed: CLEANUP_BATCH_SIZE - 1, skipped: 2 })
				expect(repository.findOrphans).toHaveBeenCalledTimes(3)
				expect(repository.findOrphans.mock.calls[1]?.[0].afterId).toBe(fileId(CLEANUP_BATCH_SIZE))
			})

			it('with a repository that keeps returning failed files only after the cursor, the run ends', async () => {
				// simulates the real keyset: only ids greater than afterId come back
				const all = Array.from({ length: CLEANUP_BATCH_SIZE * 2 + 5 }, (_v, i) => orphan(i + 1))
				repository.findOrphans.mockImplementation(({ afterId, limit }) =>
					Promise.resolve(all.filter((o) => !afterId || o.id > afterId).slice(0, limit)),
				)
				// a failing file every 4th keeps the breaker quiet
				photos.removeUnattached.mockImplementation((_userId, id) =>
					Number(id.slice(-12)) % 4 === 0
						? Promise.reject(new Error('stuck'))
						: Promise.resolve(REMOVE_DONE),
				)

				const result = await service.cleanupOrphans(NOW)

				expect(photos.removeUnattached).toHaveBeenCalledTimes(all.length)
				expect(result.removed + result.skipped).toBe(all.length)
			})
		})

		describe('log hygiene', () => {
			it('never logs storage keys, prefix, bucket or the text of the error', async () => {
				serve([orphan(1)])
				photos.removeUnattached.mockRejectedValue(new Error(SECRET))

				await service.cleanupOrphans(NOW)

				const logged = allLogs()
				expect(logged).not.toContain('kus-secret-bucket')
				expect(logged).not.toContain('r2.example')
				expect(logged).not.toContain('denied')
				expect(logged).not.toContain('/users/')
				expect(logged).toContain('Error')
				// ids are fine and expected
				expect(logged).toContain(fileId(1))
			})

			it('names a non-Error rejection as unknown without printing it', async () => {
				serve([orphan(1)])
				photos.removeUnattached.mockRejectedValue(SECRET)

				await service.cleanupOrphans(NOW)

				const logged = allLogs()
				expect(logged).toContain('unknown')
				expect(logged).not.toContain('kus-secret-bucket')
			})
		})

		it('lets a repository failure through (the schedule wrapper handles it)', async () => {
			repository.findOrphans.mockRejectedValue(new Error('db down'))

			await expect(service.cleanupOrphans(NOW)).rejects.toThrow('db down')
		})
	})

	describe('cleanupOnSchedule', () => {
		it('runs a cleanup at the current moment', async () => {
			vi.useFakeTimers({ now: NOW })
			try {
				await service.cleanupOnSchedule()
			} finally {
				vi.useRealTimers()
			}

			expect(repository.findOrphans).toHaveBeenCalledWith(
				expect.objectContaining({ olderThan: new Date(NOW.getTime() - TTL_HOURS * MS_PER_HOUR) }),
			)
		})

		it('does not throw when the cleanup fails, and logs only the error name', async () => {
			class StorageBoom extends Error {
				override name = 'StorageBoom'
			}
			repository.findOrphans.mockRejectedValue(new StorageBoom(SECRET))

			await expect(service.cleanupOnSchedule()).resolves.toBeUndefined()

			expect(logSpies.error).toHaveBeenCalledTimes(1)
			const [message, ...rest] = logSpies.error.mock.calls[0] ?? []
			expect(message).toContain('StorageBoom')
			expect(rest).toHaveLength(0)
			const logged = allLogs()
			expect(logged).not.toContain('kus-secret-bucket')
			expect(logged).not.toContain('denied')
			expect(logged).not.toContain(' at ')
		})

		it('does not throw for a non-Error and does not print it', async () => {
			repository.findOrphans.mockRejectedValue(SECRET)

			await expect(service.cleanupOnSchedule()).resolves.toBeUndefined()

			expect(logSpies.error).toHaveBeenCalledTimes(1)
			expect(allLogs()).toContain('unknown')
			expect(allLogs()).not.toContain('kus-secret-bucket')
		})

		it('logs nothing at error level on a clean run', async () => {
			await service.cleanupOnSchedule()

			expect(logSpies.error).not.toHaveBeenCalled()
		})
	})

	describe('schedule', () => {
		it('runs daily at 03:30, between the tool-call cleanup and the account purge', () => {
			expect(CLEANUP_CRON).toBe('0 30 3 * * *')
			const handler: object = {
				...Object.getOwnPropertyDescriptor(PhotosCleanupService.prototype, 'cleanupOnSchedule'),
			}.value as object
			const options: unknown = Reflect.getMetadata(SCHEDULE_CRON_OPTIONS, handler)
			expect(options).toMatchObject({ cronTime: CLEANUP_CRON })
		})
	})
})
