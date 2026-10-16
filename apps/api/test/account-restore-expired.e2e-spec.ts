import { Logger } from '@nestjs/common'
import type { NestExpressApplication } from '@nestjs/platform-express'
import {
	apiErrorResponseSchema,
	authSessionResponseSchema,
	authUserSchema,
	chatMessageSchema,
	createCursorPaginatedResponseSchema,
	createDataResponseSchema,
} from '@kus/shared'
import request from 'supertest'
import type TestAgent from 'supertest/lib/agent'
import { afterAll, afterEach, describe, expect, it, vi } from 'vitest'

import { addDays } from '../src/common/time'
import { AccountPurgeService } from '../src/modules/account/account-purge.service'
import { AccountRepository } from '../src/modules/account/account.repository'
import { MemoryStorageAdapter } from '../src/modules/storage/memory.adapter'
import { buildStorageKey } from '../src/modules/storage/storage-key'
import { STORAGE_ADAPTER } from '../src/modules/storage/storage.constants'
import type { PrismaService } from '../src/prisma'
import { createDbTestApp } from './create-db-test-app'

const KEY_PREFIX = 'e2e-restore'
const PASSWORD = 'correct-horse-battery'
const RESTORE_URL = '/api/v1/account/restore'
const MESSAGES_URL = '/api/v1/messages'
const RACE_ITERATIONS = 4
const LOCK_POLL_ATTEMPTS = 200
const LOCK_POLL_INTERVAL_MS = 10

const sessionResponse = createDataResponseSchema(authSessionResponseSchema)
const userResponse = createDataResponseSchema(authUserSchema)
const messagesResponse = createCursorPaginatedResponseSchema(chatMessageSchema)

interface TestUser {
	agent: TestAgent
	userId: string
	storageKey: string
	thumbKey: string
}

