import { randomUUID } from 'node:crypto'

import { Logger } from '@nestjs/common'
import type { NestExpressApplication } from '@nestjs/platform-express'
import { apiErrorResponseSchema } from '@kus/shared'
import type { Response } from 'supertest'
import { afterAll, afterEach, describe, expect, it, vi } from 'vitest'

import { createCompletion, createFakeAiClient, logFoodCall } from '../src/modules/ai/ai.test-utils'
import { CLEANUP_BATCH_SIZE } from '../src/modules/photos/photos.constants'
import { PhotosRepository } from '../src/modules/photos/photos.repository'
import { PhotosCleanupService } from '../src/modules/photos/photos-cleanup.service'
import { STORAGE_ADAPTER } from '../src/modules/storage/storage.constants'
import type { StorageAdapter } from '../src/modules/storage/storage.types'
import type { PrismaService } from '../src/prisma'
import {
	createFullJpeg,
	MESSAGES_URL,
	PHOTOS_URL,
	registerUser,
	type TestUser,
	uploadPhoto,
} from './chat-photo-test-utils'
import { createCapturingLogger, createDbTestApp } from './create-db-test-app'

const KEY_PREFIX = 'e2e-cleanup'
const TTL_HOURS = 24
const MS_PER_HOUR = 3_600_000
const RACE_ITERATIONS = 16
const RACE_STAGGER_MS = 3
const STORAGE_SECRET = 'bucket kus-secret-bucket at https://cleanup.r2.example denied'

const fake = createFakeAiClient()

const sleep = (ms: number): Promise<void> =>
	new Promise((resolve) => {
		setTimeout(resolve, ms)
	})

const fixedId = (n: number): string => `0192a000-0000-7000-8000-${String(n).padStart(12, '0')}`

