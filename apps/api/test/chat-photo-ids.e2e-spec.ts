import { randomUUID } from 'node:crypto'

import { Logger } from '@nestjs/common'
import type { NestExpressApplication } from '@nestjs/platform-express'
import {
	apiErrorResponseSchema,
	chatMessageSchema,
	createCursorPaginatedResponseSchema,
	createDataResponseSchema,
	sendMessageResponseSchema,
} from '@kus/shared'
import type { Response } from 'supertest'
import { afterAll, afterEach, describe, expect, it, vi } from 'vitest'

import { createCompletion, createFakeAiClient, logFoodCall } from '../src/modules/ai/ai.test-utils'
import type { PrismaService } from '../src/prisma'
import { STORAGE_ADAPTER } from '../src/modules/storage/storage.constants'
import type { StorageAdapter } from '../src/modules/storage/storage.types'
import {
	createFullJpeg,
	FULL_HEIGHT,
	FULL_WIDTH,
	getSentImageBytes,
	MESSAGES_URL,
	PHOTOS_URL,
	registerUser,
	type TestUser,
	uploadPhoto,
} from './chat-photo-test-utils'
import { createDbTestApp } from './create-db-test-app'
import { createJpeg, toBase64 } from './fixtures/jpeg'

const VISION_MODEL = 'test/vision'
const KEY_PREFIX = 'e2e'
const RACE_ITERATIONS = 16
const PARALLEL_DELETE_ITERATIONS = 6
const RACE_STAGGER_MS = 3
const sendResponseSchema = createDataResponseSchema(sendMessageResponseSchema)
const listResponseSchema = createCursorPaginatedResponseSchema(chatMessageSchema)

const fake = createFakeAiClient()

const photoUnusableCall = {
	name: 'photo_unusable',
	args: { reason: 'unreadable', reply: 'Не бачу тут їжі. Сфотографуй ще раз.' },
}

const sleep = (ms: number): Promise<void> =>
	new Promise((resolve) => {
		setTimeout(resolve, ms)
	})

const getErrorCode = (response: Response): string =>
	apiErrorResponseSchema.parse(response.body).errorCode

