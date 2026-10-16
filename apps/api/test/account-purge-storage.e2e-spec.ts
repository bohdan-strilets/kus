import { Logger } from '@nestjs/common'
import type { NestExpressApplication } from '@nestjs/platform-express'
import { authSessionResponseSchema, createDataResponseSchema } from '@kus/shared'
import request from 'supertest'
import { afterAll, afterEach, describe, expect, it, vi } from 'vitest'

import { addDays } from '../src/common/time'
import { AccountPurgeService } from '../src/modules/account/account-purge.service'
import { AccountRepository } from '../src/modules/account/account.repository'
import { MemoryStorageAdapter } from '../src/modules/storage/memory.adapter'
import { buildStorageKey } from '../src/modules/storage/storage-key'
import { STORAGE_ADAPTER } from '../src/modules/storage/storage.constants'
import type { PrismaService } from '../src/prisma'
import { createCapturingLogger, createDbTestApp } from './create-db-test-app'

const KEY_PREFIX = 'e2e-purge'
const PASSWORD = 'correct-horse-battery'
const DELETE_URL = '/api/v1/account/delete'
const STORAGE_SECRET = 'bucket kus-secret-bucket at https://account.r2.example denied'

const sessionResponse = createDataResponseSchema(authSessionResponseSchema)

