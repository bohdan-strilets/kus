import { Logger } from '@nestjs/common'
import type { ConfigService } from '@nestjs/config'
import { afterAll, beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest'

import type { Env } from '../../config'
import { MemoryStorageAdapter } from '../storage/memory.adapter'
import { buildStorageKey } from '../storage/storage-key'
import { StorageService } from '../storage/storage.service'
import { PURGE_BATCH_SIZE, USER_ID_PATTERN } from './account.constants'
import { AccountPurgeService } from './account-purge.service'
import type { AccountRepository } from './account.repository'

const KEY_PREFIX = 'secret-env-prefix'
const BUCKET_SECRET = 'bucket kus-secret-bucket at https://account.r2.example denied'
const NOW = new Date('2026-10-16T04:00:00.000Z')
const PAST = new Date('2026-10-15T04:00:00.000Z')
const FUTURE = new Date('2026-10-20T04:00:00.000Z')

const uuid = (n: number): string => `01999a00-0000-7000-8000-${String(n).padStart(12, '0')}`

const photoKey = (userId: string, fileId: string): string =>
	buildStorageKey({ prefix: KEY_PREFIX, userId, kind: 'photos', fileId })

interface FakeRepository {
	findExpiredUserIds: ReturnType<typeof vi.fn<AccountRepository['findExpiredUserIds']>>
	findDeletionState: ReturnType<typeof vi.fn<AccountRepository['findDeletionState']>>
	deleteExpiredUser: ReturnType<typeof vi.fn<AccountRepository['deleteExpiredUser']>>
}

const createRepository = (): FakeRepository => ({
	findExpiredUserIds: vi.fn<AccountRepository['findExpiredUserIds']>().mockResolvedValue([]),
	findDeletionState: vi
		.fn<AccountRepository['findDeletionState']>()
		.mockResolvedValue({ purgeAt: PAST }),
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
		service = new AccountPurgeService(
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
			expect(repository.deleteExpiredUser).toHaveBeenCalledWith({ userId: a, now: NOW })
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
					expect(repository.findDeletionState).not.toHaveBeenCalled()
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
				['purgeAt is null (restored)', { purgeAt: null }],
				['purgeAt moved to the future', { purgeAt: FUTURE }],
				['the user is already gone', null],
			])('%s: neither storage nor database is touched', async (_name, state) => {
				const a = uuid(1)
				serveExpired(repository, [a])
				const key = await seedPhoto(a)
				repository.findDeletionState.mockResolvedValue(state)

				await expect(service.purgeExpired(NOW)).resolves.toBe(0)

				expect(deleteByPrefixSpy).not.toHaveBeenCalled()
				expect(repository.deleteExpiredUser).not.toHaveBeenCalled()
				expect(await exists(key)).toBe(true)
			})

			it('purges when purgeAt is exactly now', async () => {
				serveExpired(repository, [uuid(1)])
				repository.findDeletionState.mockResolvedValue({ purgeAt: NOW })

				await expect(service.purgeExpired(NOW)).resolves.toBe(1)
			})

			it('skips (does not throw) when the state read itself fails', async () => {
				serveExpired(repository, [uuid(1), uuid(2)])
				repository.findDeletionState.mockRejectedValueOnce(new Error('db down secret-host'))

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
				repository.findDeletionState.mockImplementation((userId) =>
					Promise.resolve({ purgeAt: restored.has(userId) ? null : PAST }),
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
				repository.findDeletionState.mockResolvedValue({ purgeAt: null })

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
			expect(errorSpy.mock.calls[0]?.[0]).toBe('Account purge failed')
			expect(deleteByPrefixSpy).not.toHaveBeenCalled()
		})

		it('does not throw on a non-Error rejection', async () => {
			repository.findExpiredUserIds.mockRejectedValue('weird')

			await expect(service.purgeOnSchedule()).resolves.toBeUndefined()
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