describe('orphan photo cleanup (e2e, real DB, memory storage)', () => {
	let app: NestExpressApplication
	let prisma: PrismaService
	let storage: StorageAdapter
	let cleanup: PhotosCleanupService
	let repository: PhotosRepository
	let logger: ReturnType<typeof createCapturingLogger>
	const logSpies = [
		vi.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined),
		vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined),
		vi.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined),
	]

	const start = async (): Promise<void> => {
		fake.reset()
		logger = createCapturingLogger()
		;({ app, prisma } = await createDbTestApp({
			aiClient: fake.client,
			env: { STORAGE_KEY_PREFIX: KEY_PREFIX, PHOTO_ORPHAN_TTL_HOURS: String(TTL_HOURS) },
			logger,
		}))
		storage = app.get<StorageAdapter>(STORAGE_ADAPTER)
		cleanup = app.get(PhotosCleanupService)
		repository = app.get(PhotosRepository)
	}

	const hoursAgo = (hours: number): Date => new Date(Date.now() - hours * MS_PER_HOUR)

	/** Moves the upload into the past, as if it was made `hours` ago. */
	const age = (id: string, hours: number): Promise<unknown> =>
		prisma.storedFile.update({ where: { id }, data: { createdAt: hoursAgo(hours) } })

	const getRow = (id: string) => prisma.storedFile.findUniqueOrThrow({ where: { id } })

	const countObjects = async (id: string): Promise<number> => {
		const row = await getRow(id)
		const found = await Promise.all([
			storage.getObject(row.storageKey),
			storage.getObject(row.thumbKey),
		])
		return found.filter((object) => object !== null).length
	}

	const upload = async (owner: TestUser, variant: number, ageHours?: number): Promise<string> => {
		const id = await uploadPhoto(owner, createFullJpeg(variant))
		if (ageHours !== undefined) await age(id, ageHours)
		return id
	}

	/** A row without storage objects, for repository-level checks with a chosen id and age. */
	const seedRow = (userId: string, n: number, createdAt: Date) =>
		prisma.storedFile.create({
			data: {
				id: fixedId(n),
				userId,
				kind: 'MESSAGE_PHOTO',
				storageKey: `${KEY_PREFIX}/users/${userId}/photos/${fixedId(n)}`,
				thumbKey: `${KEY_PREFIX}/users/${userId}/photos/${fixedId(n)}-thumb`,
				mimeType: 'image/jpeg',
				width: 10,
				height: 10,
				sizeBytes: 1,
				thumbSizeBytes: 1,
				createdAt,
			},
		})

	const getErrorCode = (response: Response): string =>
		apiErrorResponseSchema.parse(response.body).errorCode

	afterEach(async () => {
		vi.restoreAllMocks()
		for (const spy of logSpies) spy.mockImplementation(() => undefined)
		await app.close()
	})

	afterAll(() => {
		for (const spy of logSpies) spy.mockRestore()
	})

	describe('PhotosRepository.findOrphans on the real DB', () => {
		it('returns only unattached, older-than rows by id asc, with limit and keyset cursor', async () => {
			await start()
			const owner = await registerUser(app, 'owner@kus.app')
			const other = await registerUser(app, 'other@kus.app')
			await seedRow(owner.userId, 5, hoursAgo(30))
			await seedRow(other.userId, 2, hoursAgo(30))
			await seedRow(owner.userId, 9, hoursAgo(30))
			await seedRow(owner.userId, 1, hoursAgo(1)) // too fresh
			const attached = await seedRow(owner.userId, 3, hoursAgo(30))
			const message = await prisma.message.create({
				data: { userId: owner.userId, role: 'USER', status: 'COMPLETED', content: null },
			})
			await prisma.messageAttachment.create({
				data: {
					messageId: message.id,
					mimeType: 'image/jpeg',
					width: 10,
					height: 10,
					sizeBytes: 1,
					status: 'PROCESSED',
					fileId: attached.id,
				},
			})
			const olderThan = hoursAgo(TTL_HOURS)

			const all = await repository.findOrphans({ olderThan, limit: 50 })

			expect(all).toEqual([
				{ id: fixedId(2), userId: other.userId },
				{ id: fixedId(5), userId: owner.userId },
				{ id: fixedId(9), userId: owner.userId },
			])
			expect(await repository.findOrphans({ olderThan, limit: 2 })).toEqual(all.slice(0, 2))
			expect(await repository.findOrphans({ olderThan, limit: 2, afterId: fixedId(2) })).toEqual(
				all.slice(1),
			)
			expect(await repository.findOrphans({ olderThan, limit: 2, afterId: fixedId(9) })).toEqual([])
		})

		it('uses a strict "older than": a row created exactly at the cutoff is not an orphan yet', async () => {
			await start()
			const owner = await registerUser(app, 'owner@kus.app')
			const cutoff = hoursAgo(TTL_HOURS)
			await seedRow(owner.userId, 1, cutoff)

			expect(await repository.findOrphans({ olderThan: cutoff, limit: 10 })).toEqual([])
			expect(
				await repository.findOrphans({ olderThan: new Date(cutoff.getTime() + 1), limit: 10 }),
			).toHaveLength(1)
		})

		it('returns nothing on an empty table', async () => {
			await start()

			expect(await repository.findOrphans({ olderThan: new Date(), limit: 10 })).toEqual([])
		})
	})

	describe('cleanupOrphans', () => {
		it('deletes an old unattached upload: both objects gone, row gone', async () => {
			await start()
			const owner = await registerUser(app, 'owner@kus.app')
			const id = await upload(owner, 1, TTL_HOURS + 1)
			const row = await getRow(id)
			expect(await countObjects(id)).toBe(2)

			const result = await cleanup.cleanupOrphans(new Date())

			expect(result).toEqual({ removed: 1, skipped: 0 })
			expect(await prisma.storedFile.count({ where: { id } })).toBe(0)
			expect(await storage.getObject(row.storageKey)).toBeNull()
			expect(await storage.getObject(row.thumbKey)).toBeNull()
			await owner.agent.get(`${PHOTOS_URL}/${id}`).expect(404)
		})

		it('keeps a fresh upload, younger than the TTL', async () => {
			await start()
			const owner = await registerUser(app, 'owner@kus.app')
			const fresh = await upload(owner, 1)
			const almost = await upload(owner, 2, TTL_HOURS - 1)

			const result = await cleanup.cleanupOrphans(new Date())

			expect(result).toEqual({ removed: 0, skipped: 0 })
			expect(await countObjects(fresh)).toBe(2)
			expect(await countObjects(almost)).toBe(2)
			await owner.agent.get(`${PHOTOS_URL}/${fresh}`).expect(200)
		})

		it('removes the file once the clock passes the TTL, by the now it is given', async () => {
			await start()
			const owner = await registerUser(app, 'owner@kus.app')
			const id = await upload(owner, 1)

			expect(await cleanup.cleanupOrphans(new Date())).toEqual({ removed: 0, skipped: 0 })
			const later = new Date(Date.now() + (TTL_HOURS + 1) * MS_PER_HOUR)
			expect(await cleanup.cleanupOrphans(later)).toEqual({ removed: 1, skipped: 0 })

			expect(await prisma.storedFile.count({ where: { id } })).toBe(0)
		})

		it('keeps an old photo that a message uses: row, attachment and bytes', async () => {
			await start()
			const owner = await registerUser(app, 'owner@kus.app')
			const id = await upload(owner, 1)
			fake.respond(createCompletion([logFoodCall()]))
			await owner.agent
				.post(MESSAGES_URL)
				.send({ clientMessageId: randomUUID(), photoIds: [id] })
				.expect(201)
			await age(id, TTL_HOURS * 10)

			const result = await cleanup.cleanupOrphans(new Date())

			expect(result).toEqual({ removed: 0, skipped: 0 })
			expect(await countObjects(id)).toBe(2)
			expect(await prisma.messageAttachment.count({ where: { fileId: id } })).toBe(1)
			await owner.agent.get(`${PHOTOS_URL}/${id}`).expect(200)
		})

		it('treats users separately: the orphan of A goes, the fresh upload and the attached photo of B stay', async () => {
			await start()
			const a = await registerUser(app, 'a@kus.app')
			const b = await registerUser(app, 'b@kus.app')
			const orphanA = await upload(a, 1, TTL_HOURS + 5)
			const freshB = await upload(b, 2)
			const attachedB = await upload(b, 3)
			fake.respond(createCompletion([logFoodCall()]))
			await b.agent
				.post(MESSAGES_URL)
				.send({ clientMessageId: randomUUID(), photoIds: [attachedB] })
				.expect(201)
			await age(attachedB, TTL_HOURS + 5)

			const result = await cleanup.cleanupOrphans(new Date())

			expect(result).toEqual({ removed: 1, skipped: 0 })
			expect(await prisma.storedFile.count({ where: { id: orphanA } })).toBe(0)
			expect(await countObjects(freshB)).toBe(2)
			expect(await countObjects(attachedB)).toBe(2)
			expect(await prisma.storedFile.count({ where: { userId: a.userId } })).toBe(0)
			expect(await prisma.storedFile.count({ where: { userId: b.userId } })).toBe(2)
		})

		it('a storage failure on the middle of three keeps only that file; the next run, after recovery, removes it', async () => {
			await start()
			const owner = await registerUser(app, 'owner@kus.app')
			const ids = [
				await upload(owner, 1, TTL_HOURS + 1),
				await upload(owner, 2, TTL_HOURS + 1),
				await upload(owner, 3, TTL_HOURS + 1),
			].sort()
			const [first, middle, last] = ids as [string, string, string]
			const middleRow = await getRow(middle)
			const original = storage.deleteObject.bind(storage)
			const failing = vi
				.spyOn(storage, 'deleteObject')
				.mockImplementation((key) =>
					key === middleRow.storageKey ? Promise.reject(new Error(STORAGE_SECRET)) : original(key),
				)

			const result = await cleanup.cleanupOrphans(new Date())

			expect(result).toEqual({ removed: 2, skipped: 1 })
			expect(await prisma.storedFile.count({ where: { id: first } })).toBe(0)
			expect(await prisma.storedFile.count({ where: { id: last } })).toBe(0)
			// the failed file is intact: row and bytes, still readable
			expect(await prisma.storedFile.count({ where: { id: middle } })).toBe(1)
			expect(await countObjects(middle)).toBe(2)
			await owner.agent.get(`${PHOTOS_URL}/${middle}`).expect(200)
			// the route table also contains /users/, so only the photo and storage lines are checked
			const logged = logger.lines.filter((line) => /Photos|Storage/.test(line)).join('\n')
			expect(logged).toContain('Orphan photo cleanup skipped')
			expect(logged).not.toContain('kus-secret-bucket')
			expect(logged).not.toContain('r2.example')
			expect(logged).not.toContain(KEY_PREFIX)
			expect(logged).not.toContain('/users/')

			failing.mockRestore()
			expect(await cleanup.cleanupOrphans(new Date())).toEqual({ removed: 1, skipped: 0 })
			expect(await prisma.storedFile.count({ where: { id: middle } })).toBe(0)
			expect(await storage.getObject(middleRow.storageKey)).toBeNull()
			expect(await storage.getObject(middleRow.thumbKey)).toBeNull()
		})

		it('a failure on the thumbnail only rolls the row back, and the next run removes both objects', async () => {
			await start()
			const owner = await registerUser(app, 'owner@kus.app')
			const id = await upload(owner, 1, TTL_HOURS + 1)
			const row = await getRow(id)
			const original = storage.deleteObject.bind(storage)
			const failing = vi
				.spyOn(storage, 'deleteObject')
				.mockImplementation((key) =>
					key === row.thumbKey ? Promise.reject(new Error('thumb down')) : original(key),
				)

			expect(await cleanup.cleanupOrphans(new Date())).toEqual({ removed: 0, skipped: 1 })
			expect(await prisma.storedFile.count({ where: { id } })).toBe(1)

			failing.mockRestore()
			expect(await cleanup.cleanupOrphans(new Date())).toEqual({ removed: 1, skipped: 0 })
			expect(await storage.getObject(row.storageKey)).toBeNull()
			expect(await storage.getObject(row.thumbKey)).toBeNull()
		})

		it('stops after five failures in a row during a storage outage, and the rest wait for the next run', async () => {
			await start()
			const owner = await registerUser(app, 'owner@kus.app')
			const ids: string[] = []
			for (let index = 0; index < 8; index += 1) ids.push(await upload(owner, index, TTL_HOURS + 1))
			const down = vi.spyOn(storage, 'deleteObject').mockRejectedValue(new Error('outage'))

			const result = await cleanup.cleanupOrphans(new Date())

			expect(result).toEqual({ removed: 0, skipped: 5 })
			expect(down).toHaveBeenCalledTimes(5)
			expect(await prisma.storedFile.count()).toBe(8)

			down.mockRestore()
			expect(await cleanup.cleanupOrphans(new Date())).toEqual({ removed: 8, skipped: 0 })
			expect(await prisma.storedFile.count()).toBe(0)
		})

		it('walks past one batch of orphans and removes them all', async () => {
			await start()
			const owner = await registerUser(app, 'owner@kus.app')
			const total = CLEANUP_BATCH_SIZE + 3
			for (let index = 1; index <= total; index += 1) {
				await seedRow(owner.userId, index, hoursAgo(TTL_HOURS + 1))
			}

			const result = await cleanup.cleanupOrphans(new Date())

			expect(result).toEqual({ removed: total, skipped: 0 })
			expect(await prisma.storedFile.count()).toBe(0)
		})

		it('does not loop forever over a file that keeps failing in a batch larger than one page', async () => {
			await start()
			const owner = await registerUser(app, 'owner@kus.app')
			const total = CLEANUP_BATCH_SIZE + 3
			for (let index = 1; index <= total; index += 1) {
				await seedRow(owner.userId, index, hoursAgo(TTL_HOURS + 1))
			}
			// the last file of the first page cannot be deleted
			const stuck = await prisma.storedFile.findUniqueOrThrow({
				where: { id: fixedId(CLEANUP_BATCH_SIZE) },
			})
			const original = storage.deleteObject.bind(storage)
			vi.spyOn(storage, 'deleteObject').mockImplementation((key) =>
				key === stuck.storageKey ? Promise.reject(new Error('stuck')) : original(key),
			)

			const result = await cleanup.cleanupOrphans(new Date())

			expect(result).toEqual({ removed: total - 1, skipped: 1 })
			expect(await prisma.storedFile.count()).toBe(1)
		})
	})

	describe('cleanup racing a message for the same old orphan', () => {
		it('ends every round with either a deleted photo and a 404, or a bound photo with its bytes; never a 5xx', async () => {
			await start()
			const owner = await registerUser(app, 'owner@kus.app')
			fake.respond(
				...Array.from({ length: RACE_ITERATIONS }, () => createCompletion([logFoodCall()])),
			)
			const outcomes = { deleted: 0, bound: 0 }

			for (let index = 0; index < RACE_ITERATIONS; index += 1) {
				const id = await upload(owner, index, TTL_HOURS + 1)
				const row = await getRow(id)
				const clientMessageId = randomUUID()
				// the head start moves from one side to the other, so both orders get exercised
				const isCleanupFirst = index % 2 === 0
				const lag = index * RACE_STAGGER_MS

				const [result, posted] = await Promise.all([
					sleep(isCleanupFirst ? 0 : lag).then(() => cleanup.cleanupOrphans(new Date())),
					sleep(isCleanupFirst ? lag : 0).then(() =>
						owner.agent.post(MESSAGES_URL).send({ clientMessageId, photoIds: [id] }),
					),
				])

				const context = `round ${index}: removed ${result.removed}, POST ${posted.status}`
				expect(posted.status, context).toBeLessThan(500)
				expect(result.skipped, context).toBe(0)
				const attachments = await prisma.messageAttachment.count({ where: { fileId: id } })
				const rowExists = (await prisma.storedFile.count({ where: { id } })) === 1

				if (!rowExists) {
					outcomes.deleted += 1
					expect(result.removed, context).toBe(1)
					expect(posted.status, context).toBe(404)
					expect(getErrorCode(posted), context).toBe('PHOTO_NOT_FOUND')
					expect(attachments, context).toBe(0)
					expect(await storage.getObject(row.storageKey), context).toBeNull()
					expect(await storage.getObject(row.thumbKey), context).toBeNull()
					continue
				}
				outcomes.bound += 1
				expect(result.removed, context).toBe(0)
				expect(posted.status, context).toBe(201)
				expect(attachments, context).toBe(1)
				expect(await storage.getObject(row.storageKey), context).not.toBeNull()
				expect(await storage.getObject(row.thumbKey), context).not.toBeNull()
				expect((await owner.agent.get(`${PHOTOS_URL}/${id}`)).status, context).toBe(200)
			}

			expect(outcomes.deleted + outcomes.bound).toBe(RACE_ITERATIONS)
			// whatever the order of events, no attachment points at a photo whose bytes are gone
			const bound = await prisma.messageAttachment.findMany({
				where: { fileId: { not: null } },
				select: { fileId: true },
			})
			for (const { fileId } of bound) {
				expect(await countObjects(fileId ?? ''), `file ${fileId}`).toBe(2)
			}
		})
	})
})
