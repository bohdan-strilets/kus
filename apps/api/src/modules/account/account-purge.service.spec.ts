import { Logger } from '@nestjs/common'
import type { ConfigService } from '@nestjs/config'
import { afterAll, beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest'

import type { Env } from '../../config'
import type { PrismaService } from '../../prisma'
import { MemoryStorageAdapter } from '../storage/memory.adapter'
import { buildStorageKey } from '../storage/storage-key'
import { StorageService } from '../storage/storage.service'
import {
	PURGE_BATCH_SIZE,
	PURGE_MAX_CONSECUTIVE_STORAGE_FAILURES,
	PURGE_TRANSACTION_TIMEOUT_MS,
	USER_ID_PATTERN,
} from './account.constants'
import { AccountPurgeService } from './account-purge.service'
import type { AccountRepository } from './account.repository'

const KEY_PREFIX = 'secret-env-prefix'
const BUCKET_SECRET = 'bucket kus-secret-bucket at https://account.r2.example denied'
const NOW = new Date('2026-10-16T04:00:00.000Z')

const uuid = (n: number): string => `01999a00-0000-7000-8000-${String(n).padStart(12, '0')}`

const photoKey = (userId: string, fileId: string): string =>
	buildStorageKey({ prefix: KEY_PREFIX, userId, kind: 'photos', fileId })

interface FakeRepository {
	findExpiredUserIds: ReturnType<typeof vi.fn<AccountRepository['findExpiredUserIds']>>
	lockExpiredUser: ReturnType<typeof vi.fn<AccountRepository['lockExpiredUser']>>
	deleteExpiredUser: ReturnType<typeof vi.fn<AccountRepository['deleteExpiredUser']>>
}

const createRepository = (): FakeRepository => ({
	findExpiredUserIds: vi.fn<AccountRepository['findExpiredUserIds']>().mockResolvedValue([]),
	lockExpiredUser: vi.fn<AccountRepository['lockExpiredUser']>().mockResolvedValue(true),
	deleteExpiredUser: vi.fn<AccountRepository['deleteExpiredUser']>().mockResolvedValue(true),
})

/** Behaves like the real keyset query over a fixed, id-ordered list of expired users. */
const serveExpired = (repository: FakeRepository, ids: string[]): void => {
	repository.findExpiredUserIds.mockImplementation(({ limit, afterId }) =>
		Promise.resolve(
			[...ids]
				.sort()
				.filter((id) => afterId === undefined || id > afterId)
				.slice(0, limit),
		),
	)
}

describe('AccountPurgeService', () => {
	const logSpy = vi.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined)
	const warnSpy = vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined)
	const errorSpy = vi.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined)
	let repository: FakeRepository
	let adapter: MemoryStorageAdapter
	let deleteByPrefixSpy: MockInstance<MemoryStorageAdapter['deleteByPrefix']>
	let originalDeleteByPrefix: MemoryStorageAdapter['deleteByPrefix']
	let service: AccountPurgeService
	let tx: object
	let transactionSpy: ReturnType<typeof vi.fn>

	const allLogs = (): string => JSON.stringify([logSpy, warnSpy, errorSpy].map((s) => s.mock.calls))

	const seedPhoto = async (userId: string, fileId = 'f1'): Promise<string> => {
		const key = photoKey(userId, fileId)
		await adapter.putObject({ key, body: Buffer.from('x'), contentType: 'image/jpeg' })
		return key
	}
	const exists = async (key: string): Promise<boolean> => (await adapter.getObject(key)) !== null

	beforeEach(() => {
		vi.clearAllMocks()
		repository = createRepository()
		adapter = new MemoryStorageAdapter()
		originalDeleteByPrefix = adapter.deleteByPrefix
		deleteByPrefixSpy = vi.spyOn(adapter, 'deleteByPrefix')
		const config = { get: () => KEY_PREFIX } as unknown as ConfigService<Env, true>
		tx = { marker: 'tx' }
		transactionSpy = vi.fn((callback: (client: object) => Promise<unknown>) => callback(tx))
		service = new AccountPurgeService(
			{ $transaction: transactionSpy } as unknown as PrismaService,
			repository as unknown as AccountRepository,
			new StorageService(adapter),
			config,
		)
	})

	afterAll(() => {
		vi.restoreAllMocks()
	})

	describe('purgeExpired', () => {
		it('removes the user files from storage and then the database row', async () => {
			const [a, b] = [uuid(1), uuid(2)]
			serveExpired(repository, [a])
			const aKey = await seedPhoto(a)
			const bKey = await seedPhoto(b)

			const purged = await service.purgeExpired(NOW)

			expect(purged).toBe(1)
			expect(await exists(aKey)).toBe(false)
			expect(await exists(bKey)).toBe(true)
			expect(repository.deleteExpiredUser).toHaveBeenCalledWith({ userId: a, now: NOW }, tx)
		})

		it('runs lock, storage delete and row delete in this order inside one transaction with a timeout', async () => {
			const a = uuid(1)
			serveExpired(repository, [a])
			const order: string[] = []
			repository.lockExpiredUser.mockImplementation(() => {
				order.push('lock')
				return Promise.resolve(true)
			})
			deleteByPrefixSpy.mockImplementation(() => {
				order.push('storage')
				return Promise.resolve()
			})
			repository.deleteExpiredUser.mockImplementation(() => {
				order.push('delete')
				return Promise.resolve(true)
			})

			await service.purgeExpired(NOW)

			expect(order).toEqual(['lock', 'storage', 'delete'])
			expect(transactionSpy).toHaveBeenCalledTimes(1)
			expect(transactionSpy.mock.calls[0]?.[1]).toEqual({ timeout: PURGE_TRANSACTION_TIMEOUT_MS })
			expect(repository.lockExpiredUser).toHaveBeenCalledWith({ userId: a, now: NOW }, tx)
		})

		it('uses a transaction timeout above the 5 s default', () => {
			expect(PURGE_TRANSACTION_TIMEOUT_MS).toBeGreaterThan(5_000)
		})

		it('deletes a user who has no files in storage', async () => {
			const a = uuid(1)
			serveExpired(repository, [a])

			await expect(service.purgeExpired(NOW)).resolves.toBe(1)

			expect(repository.deleteExpiredUser).toHaveBeenCalledTimes(1)
		})

		it('does nothing and logs nothing when no one is expired', async () => {
			await expect(service.purgeExpired(NOW)).resolves.toBe(0)

			expect(repository.deleteExpiredUser).not.toHaveBeenCalled()
			expect(deleteByPrefixSpy).not.toHaveBeenCalled()
			expect(logSpy).not.toHaveBeenCalled()
		})

		it('never touches files of another user, even one whose id starts the same way', async () => {
			const a = '01999a00-0000-7000-8000-000000000001'
			const twin = '01999a00-0000-7000-8000-000000000001' + '0'
			const sameStart = '01999a00-0000-7000-8000-000000000011'
			serveExpired(repository, [a])
			const aKey = await seedPhoto(a)
			const twinKey = await seedPhoto(twin)
			const startKey = await seedPhoto(sameStart)
			const pendingKey = await seedPhoto(uuid(99))

			await service.purgeExpired(NOW)

			expect(await exists(aKey)).toBe(false)
			expect(await exists(twinKey)).toBe(true)
			expect(await exists(startKey)).toBe(true)
			expect(await exists(pendingKey)).toBe(true)
		})

		describe('storage failure', () => {
			it('keeps that user in the database, purges the others and counts only real deletions', async () => {
				const [a, b, c] = [uuid(1), uuid(2), uuid(3)]
				serveExpired(repository, [a, b, c])
				const bKey = await seedPhoto(b)
				const realDelete = originalDeleteByPrefix
				deleteByPrefixSpy.mockImplementation((prefix: string) =>
					prefix.includes(`/${b}/`) ? Promise.reject(new Error(BUCKET_SECRET)) : realDelete(prefix),
				)

				const purged = await service.purgeExpired(NOW)

				expect(purged).toBe(2)
				const deletedIds = repository.deleteExpiredUser.mock.calls.map(([arg]) => arg.userId)
				expect(deletedIds).toEqual([a, c])
				expect(await exists(bKey)).toBe(true)
				expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('purged 2, skipped 1'))
			})

			it('is retried by the next run once the storage is back', async () => {
				const a = uuid(1)
				serveExpired(repository, [a])
				const key = await seedPhoto(a)
				const realDelete = originalDeleteByPrefix
				deleteByPrefixSpy.mockRejectedValueOnce(new Error(BUCKET_SECRET))

				expect(await service.purgeExpired(NOW)).toBe(0)
				expect(repository.deleteExpiredUser).not.toHaveBeenCalled()
				expect(await exists(key)).toBe(true)

				deleteByPrefixSpy.mockImplementation(realDelete)
				expect(await service.purgeExpired(NOW)).toBe(1)
				expect(repository.deleteExpiredUser).toHaveBeenCalledTimes(1)
				expect(await exists(key)).toBe(false)
			})

			it('leaks no key, prefix, bucket or SDK text into the logs', async () => {
				const a = uuid(1)
				serveExpired(repository, [a])
				await seedPhoto(a)
				deleteByPrefixSpy.mockRejectedValue(new Error(BUCKET_SECRET))

				await service.purgeExpired(NOW)

				const logged = allLogs()
				expect(logged).toContain(a)
				expect(logged).not.toContain(KEY_PREFIX)
				expect(logged).not.toContain('/users/')
				expect(logged).not.toContain('kus-secret-bucket')
				expect(logged).not.toContain('r2.example')
			})
		})

		describe('database failure', () => {
			it('does not stop the others and logs only the user id and error class', async () => {
				const [a, b, c] = [uuid(1), uuid(2), uuid(3)]
				serveExpired(repository, [a, b, c])
				repository.deleteExpiredUser.mockImplementation(({ userId }) =>
					userId === b
						? Promise.reject(new TypeError('connection to db.secret-host:5432 refused'))
						: Promise.resolve(true),
				)

				const purged = await service.purgeExpired(NOW)

				expect(purged).toBe(2)
				expect(repository.deleteExpiredUser).toHaveBeenCalledTimes(3)
				expect(errorSpy).toHaveBeenCalledTimes(1)
				const logged = allLogs()
				expect(logged).toContain(b)
				expect(logged).not.toContain('secret-host')
				expect(logged).not.toContain(KEY_PREFIX)
				expect(logged).toContain('purged 2, skipped 1')
			})

			it('survives a non-Error rejection', async () => {
				serveExpired(repository, [uuid(1)])
				repository.deleteExpiredUser.mockRejectedValue('boom secret')

				await expect(service.purgeExpired(NOW)).resolves.toBe(0)
				expect(allLogs()).not.toContain('boom secret')
				expect(errorSpy.mock.calls[0]?.[0]).toContain('unknown')
			})

			it.each([
				[
					'lock',
					(): void => {
						repository.lockExpiredUser.mockRejectedValue(
							new TypeError('db.secret-host:5432 refused'),
						)
					},
				],
				[
					'delete',
					(): void => {
						repository.deleteExpiredUser.mockRejectedValue(
							new TypeError('db.secret-host:5432 refused'),
						)
					},
				],
				[
					'$transaction',
					(): void => {
						transactionSpy.mockRejectedValue(new TypeError('db.secret-host:5432 refused'))
					},
				],
			])(
				'a failure from %s is skipped, logged by error.name only, never throws',
				async (_name, arrange) => {
					const a = uuid(1)
					serveExpired(repository, [a])
					await seedPhoto(a)
					arrange()

					await expect(service.purgeExpired(NOW)).resolves.toBe(0)

					expect(errorSpy).toHaveBeenCalledTimes(1)
					expect(errorSpy.mock.calls[0]?.[0]).toContain(a)
					expect(errorSpy.mock.calls[0]?.[0]).toContain('TypeError')
					expect(allLogs()).not.toContain('secret-host')
					expect(allLogs()).not.toContain(KEY_PREFIX)
					expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('purged 0, skipped 1'))
				},
			)

			it('a lock failure never reaches storage or the delete', async () => {
				serveExpired(repository, [uuid(1)])
				repository.lockExpiredUser.mockRejectedValue(new Error('lock timeout'))

				await service.purgeExpired(NOW)

				expect(deleteByPrefixSpy).not.toHaveBeenCalled()
				expect(repository.deleteExpiredUser).not.toHaveBeenCalled()
			})
		})

		it('counts a user as skipped when the row was already gone or restored (delete returns false)', async () => {
			serveExpired(repository, [uuid(1), uuid(2)])
			repository.deleteExpiredUser.mockResolvedValueOnce(false)

			await expect(service.purgeExpired(NOW)).resolves.toBe(1)
			expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('purged 1, skipped 1'))
		})

		describe('invalid user id', () => {
			it.each(['not-a-uuid', '', '01999a00', `${uuid(1)}/../`, `${uuid(1)}x`, 'users/'])(
				'skips %j without touching storage or the database',
				async (badId) => {
					repository.findExpiredUserIds.mockResolvedValueOnce([badId]).mockResolvedValue([])

					await expect(service.purgeExpired(NOW)).resolves.toBe(0)

					expect(deleteByPrefixSpy).not.toHaveBeenCalled()
					expect(transactionSpy).not.toHaveBeenCalled()
					expect(repository.lockExpiredUser).not.toHaveBeenCalled()
					expect(repository.deleteExpiredUser).not.toHaveBeenCalled()
					expect(errorSpy).toHaveBeenCalledTimes(1)
					expect(allLogs()).not.toContain(KEY_PREFIX)
					expect(allLogs()).toContain('invalid user id, skipped')
					// the bad value is never printed (an empty string is in every log, so skip it)
					if (badId !== '') expect(allLogs()).not.toContain(badId)
				},
			)

			it('still purges the valid users around it', async () => {
				const [a, c] = [uuid(1), uuid(3)]
				repository.findExpiredUserIds.mockResolvedValueOnce([a, 'garbage', c]).mockResolvedValue([])

				await expect(service.purgeExpired(NOW)).resolves.toBe(2)
				expect(deleteByPrefixSpy).toHaveBeenCalledTimes(2)
			})
		})

		describe('race with restore', () => {
			it.each([
				['restored (purgeAt is null)'],
				['purgeAt moved to the future'],
				['the user is already gone'],
			])('%s: the lock matches nothing, neither storage nor delete is touched', async () => {
				const a = uuid(1)
				serveExpired(repository, [a])
				const key = await seedPhoto(a)
				repository.lockExpiredUser.mockResolvedValue(false)

				await expect(service.purgeExpired(NOW)).resolves.toBe(0)

				expect(repository.lockExpiredUser).toHaveBeenCalledTimes(1)
				expect(deleteByPrefixSpy).not.toHaveBeenCalled()
				expect(repository.deleteExpiredUser).not.toHaveBeenCalled()
				expect(await exists(key)).toBe(true)
				expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('purged 0, skipped 1'))
			})

			it('purges when purgeAt is exactly now: the same now goes to the lock and the delete', async () => {
				const a = uuid(1)
				serveExpired(repository, [a])

				await expect(service.purgeExpired(NOW)).resolves.toBe(1)

				expect(repository.lockExpiredUser).toHaveBeenCalledWith({ userId: a, now: NOW }, tx)
				expect(repository.deleteExpiredUser).toHaveBeenCalledWith({ userId: a, now: NOW }, tx)
			})

			it('skips (does not throw) when the lock query fails, and the others go on', async () => {
				serveExpired(repository, [uuid(1), uuid(2)])
				repository.lockExpiredUser.mockRejectedValueOnce(new Error('db down secret-host'))

				await expect(service.purgeExpired(NOW)).resolves.toBe(1)
				expect(allLogs()).not.toContain('secret-host')
			})
		})

		describe('pagination', () => {
			it('walks every page by the id cursor and terminates, with skipped users inside pages', async () => {
				const total = PURGE_BATCH_SIZE * 2 + 17
				const ids = Array.from({ length: total }, (_, i) => uuid(i + 1))
				serveExpired(repository, ids)
				// every 3rd user is skipped (restored meanwhile)
				const restored = new Set(ids.filter((_, i) => i % 3 === 0))
				repository.lockExpiredUser.mockImplementation(({ userId }) =>
					Promise.resolve(!restored.has(userId)),
				)

				const purged = await service.purgeExpired(NOW)

				expect(purged).toBe(total - restored.size)
				expect(repository.deleteExpiredUser).toHaveBeenCalledTimes(total - restored.size)
				const calls = repository.findExpiredUserIds.mock.calls.map(([arg]) => arg)
				expect(calls.every((arg) => arg.limit === PURGE_BATCH_SIZE)).toBe(true)
				expect(calls[0]?.afterId).toBeUndefined()
				// each cursor is the last id of the previous page: strictly increasing
				expect(calls.slice(1).map((arg) => arg.afterId)).toEqual([
					ids[PURGE_BATCH_SIZE - 1],
					ids[PURGE_BATCH_SIZE * 2 - 1],
					ids[total - 1],
				])
				expect(logSpy).toHaveBeenCalledWith(
					expect.stringContaining(`purged ${total - restored.size}, skipped ${restored.size}`),
				)
			})

			it('terminates when a full page is entirely skipped', async () => {
				const ids = Array.from({ length: PURGE_BATCH_SIZE + 5 }, (_, i) => uuid(i + 1))
				serveExpired(repository, ids)
				repository.lockExpiredUser.mockResolvedValue(false)

				await expect(service.purgeExpired(NOW)).resolves.toBe(0)

				expect(repository.findExpiredUserIds).toHaveBeenCalledTimes(3)
				expect(logSpy).toHaveBeenCalledWith(
					expect.stringContaining(`skipped ${PURGE_BATCH_SIZE + 5}`),
				)
			})

			it('processes users in the order the repository returns them (id asc)', async () => {
				const ids = [uuid(5), uuid(2), uuid(9)]
				serveExpired(repository, ids)

				await service.purgeExpired(NOW)

				expect(repository.deleteExpiredUser.mock.calls.map(([arg]) => arg.userId)).toEqual(
					[...ids].sort(),
				)
			})
		})

		describe('circuit breaker', () => {
			const LIMIT = PURGE_MAX_CONSECUTIVE_STORAGE_FAILURES
			const STOP_MESSAGE = `Account purge stopped after ${LIMIT} consecutive storage failures; the rest next run`

			/** Storage fails (with a text full of secrets) for the listed users, works for the rest. */
			const failStorageFor = (failing: Set<string>): void => {
				const realDelete = originalDeleteByPrefix
				deleteByPrefixSpy.mockImplementation((prefix: string) =>
					[...failing].some((id) => prefix.includes(`/${id}/`))
						? Promise.reject(new Error(BUCKET_SECRET))
						: realDelete(prefix),
				)
			}
			const ids = (from: number, to: number): string[] =>
				Array.from({ length: to - from + 1 }, (_, i) => uuid(from + i))
			const stopWarnings = (): unknown[][] =>
				warnSpy.mock.calls.filter(([message]) => String(message).includes('stopped after'))

			it('uses 5 as the threshold', () => {
				expect(LIMIT).toBe(5)
			})

			it('stops the run after 5 storage failures in a row and leaves the rest untouched', async () => {
				const all = ids(1, 8)
				serveExpired(repository, all)
				failStorageFor(new Set(all))

				await expect(service.purgeExpired(NOW)).resolves.toBe(0)

				expect(deleteByPrefixSpy).toHaveBeenCalledTimes(LIMIT)
				const visited = repository.lockExpiredUser.mock.calls.map(([arg]) => arg.userId)
				expect(visited).toEqual(all.slice(0, LIMIT))
				expect(repository.deleteExpiredUser).not.toHaveBeenCalled()
				expect(stopWarnings()).toEqual([[STOP_MESSAGE]])
			})

			it('returns the accounts already deleted and still prints the summary after stopping', async () => {
				const all = ids(1, 10)
				serveExpired(repository, all)
				failStorageFor(new Set(all.slice(3)))

				const purged = await service.purgeExpired(NOW)

				expect(purged).toBe(3)
				// users 4..8 fail, 9 and 10 are never tried
				expect(deleteByPrefixSpy).toHaveBeenCalledTimes(8)
				expect(repository.deleteExpiredUser).toHaveBeenCalledTimes(3)
				expect(logSpy).toHaveBeenCalledExactlyOnceWith(
					`Account purge done: purged 3, skipped ${LIMIT} (retried next run)`,
				)
				expect(stopWarnings()).toHaveLength(1)
			})

			it('does not stop on 4 failures in a row', async () => {
				const all = ids(1, 6)
				serveExpired(repository, all)
				failStorageFor(new Set(all.slice(0, LIMIT - 1)))

				await expect(service.purgeExpired(NOW)).resolves.toBe(2)

				expect(stopWarnings()).toHaveLength(0)
				expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('purged 2, skipped 4'))
			})

			it('is reset by a success: 4 failures, a success, 4 failures do not stop', async () => {
				const all = ids(1, 10)
				serveExpired(repository, all)
				failStorageFor(new Set([...all.slice(0, 4), ...all.slice(5, 9)]))

				await expect(service.purgeExpired(NOW)).resolves.toBe(2)

				expect(deleteByPrefixSpy).toHaveBeenCalledTimes(10)
				expect(stopWarnings()).toHaveLength(0)
			})

			it.each([
				['a user restored meanwhile'],
				['a user whose purgeAt moved to the future'],
				['a user who is already gone'],
			])('is reset by %s (lock matches nothing)', async () => {
				const all = ids(1, 10)
				serveExpired(repository, all)
				failStorageFor(new Set([...all.slice(0, 4), ...all.slice(5, 9)]))
				repository.lockExpiredUser.mockImplementation(({ userId }) =>
					Promise.resolve(userId !== all[4]),
				)

				await expect(service.purgeExpired(NOW)).resolves.toBe(1)

				expect(stopWarnings()).toHaveLength(0)
				// the skipped user's storage was never touched
				expect(deleteByPrefixSpy).toHaveBeenCalledTimes(9)
			})

			it('is reset by an invalid user id', async () => {
				const all = ids(1, 9)
				const withGarbage = [...all.slice(0, 4), 'garbage', ...all.slice(4)]
				repository.findExpiredUserIds.mockResolvedValueOnce(withGarbage).mockResolvedValue([])
				failStorageFor(new Set(all.slice(0, 8)))

				await expect(service.purgeExpired(NOW)).resolves.toBe(1)

				expect(stopWarnings()).toHaveLength(0)
				expect(deleteByPrefixSpy).toHaveBeenCalledTimes(9)
			})

			it('is reset by a delete that found nothing to delete (restored in the last moment)', async () => {
				const all = ids(1, 10)
				serveExpired(repository, all)
				failStorageFor(new Set([...all.slice(0, 4), ...all.slice(5, 9)]))
				repository.deleteExpiredUser.mockResolvedValueOnce(false)

				await expect(service.purgeExpired(NOW)).resolves.toBe(1)

				expect(stopWarnings()).toHaveLength(0)
			})

			it('does not count a database failure as a storage failure: it resets and never stops', async () => {
				const all = ids(1, 10)
				serveExpired(repository, all)
				failStorageFor(new Set([...all.slice(0, 4), ...all.slice(5, 9)]))
				repository.lockExpiredUser.mockImplementation(({ userId }) =>
					userId === all[4]
						? Promise.reject(new TypeError('db.secret-host:5432 refused'))
						: Promise.resolve(true),
				)

				await expect(service.purgeExpired(NOW)).resolves.toBe(1)

				expect(stopWarnings()).toHaveLength(0)
				expect(allLogs()).not.toContain('secret-host')
			})

			it('visits every user when the database read fails for all of them', async () => {
				const all = ids(1, LIMIT * 2)
				serveExpired(repository, all)
				repository.lockExpiredUser.mockRejectedValue(new Error('db down'))

				await expect(service.purgeExpired(NOW)).resolves.toBe(0)

				expect(repository.lockExpiredUser).toHaveBeenCalledTimes(all.length)
				expect(deleteByPrefixSpy).not.toHaveBeenCalled()
				expect(stopWarnings()).toHaveLength(0)
			})

			it('does not count a $transaction failure towards the breaker', async () => {
				const all = ids(1, LIMIT * 2)
				serveExpired(repository, all)
				transactionSpy.mockRejectedValue(new Error('db down'))

				await expect(service.purgeExpired(NOW)).resolves.toBe(0)

				expect(transactionSpy).toHaveBeenCalledTimes(all.length)
				expect(stopWarnings()).toHaveLength(0)
			})

			it('does not count a database delete failure (storage already succeeded) towards the breaker', async () => {
				const all = ids(1, LIMIT * 2)
				serveExpired(repository, all)
				repository.deleteExpiredUser.mockRejectedValue(new Error('db down'))

				await expect(service.purgeExpired(NOW)).resolves.toBe(0)

				expect(repository.deleteExpiredUser).toHaveBeenCalledTimes(all.length)
				expect(stopWarnings()).toHaveLength(0)
			})

			it('counts failures across page boundaries and stops without reading further pages', async () => {
				const total = PURGE_BATCH_SIZE * 2
				const all = ids(1, total)
				serveExpired(repository, all)
				// the last 2 of page one and the first 3 of page two
				const failing = new Set(all.slice(PURGE_BATCH_SIZE - 2, PURGE_BATCH_SIZE + 3))
				failStorageFor(failing)

				const purged = await service.purgeExpired(NOW)

				expect(purged).toBe(PURGE_BATCH_SIZE - 2)
				const calls = repository.findExpiredUserIds.mock.calls.map(([arg]) => arg)
				expect(calls.map((arg) => arg.afterId)).toEqual([undefined, all[PURGE_BATCH_SIZE - 1]])
				expect(stopWarnings()).toHaveLength(1)
				expect(repository.lockExpiredUser).toHaveBeenCalledTimes(PURGE_BATCH_SIZE + 3)
			})

			it('keeps paginating normally when failures never reach the threshold', async () => {
				const total = PURGE_BATCH_SIZE * 2 + 10
				const all = ids(1, total)
				serveExpired(repository, all)
				// every 10th user fails: never 5 in a row
				const failing = new Set(all.filter((_, i) => i % 10 === 0))
				failStorageFor(failing)

				await expect(service.purgeExpired(NOW)).resolves.toBe(total - failing.size)

				expect(stopWarnings()).toHaveLength(0)
				expect(repository.findExpiredUserIds).toHaveBeenCalledTimes(4)
			})

			it('stops on the next run too while the storage is down, then finishes once it is back', async () => {
				const all = ids(1, 7)
				serveExpired(repository, all)
				failStorageFor(new Set(all))

				expect(await service.purgeExpired(NOW)).toBe(0)
				expect(await service.purgeExpired(NOW)).toBe(0)
				expect(stopWarnings()).toHaveLength(2)

				deleteByPrefixSpy.mockImplementation(originalDeleteByPrefix)
				expect(await service.purgeExpired(NOW)).toBe(7)
			})

			it('logs the stop without keys, prefixes, bucket, user ids or SDK text', async () => {
				const all = ids(1, 6)
				serveExpired(repository, all)
				for (const id of all) await seedPhoto(id)
				failStorageFor(new Set(all))

				await service.purgeExpired(NOW)

				const logged = allLogs()
				expect(logged).not.toContain(KEY_PREFIX)
				expect(logged).not.toContain('/users/')
				expect(logged).not.toContain('kus-secret-bucket')
				expect(logged).not.toContain('r2.example')
				expect(logged).not.toContain('denied')
				expect(String(stopWarnings()[0]?.[0])).not.toMatch(USER_ID_PATTERN)
				for (const id of all) expect(String(stopWarnings()[0]?.[0])).not.toContain(id)
			})
		})

		it('lets a failing page query propagate', async () => {
			repository.findExpiredUserIds.mockRejectedValue(new Error('db down'))

			await expect(service.purgeExpired(NOW)).rejects.toThrow('db down')
		})
	})

	describe('purgeOnSchedule', () => {
		it('purges with the current time', async () => {
			serveExpired(repository, [uuid(1)])

			await service.purgeOnSchedule()

			expect(repository.deleteExpiredUser).toHaveBeenCalledTimes(1)
			const now = repository.findExpiredUserIds.mock.calls[0]?.[0].now
			expect(now).toBeInstanceOf(Date)
			expect(Math.abs((now?.getTime() ?? 0) - Date.now())).toBeLessThan(5_000)
		})

		it('does not throw when the page query fails and logs no sensitive text', async () => {
			repository.findExpiredUserIds.mockRejectedValue(
				new Error('conn postgres://u:pw@secret-host/db'),
			)

			await expect(service.purgeOnSchedule()).resolves.toBeUndefined()

			expect(errorSpy).toHaveBeenCalledTimes(1)
			// only the error class: no message and no stack (both can carry hosts and credentials)
			expect(errorSpy.mock.calls[0]).toEqual(['Account purge failed (Error)'])
			expect(allLogs()).not.toContain('secret-host')
			expect(allLogs()).not.toContain('postgres://')
			expect(deleteByPrefixSpy).not.toHaveBeenCalled()
		})

		it('logs only error.name for a subclass of Error', async () => {
			repository.findExpiredUserIds.mockRejectedValue(new TypeError('boom secret-host'))

			await service.purgeOnSchedule()

			expect(errorSpy.mock.calls).toEqual([['Account purge failed (TypeError)']])
		})

		it('does not throw on a non-Error rejection and prints none of it', async () => {
			repository.findExpiredUserIds.mockRejectedValue('weird secret')

			await expect(service.purgeOnSchedule()).resolves.toBeUndefined()

			expect(errorSpy.mock.calls).toEqual([['Account purge failed (unknown)']])
			expect(allLogs()).not.toContain('weird secret')
		})

		it('does not throw when the storage keeps failing: the breaker stop is a normal result', async () => {
			const all = Array.from({ length: 6 }, (_, i) => uuid(i + 1))
			serveExpired(repository, all)
			deleteByPrefixSpy.mockRejectedValue(new Error(BUCKET_SECRET))

			await expect(service.purgeOnSchedule()).resolves.toBeUndefined()

			expect(deleteByPrefixSpy).toHaveBeenCalledTimes(PURGE_MAX_CONSECUTIVE_STORAGE_FAILURES)
			expect(allLogs()).not.toContain('Account purge failed')
		})
	})
})

describe('account purge constants', () => {
	it('PURGE_BATCH_SIZE is 50', () => {
		expect(PURGE_BATCH_SIZE).toBe(50)
	})

	it.each([uuid(1), 'ABCDEF01-0000-7000-8000-ABCDEF012345'])('USER_ID_PATTERN accepts %s', (id) => {
		expect(USER_ID_PATTERN.test(id)).toBe(true)
	})

	it.each([
		'',
		'abc',
		`${uuid(1)} `,
		` ${uuid(1)}`,
		`${uuid(1)}\n`,
		`${uuid(1)}/`,
		'01999a00-0000-7000-8000-00000000000g',
		'01999a0000007000800000000000001',
	])('USER_ID_PATTERN rejects %j', (id) => {
		expect(USER_ID_PATTERN.test(id)).toBe(false)
	})
})