describe('POST /messages with photoIds (e2e, real DB, memory storage, fake model)', () => {
	let app: NestExpressApplication
	let prisma: PrismaService
	let storage: StorageAdapter
	const logSpies = [
		vi.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined),
		vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined),
		vi.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined),
	]

	const start = async (env: Record<string, string> = {}): Promise<void> => {
		fake.reset()
		;({ app, prisma } = await createDbTestApp({
			aiClient: fake.client,
			env: { AI_MODEL_VISION: VISION_MODEL, STORAGE_KEY_PREFIX: KEY_PREFIX, ...env },
		}))
		storage = app.get<StorageAdapter>(STORAGE_ADAPTER)
	}

	const user = (email = 'owner@kus.app'): Promise<TestUser> => registerUser(app, email)

	const send = (
		sender: TestUser,
		body: Record<string, unknown>,
		clientMessageId: string = randomUUID(),
	) => sender.agent.post(MESSAGES_URL).send({ clientMessageId, ...body })

	const getRow = (id: string) => prisma.storedFile.findUniqueOrThrow({ where: { id } })

	const countStoredObjects = async (id: string): Promise<number> => {
		const row = await getRow(id)
		const found = await Promise.all([
			storage.getObject(row.storageKey),
			storage.getObject(row.thumbKey),
		])
		return found.filter((object) => object !== null).length
	}

	afterEach(async () => {
		vi.restoreAllMocks()
		for (const spy of logSpies) spy.mockImplementation(() => undefined)
		await app.close()
	})

	afterAll(() => {
		for (const spy of logSpies) spy.mockRestore()
	})

	describe('the happy path', () => {
		it('gives the model the stored image, marks the entries fromPhoto and binds the file', async () => {
			await start()
			const owner = await user()
			const jpeg = createFullJpeg()
			const id = await uploadPhoto(owner, jpeg)
			fake.respond(createCompletion([logFoodCall()]))

			const response = await send(owner, { text: '150 г', photoIds: [id] }).expect(201)

			const { data } = sendResponseSchema.parse(response.body)
			expect(data.userMessage).toMatchObject({
				content: '150 г',
				status: 'COMPLETED',
				photo: { status: 'PROCESSED' },
			})
			expect(fake.bodies[0]).toMatchObject({ model: VISION_MODEL })
			expect(getSentImageBytes(fake.bodies[0]).equals(jpeg)).toBe(true)
			const entries = await prisma.foodEntry.findMany({ where: { userId: owner.userId } })
			expect(entries.length).toBeGreaterThan(0)
			expect(entries.every((entry) => entry.fromPhoto)).toBe(true)
			expect(await prisma.messageAttachment.findFirstOrThrow()).toMatchObject({
				fileId: id,
				position: 0,
				mimeType: 'image/jpeg',
				width: FULL_WIDTH,
				height: FULL_HEIGHT,
				sizeBytes: jpeg.length,
				status: 'PROCESSED',
			})
		})

		it('takes a photo without text', async () => {
			await start()
			const owner = await user()
			const id = await uploadPhoto(owner)
			fake.respond(createCompletion([logFoodCall()]))

			const response = await send(owner, { photoIds: [id] }).expect(201)

			expect(sendResponseSchema.parse(response.body).data.userMessage.content).toBeNull()
		})

		it('answers with photos[] in the POST response and in the feed, next to the old photo field', async () => {
			await start()
			const owner = await user()
			const id = await uploadPhoto(owner)
			fake.respond(createCompletion([logFoodCall()]))

			const response = await send(owner, { photoIds: [id] }).expect(201)
			const feed = listResponseSchema.parse((await owner.agent.get(MESSAGES_URL).expect(200)).body)

			const expectedPhotos = [
				{ fileId: id, width: FULL_WIDTH, height: FULL_HEIGHT, status: 'PROCESSED', position: 0 },
			]
			const { userMessage, assistantMessage } = sendResponseSchema.parse(response.body).data
			expect(userMessage.photos).toEqual(expectedPhotos)
			expect(userMessage.photo).toEqual({ status: 'PROCESSED' })
			expect(assistantMessage.photos).toEqual([])
			const fromFeed = feed.data.find((message) => message.id === userMessage.id)
			expect(fromFeed?.photos).toEqual(expectedPhotos)
			expect(fromFeed?.photo).toEqual({ status: 'PROCESSED' })
		})

		it('keeps the base64 way as it was: no file, position 0, the photo field, one entry in photos[]', async () => {
			await start()
			const owner = await user()
			fake.respond(createCompletion([logFoodCall()]), createCompletion([logFoodCall()]))

			const inline = await send(owner, {
				photo: { mimeType: 'image/jpeg', data: toBase64(createJpeg()) },
			}).expect(201)
			const textOnly = await send(owner, { text: 'банан' }).expect(201)

			const inlineMessage = sendResponseSchema.parse(inline.body).data.userMessage
			expect(inlineMessage.photo).toEqual({ status: 'PROCESSED' })
			expect(inlineMessage.photos).toEqual([
				{ fileId: null, width: 640, height: 480, status: 'PROCESSED', position: 0 },
			])
			expect(await prisma.messageAttachment.findFirstOrThrow()).toMatchObject({
				fileId: null,
				position: 0,
			})
			const textMessage = sendResponseSchema.parse(textOnly.body).data.userMessage
			expect(textMessage.photo).toBeNull()
			expect(textMessage.photos).toEqual([])
		})

		it('marks the attachment FAILED and keeps its file when the model says photo_unusable', async () => {
			await start()
			const owner = await user()
			const id = await uploadPhoto(owner)
			fake.respond(createCompletion([photoUnusableCall]))

			const response = await send(owner, { photoIds: [id] }).expect(201)

			const { data } = sendResponseSchema.parse(response.body)
			expect(data.userMessage.photo).toEqual({ status: 'FAILED' })
			expect(data.userMessage.photos).toEqual([
				{ fileId: id, width: FULL_WIDTH, height: FULL_HEIGHT, status: 'FAILED', position: 0 },
			])
			expect(await prisma.foodEntry.count()).toBe(0)
			expect((await prisma.messageAttachment.findFirstOrThrow()).status).toBe('FAILED')
		})

		it('counts one photo in the daily usage', async () => {
			await start()
			const owner = await user()
			const id = await uploadPhoto(owner)
			fake.respond(createCompletion([logFoodCall()]))

			await send(owner, { photoIds: [id] }).expect(201)

			const usage = await prisma.dailyUsage.findFirstOrThrow({ where: { userId: owner.userId } })
			expect(usage).toMatchObject({ messageCount: 1, photoCount: 1 })
		})
	})

	describe('validation', () => {
		it('answers 422 photoIds=TOO_MANY for a second photo and creates nothing', async () => {
			await start()
			const owner = await user()
			const first = await uploadPhoto(owner, createFullJpeg(1))
			const second = await uploadPhoto(owner, createFullJpeg(2))

			const response = await send(owner, { photoIds: [first, second] }).expect(422)

			expect(apiErrorResponseSchema.parse(response.body).details).toEqual({
				fields: { photoIds: 'TOO_MANY' },
			})
			expect(await prisma.message.count()).toBe(0)
			expect(fake.bodies).toHaveLength(0)
		})

		it('keeps the limit at one even when the env allows six', async () => {
			await start({ PHOTOS_PER_MESSAGE_MAX: '6' })
			const owner = await user()
			const first = await uploadPhoto(owner, createFullJpeg(1))
			const second = await uploadPhoto(owner, createFullJpeg(2))

			await send(owner, { photoIds: [first, second] }).expect(422)
		})

		it('answers 422 DUPLICATE_PHOTO_IDS for the same id twice', async () => {
			await start()
			const owner = await user()
			const id = await uploadPhoto(owner)

			const response = await send(owner, { photoIds: [id, id] }).expect(422)

			expect(apiErrorResponseSchema.parse(response.body).details).toEqual({
				fields: { photoIds: 'DUPLICATE_PHOTO_IDS' },
			})
			expect(await prisma.message.count()).toBe(0)
		})

		it('answers 422 for photo and photoIds together', async () => {
			await start()
			const owner = await user()
			const id = await uploadPhoto(owner)

			const response = await send(owner, {
				photo: { mimeType: 'image/jpeg', data: toBase64(createJpeg()) },
				photoIds: [id],
			}).expect(422)

			expect(apiErrorResponseSchema.parse(response.body).details).toEqual({
				fields: { photoIds: 'PHOTO_AND_PHOTO_IDS_EXCLUSIVE' },
			})
			expect(await prisma.message.count()).toBe(0)
			expect(fake.bodies).toHaveLength(0)
		})

		it.each([
			['an empty list', []],
			['an id that is not a uuid', ['nope']],
		])('answers 422 for %s', async (_name, photoIds) => {
			await start()
			const owner = await user()

			await send(owner, { text: 'банан', photoIds }).expect(422)

			expect(await prisma.message.count()).toBe(0)
		})
	})

	describe('whose photo it is', () => {
		it('answers 404 PHOTO_NOT_FOUND for another user photo and for an unknown id alike, and creates no message', async () => {
			await start()
			const owner = await user('owner@kus.app')
			const stranger = await user('stranger@kus.app')
			const id = await uploadPhoto(owner)

			const foreign = await send(stranger, { photoIds: [id] }).expect(404)
			const unknown = await send(stranger, { photoIds: [randomUUID()] }).expect(404)

			expect(getErrorCode(foreign)).toBe('PHOTO_NOT_FOUND')
			expect(foreign.body).toEqual(unknown.body)
			expect(await prisma.message.count()).toBe(0)
			expect(await prisma.messageAttachment.count()).toBe(0)
			expect(fake.bodies).toHaveLength(0)
			expect(await prisma.dailyUsage.count()).toBe(0)
		})

		it('leaves the photo free for its owner after a stranger tried it', async () => {
			await start()
			const owner = await user('owner@kus.app')
			const stranger = await user('stranger@kus.app')
			const id = await uploadPhoto(owner)
			await send(stranger, { photoIds: [id] }).expect(404)
			fake.respond(createCompletion([logFoodCall()]))

			await send(owner, { photoIds: [id] }).expect(201)
		})

		it('answers 404 and creates no message when one of the ids is missing', async () => {
			await start({ PHOTOS_PER_MESSAGE_MAX: '1' })
			const owner = await user()

			const response = await send(owner, { text: 'x', photoIds: [randomUUID()] }).expect(404)

			expect(getErrorCode(response)).toBe('PHOTO_NOT_FOUND')
			expect(await prisma.message.count()).toBe(0)
		})
	})

	describe('one photo, one message', () => {
		it('answers 409 PHOTO_IN_USE when a second message takes the same photo', async () => {
			await start()
			const owner = await user()
			const id = await uploadPhoto(owner)
			fake.respond(createCompletion([logFoodCall()]))
			await send(owner, { photoIds: [id] }).expect(201)

			const second = await send(owner, { photoIds: [id] }).expect(409)

			expect(getErrorCode(second)).toBe('PHOTO_IN_USE')
			expect(await prisma.message.count({ where: { role: 'USER' } })).toBe(1)
			expect(await prisma.messageAttachment.count()).toBe(1)
			expect(fake.bodies).toHaveLength(1)
			const usage = await prisma.dailyUsage.findFirstOrThrow({ where: { userId: owner.userId } })
			expect(usage).toMatchObject({ messageCount: 1, photoCount: 1 })
		})

		it('lets exactly one of two parallel messages with different clientMessageIds take the photo', async () => {
			await start()
			const owner = await user()
			const id = await uploadPhoto(owner)
			fake.respond(createCompletion([logFoodCall()]), createCompletion([logFoodCall()]))

			const responses = await Promise.all([
				send(owner, { photoIds: [id] }),
				send(owner, { photoIds: [id] }),
			])

			const statuses = responses.map((response) => response.status).sort()
			expect(statuses).toEqual([201, 409])
			const loser = responses.find((response) => response.status === 409)
			expect(['PHOTO_IN_USE', 'MESSAGE_IN_PROGRESS']).toContain(getErrorCode(loser as Response))
			expect(await prisma.messageAttachment.count({ where: { fileId: id } })).toBe(1)
			expect(await prisma.message.count({ where: { role: 'USER' } })).toBe(1)
			expect(fake.bodies).toHaveLength(1)
		})

		it('answers a parallel twin with the same clientMessageId and photo without a second attachment', async () => {
			await start()
			const owner = await user()
			const id = await uploadPhoto(owner)
			const clientMessageId = randomUUID()
			fake.respond(createCompletion([logFoodCall()]), createCompletion([logFoodCall()]))

			const responses = await Promise.all([
				send(owner, { photoIds: [id] }, clientMessageId),
				send(owner, { photoIds: [id] }, clientMessageId),
			])

			for (const response of responses) expect(response.status).toBeLessThan(500)
			expect(responses.some((response) => response.status === 201)).toBe(true)
			expect(await prisma.messageAttachment.count({ where: { fileId: id } })).toBe(1)
			expect(await prisma.message.count({ where: { role: 'USER' } })).toBe(1)
		})
	})

	describe('storage', () => {
		it('answers 503 STORAGE_UNAVAILABLE and creates no message when the storage fails on read', async () => {
			await start()
			const owner = await user()
			const id = await uploadPhoto(owner)
			const failing = vi.spyOn(storage, 'getObject').mockRejectedValue(new Error('bucket down'))

			const response = await send(owner, { photoIds: [id] }).expect(503)

			expect(getErrorCode(response)).toBe('STORAGE_UNAVAILABLE')
			expect(await prisma.message.count()).toBe(0)
			expect(await prisma.messageAttachment.count()).toBe(0)
			expect(await prisma.dailyUsage.count()).toBe(0)
			expect(fake.bodies).toHaveLength(0)

			// nothing is left to resend around: the same photo works once the storage is back
			failing.mockRestore()
			fake.respond(createCompletion([logFoodCall()]))
			await send(owner, { photoIds: [id] }).expect(201)
		})

		it('answers 404 and creates no message when the object is gone from the storage', async () => {
			await start()
			const owner = await user()
			const id = await uploadPhoto(owner)
			const row = await getRow(id)
			await storage.deleteObject(row.storageKey)

			const response = await send(owner, { photoIds: [id] }).expect(404)

			expect(getErrorCode(response)).toBe('PHOTO_NOT_FOUND')
			expect(await prisma.message.count()).toBe(0)
			expect(await prisma.messageAttachment.count()).toBe(0)
			expect(fake.bodies).toHaveLength(0)
		})
	})

	describe('replay and retry', () => {
		it('returns a completed message again for the same photoIds without calling the model', async () => {
			await start()
			const owner = await user()
			const id = await uploadPhoto(owner)
			const clientMessageId = randomUUID()
			fake.respond(createCompletion([logFoodCall()]))

			const first = await send(owner, { photoIds: [id] }, clientMessageId).expect(201)
			const second = await send(owner, { photoIds: [id] }, clientMessageId).expect(201)

			const firstData = sendResponseSchema.parse(first.body).data
			const secondData = sendResponseSchema.parse(second.body).data
			expect(secondData.userMessage.id).toBe(firstData.userMessage.id)
			expect(secondData.assistantMessage.id).toBe(firstData.assistantMessage.id)
			expect(secondData.userMessage.photos).toEqual(firstData.userMessage.photos)
			expect(fake.bodies).toHaveLength(1)
			expect(await prisma.messageAttachment.count()).toBe(1)
			const usage = await prisma.dailyUsage.findFirstOrThrow({ where: { userId: owner.userId } })
			expect(usage).toMatchObject({ messageCount: 1, photoCount: 1 })
		})

		it('retries a FAILED message with the same photoIds: no 409, the file is read again, the attachment goes PENDING then PROCESSED', async () => {
			await start()
			const owner = await user()
			const jpeg = createFullJpeg()
			const id = await uploadPhoto(owner, jpeg)
			const clientMessageId = randomUUID()
			fake.respond(new Error('network down'), createCompletion([logFoodCall()]))

			await send(owner, { photoIds: [id] }, clientMessageId).expect(503)

			expect(await prisma.message.findFirstOrThrow({ where: { role: 'USER' } })).toMatchObject({
				status: 'FAILED',
			})
			expect(await prisma.messageAttachment.findFirstOrThrow()).toMatchObject({
				fileId: id,
				status: 'PENDING',
			})

			const retry = await send(owner, { photoIds: [id] }, clientMessageId).expect(201)

			const { userMessage } = sendResponseSchema.parse(retry.body).data
			expect(userMessage.photos).toEqual([
				{ fileId: id, width: FULL_WIDTH, height: FULL_HEIGHT, status: 'PROCESSED', position: 0 },
			])
			expect(await prisma.messageAttachment.count()).toBe(1)
			expect(fake.bodies).toHaveLength(2)
			expect(getSentImageBytes(fake.bodies[1]).equals(jpeg)).toBe(true)
		})

		it('does not claim a FAILED message for a retry whose photo bytes are gone', async () => {
			await start()
			const owner = await user()
			const id = await uploadPhoto(owner)
			const clientMessageId = randomUUID()
			fake.respond(new Error('network down'))
			await send(owner, { photoIds: [id] }, clientMessageId).expect(503)
			await storage.deleteObject((await getRow(id)).storageKey)

			const retry = await send(owner, { photoIds: [id] }, clientMessageId).expect(404)

			expect(getErrorCode(retry)).toBe('PHOTO_NOT_FOUND')
			const message = await prisma.message.findFirstOrThrow({ where: { role: 'USER' } })
			expect(message.status).toBe('FAILED')
			expect(fake.bodies).toHaveLength(1)
		})

		it('answers 503 and keeps a FAILED message FAILED when the storage fails on a retry', async () => {
			await start()
			const owner = await user()
			const id = await uploadPhoto(owner)
			const clientMessageId = randomUUID()
			fake.respond(new Error('network down'), createCompletion([logFoodCall()]))
			await send(owner, { photoIds: [id] }, clientMessageId).expect(503)
			const failing = vi.spyOn(storage, 'getObject').mockRejectedValue(new Error('bucket down'))

			const retry = await send(owner, { photoIds: [id] }, clientMessageId).expect(503)

			expect(getErrorCode(retry)).toBe('STORAGE_UNAVAILABLE')
			expect((await prisma.message.findFirstOrThrow({ where: { role: 'USER' } })).status).toBe(
				'FAILED',
			)
			failing.mockRestore()
			await send(owner, { photoIds: [id] }, clientMessageId).expect(201)
		})

		it('refuses the same clientMessageId with another photo', async () => {
			await start()
			const owner = await user()
			const first = await uploadPhoto(owner, createFullJpeg(1))
			const second = await uploadPhoto(owner, createFullJpeg(2))
			const clientMessageId = randomUUID()
			fake.respond(createCompletion([logFoodCall()]))
			await send(owner, { photoIds: [first] }, clientMessageId).expect(201)

			const response = await send(owner, { photoIds: [second] }, clientMessageId).expect(409)

			expect(getErrorCode(response)).toBe('CLIENT_MESSAGE_ID_REUSED')
			expect(fake.bodies).toHaveLength(1)
			expect(await prisma.messageAttachment.count({ where: { fileId: second } })).toBe(0)
		})

		it.each([
			['a stored photo added to a text message', 'text', 'ids'],
			['an inline photo instead of a stored one', 'ids', 'inline'],
			['a stored photo dropped', 'ids', 'text'],
			['a stored photo instead of an inline one', 'inline', 'ids'],
		])('refuses the same clientMessageId with %s', async (_name, firstKind, secondKind) => {
			await start()
			const owner = await user()
			const id = await uploadPhoto(owner)
			const inline = { photo: { mimeType: 'image/jpeg', data: toBase64(createJpeg()) } }
			const bodies: Record<string, Record<string, unknown>> = {
				text: { text: 'банан' },
				ids: { text: 'банан', photoIds: [id] },
				inline: { text: 'банан', ...inline },
			}
			const clientMessageId = randomUUID()
			fake.respond(createCompletion([logFoodCall()]))
			await send(owner, bodies[firstKind] ?? {}, clientMessageId).expect(201)

			const response = await send(owner, bodies[secondKind] ?? {}, clientMessageId).expect(409)

			expect(getErrorCode(response)).toBe('CLIENT_MESSAGE_ID_REUSED')
		})
	})

	describe('limits', () => {
		it('stops stored photos at the daily photo limit like inline ones and lets texts through', async () => {
			await start({ AI_DAILY_PHOTO_LIMIT: '1' })
			const owner = await user()
			const first = await uploadPhoto(owner, createFullJpeg(1))
			const second = await uploadPhoto(owner, createFullJpeg(2))
			fake.respond(createCompletion([logFoodCall()]), createCompletion([logFoodCall()]))
			await send(owner, { photoIds: [first] }).expect(201)

			const limited = await send(owner, { photoIds: [second] }).expect(429)
			await send(owner, { text: 'банан' }).expect(201)

			expect(apiErrorResponseSchema.parse(limited.body)).toMatchObject({
				errorCode: 'DAILY_PHOTO_LIMIT_REACHED',
				details: { limit: 1 },
			})
			expect(fake.bodies).toHaveLength(2)
			expect(await prisma.message.count({ where: { status: 'FAILED' } })).toBe(1)
			const usage = await prisma.dailyUsage.findFirstOrThrow({ where: { userId: owner.userId } })
			expect(usage).toMatchObject({ messageCount: 2, photoCount: 1 })
		})

		it('reports the message limit when the messages are used up', async () => {
			await start({ AI_DAILY_MESSAGE_LIMIT: '1' })
			const owner = await user()
			const id = await uploadPhoto(owner)
			fake.respond(createCompletion([logFoodCall()]))
			await send(owner, { text: 'банан' }).expect(201)

			const response = await send(owner, { photoIds: [id] }).expect(429)

			expect(getErrorCode(response)).toBe('DAILY_LIMIT_REACHED')
		})
	})

	describe('DELETE /photos/:id next to messages', () => {
		it('answers 409 for a photo a message uses and keeps its bytes', async () => {
			await start()
			const owner = await user()
			const id = await uploadPhoto(owner)
			fake.respond(createCompletion([logFoodCall()]))
			await send(owner, { photoIds: [id] }).expect(201)

			const response = await owner.agent.delete(`${PHOTOS_URL}/${id}`).expect(409)

			expect(getErrorCode(response)).toBe('PHOTO_IN_USE')
			expect(await countStoredObjects(id)).toBe(2)
			await owner.agent.get(`${PHOTOS_URL}/${id}`).expect(200)
		})

		it('answers exactly one 204 and one 404 to two parallel deletes of a free photo and removes the objects', async () => {
			await start()
			const owner = await user()

			for (let index = 0; index < PARALLEL_DELETE_ITERATIONS; index += 1) {
				const id = await uploadPhoto(owner, createFullJpeg(index))
				const row = await getRow(id)

				const responses = await Promise.all([
					owner.agent.delete(`${PHOTOS_URL}/${id}`),
					owner.agent.delete(`${PHOTOS_URL}/${id}`),
				])

				expect(responses.map((response) => response.status).sort()).toEqual([204, 404])
				expect(await storage.getObject(row.storageKey)).toBeNull()
				expect(await storage.getObject(row.thumbKey)).toBeNull()
				expect(await prisma.storedFile.count({ where: { id } })).toBe(0)
			}
		})

		it('answers 503, keeps the row and the photo readable when the storage fails on delete, then 204 after it recovers', async () => {
			await start()
			const owner = await user()
			const id = await uploadPhoto(owner)
			const failing = vi.spyOn(storage, 'deleteObject').mockRejectedValue(new Error('bucket down'))

			const response = await owner.agent.delete(`${PHOTOS_URL}/${id}`).expect(503)

			expect(getErrorCode(response)).toBe('STORAGE_UNAVAILABLE')
			expect(await prisma.storedFile.count({ where: { id } })).toBe(1)
			await owner.agent.get(`${PHOTOS_URL}/${id}`).expect(200)

			failing.mockRestore()
			await owner.agent.delete(`${PHOTOS_URL}/${id}`).expect(204)
			expect(await prisma.storedFile.count({ where: { id } })).toBe(0)
		})

		it('rolls the row back when only the thumbnail delete fails, and a retry removes both objects', async () => {
			await start()
			const owner = await user()
			const id = await uploadPhoto(owner)
			const row = await getRow(id)
			const original = storage.deleteObject
			const failing = vi.spyOn(storage, 'deleteObject')
			failing.mockImplementationOnce(original)
			failing.mockRejectedValueOnce(new Error('bucket down'))

			await owner.agent.delete(`${PHOTOS_URL}/${id}`).expect(503)

			expect(await prisma.storedFile.count({ where: { id } })).toBe(1)
			failing.mockRestore()
			await owner.agent.delete(`${PHOTOS_URL}/${id}`).expect(204)
			expect(await storage.getObject(row.storageKey)).toBeNull()
			expect(await storage.getObject(row.thumbKey)).toBeNull()
			expect(await prisma.storedFile.count()).toBe(0)
		})
	})

	describe('delete racing a message for the same photo', () => {
		it('ends every round with either a deleted photo and no message, or a bound photo with its bytes intact', async () => {
			await start()
			const owner = await user()
			fake.respond(
				...Array.from({ length: RACE_ITERATIONS }, () => createCompletion([logFoodCall()])),
			)

			for (let index = 0; index < RACE_ITERATIONS; index += 1) {
				const id = await uploadPhoto(owner, createFullJpeg(index))
				const row = await getRow(id)
				const clientMessageId = randomUUID()
				// the head start moves from one side to the other, so both orders get exercised
				const isDeleteFirst = index % 2 === 0
				const lag = index * RACE_STAGGER_MS

				const [deleted, posted] = await Promise.all([
					sleep(isDeleteFirst ? 0 : lag).then(() => owner.agent.delete(`${PHOTOS_URL}/${id}`)),
					sleep(isDeleteFirst ? lag : 0).then(() =>
						send(owner, { photoIds: [id] }, clientMessageId),
					),
				])

				const context = `round ${index}: DELETE ${deleted.status}, POST ${posted.status}`
				expect(deleted.status, context).toBeLessThan(500)
				expect(posted.status, context).toBeLessThan(500)
				const message = await prisma.message.findUnique({
					where: { userId_clientMessageId: { userId: owner.userId, clientMessageId } },
				})
				const attachments = await prisma.messageAttachment.count({ where: { fileId: id } })

				if (deleted.status === 204) {
					expect(posted.status, context).toBe(404)
					expect(getErrorCode(posted), context).toBe('PHOTO_NOT_FOUND')
					expect(attachments, context).toBe(0)
					expect(message, context).toBeNull()
					expect(await prisma.storedFile.count({ where: { id } }), context).toBe(0)
					expect(await storage.getObject(row.storageKey), context).toBeNull()
					expect(await storage.getObject(row.thumbKey), context).toBeNull()
					continue
				}
				expect(deleted.status, context).toBe(409)
				expect(getErrorCode(deleted), context).toBe('PHOTO_IN_USE')
				expect(posted.status, context).toBe(201)
				expect(attachments, context).toBe(1)
				expect(message?.status, context).toBe('COMPLETED')
				expect(await storage.getObject(row.storageKey), context).not.toBeNull()
				expect(await storage.getObject(row.thumbKey), context).not.toBeNull()
				expect((await owner.agent.get(`${PHOTOS_URL}/${id}`)).status, context).toBe(200)
			}

			// whatever the order of events, no attachment points at a photo whose bytes are gone
			const bound = await prisma.messageAttachment.findMany({
				where: { fileId: { not: null } },
				select: { fileId: true },
			})
			for (const { fileId } of bound)
				expect(await countStoredObjects(fileId ?? ''), `file ${fileId}`).toBe(2)
		})
	})
})