describe('account purge with storage (e2e, real DB, memory storage)', () => {
	let app: NestExpressApplication
	let prisma: PrismaService
	let adapter: MemoryStorageAdapter
	let purge: AccountPurgeService
	let repository: AccountRepository
	let logger: ReturnType<typeof createCapturingLogger>
	const silenced = [
		vi.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined),
		vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined),
		vi.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined),
	]

	const start = async (): Promise<void> => {
		logger = createCapturingLogger()
		;({ app, prisma } = await createDbTestApp({ env: { STORAGE_KEY_PREFIX: KEY_PREFIX }, logger }))
		adapter = app.get<MemoryStorageAdapter>(STORAGE_ADAPTER)
		purge = app.get(AccountPurgeService)
		repository = app.get(AccountRepository)
	}

	const registerUser = async (email: string): Promise<string> => {
		const response = await request(app.getHttpServer())
			.post('/api/v1/auth/register')
			.send({ email, password: PASSWORD, name: 'Test', consent: true })
			.expect(201)
		return sessionResponse.parse(response.body).data.user.id
	}

	const expire = (userId: string): Promise<unknown> =>
		prisma.user.update({
			where: { id: userId },
			data: { deletionRequestedAt: addDays(new Date(), -31), purgeAt: addDays(new Date(), -1) },
		})

	/** A stored photo with both objects in storage, a message and an attachment pointing at it. */
	const seedPhoto = async (userId: string, name: string) => {
		const storageKey = buildStorageKey({
			prefix: KEY_PREFIX,
			userId,
			kind: 'photos',
			fileId: name,
		})
		const thumbKey = buildStorageKey({
			prefix: KEY_PREFIX,
			userId,
			kind: 'photos',
			fileId: name,
			variant: 'thumb',
		})
		for (const key of [storageKey, thumbKey]) {
			await adapter.putObject({ key, body: Buffer.from('x'), contentType: 'image/jpeg' })
		}
		const file = await prisma.storedFile.create({
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
		const message = await prisma.message.create({
			data: { userId, role: 'USER', status: 'COMPLETED', content: null },
		})
		const attachment = await prisma.messageAttachment.create({
			data: {
				messageId: message.id,
				mimeType: 'image/jpeg',
				width: 10,
				height: 10,
				sizeBytes: 1,
				status: 'PROCESSED',
				fileId: file.id,
			},
		})
		return {
			storageKey,
			thumbKey,
			fileId: file.id,
			messageId: message.id,
			attachmentId: attachment.id,
		}
	}

	const exists = async (key: string): Promise<boolean> => (await adapter.getObject(key)) !== null

	afterEach(async () => {
		await app.close()
	})

	afterAll(() => {
		for (const spy of silenced) spy.mockRestore()
	})

	it('full path: request deletion, grace passes, files, rows and cascade disappear; a neighbour is untouched', async () => {
		await start()
		const owner = await registerUser('owner@kus.app')
		const neighbour = await registerUser('neighbour@kus.app')
		const ownerPhoto = await seedPhoto(owner, 'p1')
		const neighbourPhoto = await seedPhoto(neighbour, 'p1')
		const agent = request.agent(app.getHttpServer())
		await agent
			.post('/api/v1/auth/login')
			.send({ email: 'owner@kus.app', password: PASSWORD })
			.expect(200)
		await agent.post(DELETE_URL).send({ password: PASSWORD }).expect(204)
		const pending = await prisma.user.findUniqueOrThrow({ where: { id: owner } })
		expect(pending.purgeAt).not.toBeNull()
		// grace still running: nothing happens
		expect(await purge.purgeExpired(new Date())).toBe(0)
		expect(await exists(ownerPhoto.storageKey)).toBe(true)

		await expire(owner)
		const purged = await purge.purgeExpired(new Date())

		expect(purged).toBe(1)
		expect(await exists(ownerPhoto.storageKey)).toBe(false)
		expect(await exists(ownerPhoto.thumbKey)).toBe(false)
		expect(await prisma.user.findUnique({ where: { id: owner } })).toBeNull()
		expect(await prisma.storedFile.count({ where: { userId: owner } })).toBe(0)
		expect(await prisma.message.count({ where: { userId: owner } })).toBe(0)
		expect(
			await prisma.messageAttachment.findUnique({ where: { id: ownerPhoto.attachmentId } }),
		).toBeNull()

		expect(await exists(neighbourPhoto.storageKey)).toBe(true)
		expect(await exists(neighbourPhoto.thumbKey)).toBe(true)
		expect(await prisma.user.findUnique({ where: { id: neighbour } })).not.toBeNull()
		expect(await prisma.storedFile.count({ where: { userId: neighbour } })).toBe(1)
		expect(
			await prisma.messageAttachment.findUnique({ where: { id: neighbourPhoto.attachmentId } }),
		).toMatchObject({
			fileId: neighbourPhoto.fileId,
		})
	})

	it('a storage failure for one user keeps only that user; the others are purged and the next run finishes', async () => {
		await start()
		const ids = [
			await registerUser('a@kus.app'),
			await registerUser('b@kus.app'),
			await registerUser('c@kus.app'),
		]
		const [first, second, third] = [...ids].sort() as [string, string, string]
		const photos = new Map<string, Awaited<ReturnType<typeof seedPhoto>>>()
		for (const id of ids) photos.set(id, await seedPhoto(id, 'p1'))
		for (const id of ids) await expire(id)
		const original = adapter.deleteByPrefix
		const failing = vi
			.spyOn(adapter, 'deleteByPrefix')
			.mockImplementation((prefix: string) =>
				prefix.includes(`/${second}/`)
					? Promise.reject(new Error(STORAGE_SECRET))
					: original(prefix),
			)

		expect(await purge.purgeExpired(new Date())).toBe(2)

		expect(await prisma.user.findUnique({ where: { id: first } })).toBeNull()
		expect(await prisma.user.findUnique({ where: { id: third } })).toBeNull()
		const kept = await prisma.user.findUnique({ where: { id: second } })
		expect(kept?.purgeAt?.getTime()).toBeLessThan(Date.now())
		expect(await exists(photos.get(second)?.storageKey ?? '')).toBe(true)
		expect(await prisma.storedFile.count({ where: { userId: second } })).toBe(1)
		const logged = logger.lines.join('\n')
		expect(logged).not.toContain('kus-secret-bucket')
		expect(logged).not.toContain('r2.example')
		expect(logged).not.toContain(KEY_PREFIX)
		expect(logged).not.toContain('/users/')

		failing.mockRestore()
		expect(await purge.purgeExpired(new Date())).toBe(1)
		expect(await prisma.user.findUnique({ where: { id: second } })).toBeNull()
		expect(await exists(photos.get(second)?.storageKey ?? '')).toBe(false)
	})

	it('a user restored after the page was read is not purged', async () => {
		await start()
		const user = await registerUser('restored@kus.app')
		const photo = await seedPhoto(user, 'p1')
		await expire(user)
		// restore lands between the page query and the per-user check
		const realFind = repository.findExpiredUserIds.bind(repository)
		vi.spyOn(repository, 'findExpiredUserIds').mockImplementation(async (...args) => {
			const ids = await realFind(...args)
			// now before purgeAt: the restore that won the race while the grace was still running
			await repository.restore({ userId: user, now: new Date(0) })
			return ids
		})

		expect(await purge.purgeExpired(new Date())).toBe(0)

		expect(await prisma.user.findUnique({ where: { id: user } })).not.toBeNull()
		expect(await exists(photo.storageKey)).toBe(true)
	})

	describe('AccountRepository on the real DB', () => {
		it('findExpiredUserIds: only past-due users, id asc, keyset cursor and limit', async () => {
			await start()
			const expired = [
				await registerUser('e1@kus.app'),
				await registerUser('e2@kus.app'),
				await registerUser('e3@kus.app'),
			].sort()
			const pending = await registerUser('pending@kus.app')
			const active = await registerUser('active@kus.app')
			for (const id of expired) await expire(id)
			await prisma.user.update({
				where: { id: pending },
				data: { deletionRequestedAt: new Date(), purgeAt: addDays(new Date(), 30) },
			})
			const now = new Date()

			expect(await repository.findExpiredUserIds({ now, limit: 50 })).toEqual(expired)
			expect(await repository.findExpiredUserIds({ now, limit: 2 })).toEqual(expired.slice(0, 2))
			expect(await repository.findExpiredUserIds({ now, limit: 2, afterId: expired[1] })).toEqual([
				expired[2],
			])
			expect(await repository.findExpiredUserIds({ now, limit: 2, afterId: expired[2] })).toEqual(
				[],
			)
			// a moment in the past: nobody is due yet
			expect(await repository.findExpiredUserIds({ now: addDays(now, -5), limit: 50 })).toEqual([])
			expect(active).not.toBeNull()
		})

		it('deleteExpiredUser: true once, false for restored, future, missing', async () => {
			await start()
			const due = await registerUser('due@kus.app')
			const restored = await registerUser('restored@kus.app')
			const future = await registerUser('future@kus.app')
			await expire(due)
			await prisma.user.update({
				where: { id: future },
				data: { deletionRequestedAt: new Date(), purgeAt: addDays(new Date(), 5) },
			})
			const now = new Date()

			expect(await repository.deleteExpiredUser({ userId: restored, now })).toBe(false)
			expect(await repository.deleteExpiredUser({ userId: future, now })).toBe(false)
			expect(await repository.deleteExpiredUser({ userId: due, now })).toBe(true)
			expect(await repository.deleteExpiredUser({ userId: due, now })).toBe(false)
			expect(await prisma.user.count()).toBe(2)
		})

		it('restore: only while purgeAt > now; exactly now, past, active and missing change nothing', async () => {
			await start()
			const purgeAt = new Date('2026-12-01T10:00:00.000Z')
			const requested = new Date('2026-11-01T10:00:00.000Z')
			const pendingUser = async (email: string): Promise<string> => {
				const id = await registerUser(email)
				await prisma.user.update({
					where: { id },
					data: { deletionRequestedAt: requested, purgeAt },
				})
				return id
			}
			const before = await pendingUser('before@kus.app')
			const exact = await pendingUser('exact@kus.app')
			const after = await pendingUser('after@kus.app')
			const active = await registerUser('active@kus.app')
			const missing = '0192a000-0000-7000-8000-00000000dead'
			const stateOf = (id: string) =>
				prisma.user.findUniqueOrThrow({
					where: { id },
					select: { purgeAt: true, deletionRequestedAt: true },
				})

			expect(
				await repository.restore({ userId: before, now: new Date(purgeAt.getTime() - 1) }),
			).toBe(true)
			expect(await stateOf(before)).toEqual({ purgeAt: null, deletionRequestedAt: null })

			// gt, not gte: at the very purgeAt the purge is already allowed to take the account
			expect(await repository.restore({ userId: exact, now: purgeAt })).toBe(false)
			expect(
				await repository.restore({ userId: after, now: new Date(purgeAt.getTime() + 1) }),
			).toBe(false)
			expect(await stateOf(exact)).toEqual({ purgeAt, deletionRequestedAt: requested })
			expect(await stateOf(after)).toEqual({ purgeAt, deletionRequestedAt: requested })

			expect(await repository.restore({ userId: active, now: new Date() })).toBe(false)
			expect(await stateOf(active)).toEqual({ purgeAt: null, deletionRequestedAt: null })
			expect(await repository.restore({ userId: missing, now: new Date() })).toBe(false)
			// restoring twice: the second call has nothing left to change
			expect(await repository.restore({ userId: before, now: new Date(0) })).toBe(false)
		})

		it('findDeletionState: purgeAt for a pending user, null purgeAt for an active one, null for a missing user', async () => {
			await start()
			const user = await registerUser('state@kus.app')
			const missing = '0192a000-0000-7000-8000-00000000dead'

			expect(await repository.findDeletionState(user)).toEqual({ purgeAt: null })
			await expire(user)
			const state = await repository.findDeletionState(user)
			expect(state?.purgeAt).toBeInstanceOf(Date)
			expect(await repository.findDeletionState(missing)).toBeNull()
		})
	})
})
