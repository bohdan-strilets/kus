import { randomUUID } from 'node:crypto'

import type { NestExpressApplication } from '@nestjs/platform-express'
import { apiErrorResponseSchema } from '@kus/shared'
import type { Response } from 'supertest'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

import { createCompletion, createFakeAiClient, logFoodCall } from '../src/modules/ai/ai.test-utils'
import type { PrismaService } from '../src/prisma'
import { STORAGE_ADAPTER } from '../src/modules/storage/storage.constants'
import type { StorageAdapter } from '../src/modules/storage/storage.types'
import {
	createFullJpeg,
	MESSAGES_URL,
	PHOTOS_URL,
	registerUser,
	type TestUser,
	uploadPhoto,
} from './chat-photo-test-utils'
import { createCapturingLogger, createDbTestApp } from './create-db-test-app'
import { toBase64 } from './fixtures/jpeg'

const KEY_PREFIX = 'e2e-secret-prefix'
const BUCKET = 'kus-secret-bucket'
const BASE64_RUN_MIN_LENGTH = 200
const BASE64_RUN = new RegExp(`[A-Za-z0-9+/=]{${BASE64_RUN_MIN_LENGTH},}`)
const BASE64_SAMPLE_FROM = 10
const BASE64_SAMPLE_TO = 50

const fake = createFakeAiClient()
const logger = createCapturingLogger()

describe('stored photos never reach the logs or the error bodies (e2e)', () => {
	let app: NestExpressApplication
	let prisma: PrismaService
	let storage: StorageAdapter
	let owner: TestUser
	let stranger: TestUser

	beforeAll(async () => {
		;({ app, prisma } = await createDbTestApp({
			aiClient: fake.client,
			logger,
			env: { STORAGE_KEY_PREFIX: KEY_PREFIX },
		}))
		storage = app.get<StorageAdapter>(STORAGE_ADAPTER)
		owner = await registerUser(app, 'owner@kus.app')
		stranger = await registerUser(app, 'stranger@kus.app')
	})

	beforeEach(() => {
		fake.reset()
		logger.lines.length = 0
	})

	afterEach(() => {
		vi.restoreAllMocks()
	})

	afterAll(async () => {
		await app.close()
	})

	const send = (sender: TestUser, photoIds: string[], clientMessageId: string = randomUUID()) =>
		sender.agent.post(MESSAGES_URL).send({ clientMessageId, photoIds })

	/** Neither the bytes, nor the object keys, nor the storage's own error text may show up. */
	const expectClean = async (response: Response, ids: string[], jpeg: Buffer): Promise<void> => {
		const texts = [response.text, logger.lines.join('\n')]
		const keys = [KEY_PREFIX, `users/${owner.userId}`, `users/${stranger.userId}`, BUCKET]
		for (const id of ids) {
			const row = await prisma.storedFile.findUnique({ where: { id } })
			if (row) keys.push(row.storageKey, row.thumbKey)
		}
		const base64 = toBase64(jpeg)
		for (const text of texts) {
			for (const key of keys) expect(text).not.toContain(key)
			expect(text).not.toContain(base64.slice(BASE64_SAMPLE_FROM, BASE64_SAMPLE_TO))
			expect(text).not.toContain('base64,')
			expect(text).not.toMatch(BASE64_RUN)
		}
	}

	const getCode = (response: Response): string =>
		apiErrorResponseSchema.parse(response.body).errorCode

	it('404 for another user photo', async () => {
		const jpeg = createFullJpeg(1)
		const id = await uploadPhoto(owner, jpeg)

		const response = await send(stranger, [id]).expect(404)

		expect(getCode(response)).toBe('PHOTO_NOT_FOUND')
		expect(response.body).toEqual({ statusCode: 404, errorCode: 'PHOTO_NOT_FOUND', details: {} })
		await expectClean(response, [id], jpeg)
	})

	it('404 when the object is gone from the storage', async () => {
		const jpeg = createFullJpeg(2)
		const id = await uploadPhoto(owner, jpeg)
		const row = await prisma.storedFile.findUniqueOrThrow({ where: { id } })
		await storage.deleteObject(row.storageKey)

		const response = await send(owner, [id]).expect(404)

		expect(getCode(response)).toBe('PHOTO_NOT_FOUND')
		await expectClean(response, [id], jpeg)
	})

	it('409 PHOTO_IN_USE for a second message with the same photo', async () => {
		const jpeg = createFullJpeg(3)
		const id = await uploadPhoto(owner, jpeg)
		fake.respond(createCompletion([logFoodCall()]))
		await send(owner, [id]).expect(201)

		const response = await send(owner, [id]).expect(409)

		expect(response.body).toEqual({ statusCode: 409, errorCode: 'PHOTO_IN_USE', details: {} })
		await expectClean(response, [id], jpeg)
	})

	it('409 PHOTO_IN_USE for a delete of a photo a message uses', async () => {
		const jpeg = createFullJpeg(4)
		const id = await uploadPhoto(owner, jpeg)
		fake.respond(createCompletion([logFoodCall()]))
		await send(owner, [id]).expect(201)

		const response = await owner.agent.delete(`${PHOTOS_URL}/${id}`).expect(409)

		expect(response.body).toEqual({ statusCode: 409, errorCode: 'PHOTO_IN_USE', details: {} })
		await expectClean(response, [id], jpeg)
	})

	it('503 when the storage fails on read, with the storage error text kept out', async () => {
		const jpeg = createFullJpeg(5)
		const id = await uploadPhoto(owner, jpeg)
		const row = await prisma.storedFile.findUniqueOrThrow({ where: { id } })
		vi.spyOn(storage, 'getObject').mockRejectedValue(
			new Error(`S3 ${BUCKET} cannot read ${row.storageKey} ${toBase64(jpeg)}`),
		)

		const response = await send(owner, [id]).expect(503)

		expect(response.body).toEqual({
			statusCode: 503,
			errorCode: 'STORAGE_UNAVAILABLE',
			details: {},
		})
		expect(logger.lines.some((line) => line.startsWith('error:'))).toBe(true)
		await expectClean(response, [id], jpeg)
	})

	it('503 when the storage fails on delete, with the storage error text kept out', async () => {
		const jpeg = createFullJpeg(6)
		const id = await uploadPhoto(owner, jpeg)
		const row = await prisma.storedFile.findUniqueOrThrow({ where: { id } })
		vi.spyOn(storage, 'deleteObject').mockRejectedValue(
			new Error(`S3 ${BUCKET} cannot delete ${row.thumbKey}`),
		)

		const response = await owner.agent.delete(`${PHOTOS_URL}/${id}`).expect(503)

		expect(getCode(response)).toBe('STORAGE_UNAVAILABLE')
		expect(logger.lines.some((line) => line.startsWith('error:'))).toBe(true)
		await expectClean(response, [id], jpeg)
	})

	it('422 for a second photo and for the same photo twice', async () => {
		const jpeg = createFullJpeg(7)
		const id = await uploadPhoto(owner, jpeg)
		const other = await uploadPhoto(owner, createFullJpeg(8))

		const tooMany = await send(owner, [id, other]).expect(422)
		const duplicate = await send(owner, [id, id]).expect(422)

		await expectClean(tooMany, [id, other], jpeg)
		await expectClean(duplicate, [id, other], jpeg)
	})
})