describe('restoring an account after its grace period (e2e, real DB, memory storage)', () => {
	let app: NestExpressApplication
	let prisma: PrismaService
	let adapter: MemoryStorageAdapter
	let purge: AccountPurgeService
	let repository: AccountRepository
	const silenced = [
		vi.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined),
		vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined),
		vi.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined),
	]

	const start = async (): Promise<void> => {
		;({ app, prisma } = await createDbTestApp({ env: { STORAGE_KEY_PREFIX: KEY_PREFIX } }))
		adapter = app.get<MemoryStorageAdapter>(STORAGE_ADAPTER)
		purge = app.get(AccountPurgeService)
		repository = app.get(AccountRepository)
	}

	const exists = async (key: string): Promise<boolean> => (await adapter.getObject(key)) !== null

	/**
	 * Registers (the agent keeps the cookies), stores a photo with its files and an achievement.
	 * Registration is throttled to 5 per minute, so each test registers one or two users.
	 */
	const registerUser = async (email: string): Promise<TestUser> => {
		const agent = request.agent(app.getHttpServer())
		const response = await agent
			.post('/api/v1/auth/register')
			.send({ email, password: PASSWORD, name: 'Test', consent: true })
			.expect(201)
		const userId = sessionResponse.parse(response.body).data.user.id
		const storageKey = buildStorageKey({ prefix: KEY_PREFIX, userId, kind: 'photos', fileId: 'p1' })
		const thumbKey = buildStorageKey({
			prefix: KEY_PREFIX,
			userId,
			kind: 'photos',
			fileId: 'p1',
			variant: 'thumb',
		})
		for (const key of [storageKey, thumbKey]) {
			await adapter.putObject({ key, body: Buffer.from('x'), contentType: 'image/jpeg' })
		}
		await prisma.storedFile.create({
			data: {
				userId,
				kind: 'MESSAGE_PHOTO',
				storageKey,
				thumbKey,
				mimeType: 'image/jpeg',
				width: 10,
				height: 10,
				sizeBytes: 1,
				thumbSizeBytes: 1,
			},
		})
		await prisma.achievement.create({
			data: { userId, type: 'FOOD_STREAK', value: 3, achievedAt: new Date() },
		})
		return { agent, userId, storageKey, thumbKey }
	}

	/** Puts the account in the deletion queue; the session cookie stays valid (restore allows it). */
	const setPurgeAt = (userId: string, purgeAt: Date): Promise<unknown> =>
		prisma.user.update({
			where: { id: userId },
			data: { deletionRequestedAt: addDays(purgeAt, -30), purgeAt },
		})

	const countData = async (
		user: TestUser,
	): Promise<{ files: number; achievements: number; messages: number }> => ({
		files: await prisma.storedFile.count({ where: { userId: user.userId } }),
		achievements: await prisma.achievement.count({ where: { userId: user.userId } }),
		messages: await prisma.message.count({ where: { userId: user.userId } }),
	})

	/**
	 * Waits (bounded polling on a second connection, not a fixed sleep) until some backend is blocked
	 * on a row lock running a statement like `queryPattern`: proof that a call is really waiting.
	 */
	const waitForLockWaiter = async (queryPattern: string): Promise<void> => {
		for (let attempt = 0; attempt < LOCK_POLL_ATTEMPTS; attempt += 1) {
			const rows = await prisma.$queryRaw<{ waiting: number }[]>`
				SELECT count(*)::int AS waiting FROM pg_stat_activity
				WHERE datname = current_database()
					AND wait_event_type = 'Lock'
					AND query ILIKE ${queryPattern}`
			if ((rows[0]?.waiting ?? 0) > 0) return
			await new Promise((resolve) => setTimeout(resolve, LOCK_POLL_INTERVAL_MS))
		}
		throw new Error(`No backend blocked on a lock for ${queryPattern}`)
	}

	afterEach(async () => {
		await app.close()
	})

	afterAll(() => {
		for (const spy of silenced) spy.mockRestore()
	})

	describe('POST /account/restore', () => {
		it('restores an account whose grace is still running and greets once', async () => {
			await start()
			const user = await registerUser('inside@kus.app')
			await setPurgeAt(user.userId, new Date(Date.now() + 60_000))

			const response = await user.agent.post(RESTORE_URL).expect(200)

			expect(userResponse.parse(response.body).data).toMatchObject({
				pendingDeletion: false,
				purgeAt: null,
			})
			const stored = await prisma.user.findUniqueOrThrow({ where: { id: user.userId } })
			expect(stored.purgeAt).toBeNull()
			expect(stored.deletionRequestedAt).toBeNull()
			const feed = await user.agent.get(MESSAGES_URL).expect(200)
			expect(messagesResponse.parse(feed.body).data).toHaveLength(1)
		})

		it('after purgeAt answers 409 ACCOUNT_RESTORE_EXPIRED and keeps the account, its data and files', async () => {
			await start()
			const user = await registerUser('expired@kus.app')
			const purgeAt = new Date(Date.now() - 60_000)
			await setPurgeAt(user.userId, purgeAt)
			const before = await countData(user)

			const response = await user.agent.post(RESTORE_URL).expect(409)

			expect(apiErrorResponseSchema.parse(response.body)).toEqual({
				statusCode: 409,
				errorCode: 'ACCOUNT_RESTORE_EXPIRED',
				details: {},
			})
			const stored = await prisma.user.findUniqueOrThrow({ where: { id: user.userId } })
			expect(stored.purgeAt).toEqual(purgeAt)
			expect(stored.deletionRequestedAt).not.toBeNull()
			expect(await countData(user)).toEqual(before)
			expect(
				await prisma.message.count({ where: { userId: user.userId, role: 'ASSISTANT' } }),
			).toBe(0)
			expect(await exists(user.storageKey)).toBe(true)
			expect(await exists(user.thumbKey)).toBe(true)
		})

		it('keeps answering 409 on a repeated attempt (no half-restored state)', async () => {
			await start()
			const user = await registerUser('twice@kus.app')
			await setPurgeAt(user.userId, new Date(Date.now() - 1_000))

			await user.agent.post(RESTORE_URL).expect(409)
			await user.agent.post(RESTORE_URL).expect(409)

			const stored = await prisma.user.findUniqueOrThrow({ where: { id: user.userId } })
			expect(stored.purgeAt).not.toBeNull()
		})

		it('an active account gets 200 idempotently, with no greeting and nothing changed', async () => {
			await start()
			const user = await registerUser('active@kus.app')

			const response = await user.agent.post(RESTORE_URL).expect(200)
			await user.agent.post(RESTORE_URL).expect(200)

			expect(userResponse.parse(response.body).data).toMatchObject({
				id: user.userId,
				pendingDeletion: false,
				purgeAt: null,
			})
			expect(await prisma.message.count({ where: { userId: user.userId } })).toBe(0)
		})

		it('does not let one user restore (or learn about) another user account', async () => {
			await start()
			const owner = await registerUser('owner@kus.app')
			const other = await registerUser('other@kus.app')
			await setPurgeAt(owner.userId, new Date(Date.now() + 60_000))

			// the other user restores "themselves": the pending owner is not touched
			await other.agent.post(RESTORE_URL).expect(200)

			const stored = await prisma.user.findUniqueOrThrow({ where: { id: owner.userId } })
			expect(stored.purgeAt).not.toBeNull()
		})
	})

	describe('restore vs purge', () => {
		it('(a) restored before purgeAt: the purge finds nothing and the files stay', async () => {
			await start()
			const user = await registerUser('a@kus.app')
			await setPurgeAt(user.userId, new Date(Date.now() + 60_000))
			await user.agent.post(RESTORE_URL).expect(200)

			expect(await purge.purgeExpired(new Date())).toBe(0)
			// even a purge run far in the future must not take a restored account
			expect(await purge.purgeExpired(addDays(new Date(), 365))).toBe(0)

			expect(await prisma.user.findUnique({ where: { id: user.userId } })).not.toBeNull()
			expect(await exists(user.storageKey)).toBe(true)
			expect(await exists(user.thumbKey)).toBe(true)
		})

		it('(b) purgeAt passed: restore is refused, then the purge removes the account with its files', async () => {
			await start()
			const user = await registerUser('b@kus.app')
			await setPurgeAt(user.userId, new Date(Date.now() - 60_000))

			await user.agent.post(RESTORE_URL).expect(409)
			expect(await purge.purgeExpired(new Date())).toBe(1)

			expect(await prisma.user.findUnique({ where: { id: user.userId } })).toBeNull()
			expect(await countData(user)).toEqual({ files: 0, achievements: 0, messages: 0 })
			expect(await exists(user.storageKey)).toBe(false)
			expect(await exists(user.thumbKey)).toBe(false)
		})

		it('(c) in parallel with purgeAt in the past: never a live account with deleted files, never a 5xx', async () => {
			for (let i = 0; i < RACE_ITERATIONS; i += 1) {
				await start()
				const user = await registerUser(`race${i}@kus.app`)
				await setPurgeAt(user.userId, new Date(Date.now() - 1_000))

				const [response, purged] = await Promise.all([
					user.agent.post(RESTORE_URL),
					purge.purgeExpired(new Date()),
				])

				expect(response.status).toBeLessThan(500)
				// 409 (state read before the purge) or a refusal because the user is gone: never a restore
				expect(response.status).not.toBe(200)
				const alive = (await prisma.user.findUnique({ where: { id: user.userId } })) !== null
				const hasFiles = (await exists(user.storageKey)) || (await exists(user.thumbKey))
				if (alive) {
					expect(hasFiles).toBe(true)
				}
				// the purge always finishes the job for an expired account, with restore or without
				expect(purged).toBe(1)
				expect(alive).toBe(false)
				expect(hasFiles).toBe(false)
				await app.close()
			}
			// afterEach closes the last app; start one more so it has something to close
			await start()
		})

		it('(c2) in parallel with purgeAt still in the future: nothing is deleted, restore wins', async () => {
			await start()
			const user = await registerUser('c2@kus.app')
			await setPurgeAt(user.userId, new Date(Date.now() + 60_000))

			const [response, purged] = await Promise.all([
				user.agent.post(RESTORE_URL),
				purge.purgeExpired(new Date()),
			])

			expect(response.status).toBe(200)
			expect(purged).toBe(0)
			expect(await prisma.user.findUnique({ where: { id: user.userId } })).not.toBeNull()
			expect(await exists(user.storageKey)).toBe(true)
			expect(await exists(user.thumbKey)).toBe(true)
		})

		it('(d) a restore that read its clock before purgeAt, started while the purge holds the row, waits for the commit and finds no user', async () => {
			await start()
			const user = await registerUser('d@kus.app')
			await setPurgeAt(user.userId, new Date(Date.now() - 1_000))
			const realDelete = adapter.deleteByPrefix.bind(adapter)
			let restore: Promise<boolean> | undefined
			let wasBlockedDuringPurge = false
			vi.spyOn(adapter, 'deleteByPrefix').mockImplementation(async (prefix: string) => {
				await realDelete(prefix)
				// the clock was read before purgeAt; the call is deliberately not awaited: it must wait
				restore = repository.restore({ userId: user.userId, now: new Date(0) })
				await waitForLockWaiter('UPDATE%')
				wasBlockedDuringPurge = true
			})

			const purged = await purge.purgeExpired(new Date())

			expect(purged).toBe(1)
			expect(wasBlockedDuringPurge).toBe(true)
			// after the commit the restore re-checks the row: it is gone, nothing is restored
			await expect(restore).resolves.toBe(false)
			expect(await prisma.user.findUnique({ where: { id: user.userId } })).toBeNull()
			expect(await exists(user.storageKey)).toBe(false)
			expect(await exists(user.thumbKey)).toBe(false)
		})

		it('(d2) the same through HTTP: the blocked restore answers 404 USER_NOT_FOUND, not 5xx', async () => {
			await start()
			const user = await registerUser('d2@kus.app')
			await setPurgeAt(user.userId, new Date(Date.now() - 1_000))
			const realRestore = repository.restore.bind(repository)
			// the service reads its clock before purgeAt: only the clock is replaced, the flow is real
			vi.spyOn(repository, 'restore').mockImplementation((args, tx) =>
				realRestore({ ...args, now: new Date(0) }, tx),
			)
			const realDelete = adapter.deleteByPrefix.bind(adapter)
			let response: Promise<request.Response> | undefined
			vi.spyOn(adapter, 'deleteByPrefix').mockImplementation(async (prefix: string) => {
				await realDelete(prefix)
				response = user.agent.post(RESTORE_URL).then((result) => result)
				await waitForLockWaiter('UPDATE%')
			})

			expect(await purge.purgeExpired(new Date())).toBe(1)

			const result = await response
			expect(result?.status).toBe(404)
			expect(apiErrorResponseSchema.parse(result?.body)).toEqual({
				statusCode: 404,
				errorCode: 'USER_NOT_FOUND',
				details: {},
			})
			expect(await prisma.user.findUnique({ where: { id: user.userId } })).toBeNull()
			expect(await exists(user.storageKey)).toBe(false)
		})

		it('(e) restore commits first: the purge, waiting on the row lock, sees it no longer qualifies and leaves the files', async () => {
			await start()
			const user = await registerUser('e@kus.app')
			await setPurgeAt(user.userId, new Date(Date.now() - 1_000))
			const deleteSpy = vi.spyOn(adapter, 'deleteByPrefix')
			let release: () => void = () => undefined
			const gate = new Promise<void>((resolve) => {
				release = resolve
			})
			let markRestored: () => void = () => undefined
			const restoredInTx = new Promise<void>((resolve) => {
				markRestored = resolve
			})
			// the restore holds the row (changed, not yet committed) while the purge starts
			const holder = prisma.$transaction(async (tx) => {
				const restored = await repository.restore({ userId: user.userId, now: new Date(0) }, tx)
				markRestored()
				await gate
				return restored
			})
			await restoredInTx

			const purging = purge.purgeExpired(new Date())
			await waitForLockWaiter('SELECT%FOR UPDATE%')
			release()

			expect(await holder).toBe(true)
			expect(await purging).toBe(0)
			expect(deleteSpy).not.toHaveBeenCalled()
			const stored = await prisma.user.findUniqueOrThrow({ where: { id: user.userId } })
			expect(stored.purgeAt).toBeNull()
			expect(await exists(user.storageKey)).toBe(true)
			expect(await exists(user.thumbKey)).toBe(true)
		})

		it('(c3) real parallelism: exactly one side wins, and a live account never loses its files', async () => {
			for (let i = 0; i < RACE_ITERATIONS; i += 1) {
				await start()
				const user = await registerUser(`race3-${i}@kus.app`)
				await setPurgeAt(user.userId, new Date(Date.now() - 1_000))

				const [restored, purged] = await Promise.all([
					repository.restore({ userId: user.userId, now: new Date(0) }),
					purge.purgeExpired(new Date()),
				])

				const alive = (await prisma.user.findUnique({ where: { id: user.userId } })) !== null
				const hasFiles = (await exists(user.storageKey)) || (await exists(user.thumbKey))
				expect(restored).toBe(alive)
				expect(purged).toBe(alive ? 0 : 1)
				expect(hasFiles).toBe(alive)
				await app.close()
			}
			// afterEach closes the last app; start one more so it has something to close
			await start()
		})

		it('lockExpiredUser runs against Postgres: matches an expired user, not a future, active or missing one', async () => {
			await start()
			const expired = await registerUser('lock-expired@kus.app')
			const future = await registerUser('lock-future@kus.app')
			const active = await registerUser('lock-active@kus.app')
			const now = new Date()
			await setPurgeAt(expired.userId, new Date(now.getTime() - 1))
			await setPurgeAt(future.userId, new Date(now.getTime() + 60_000))
			const lock = (userId: string, at: Date): Promise<boolean> =>
				prisma.$transaction((tx) => repository.lockExpiredUser({ userId, now: at }, tx))

			expect(await lock(expired.userId, now)).toBe(true)
			expect(await lock(future.userId, now)).toBe(false)
			expect(await lock(active.userId, now)).toBe(false)
			expect(await lock('0192a000-0000-7000-8000-00000000dead', now)).toBe(false)
			// the boundary is inclusive: purgeAt exactly now is purgeable
			const exact = new Date(now.getTime() + 60_000)
			expect(await lock(future.userId, exact)).toBe(true)
		})
	})
})
