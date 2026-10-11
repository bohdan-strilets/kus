import { randomUUID } from 'node:crypto'

import { Logger } from '@nestjs/common'
import type { NestExpressApplication } from '@nestjs/platform-express'
import {
	apiErrorResponseSchema,
	authSessionResponseSchema,
	createDataResponseSchema,
	sendMessageResponseSchema,
} from '@kus/shared'
import request from 'supertest'
import type TestAgent from 'supertest/lib/agent'
import { afterAll, afterEach, describe, expect, it, vi } from 'vitest'

import { createCompletion, createFakeAiClient, logFoodCall } from '../src/modules/ai/ai.test-utils'
import type { PrismaService } from '../src/prisma'
import { createDbTestApp } from './create-db-test-app'
import { createJpeg, JPEG_SENTINEL, toBase64 } from './fixtures/jpeg'

const MESSAGES_URL = '/api/v1/messages'
const VISION_MODEL = 'test/vision'
const sendResponseSchema = createDataResponseSchema(sendMessageResponseSchema)

const fake = createFakeAiClient()

interface TestUser {
	agent: TestAgent
	userId: string
}

const photoCall = (reason: 'no_food' | 'unreadable' = 'no_food') => ({
	name: 'photo_unusable',
	args: { reason, reply: 'Не бачу тут їжі. Сфотографуй ще раз або напиши текстом.' },
})

const toPhoto = (jpeg: Buffer = createJpeg()) => ({
	mimeType: 'image/jpeg',
	data: toBase64(jpeg),
})

/** The user turn of a recorded request body: what the model actually got. */
const getUserContent = (body: unknown): unknown => {
	const messages = (body as { messages: { role: string; content: unknown }[] }).messages
	return messages.findLast((message) => message.role === 'user')?.content
}

describe('chat messages with a photo (e2e, real DB, fake model)', () => {
	let app: NestExpressApplication
	let prisma: PrismaService
	const logSpies = [
		vi.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined),
		vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined),
	]

	const start = async (env: Record<string, string> = {}): Promise<void> => {
		fake.reset()
		;({ app, prisma } = await createDbTestApp({
			aiClient: fake.client,
			env: { AI_MODEL_VISION: VISION_MODEL, ...env },
		}))
	}

	const registerUser = async (email: string): Promise<TestUser> => {
		const agent = request.agent(app.getHttpServer())
		const response = await agent
			.post('/api/v1/auth/register')
			.send({ email, password: 'correct-horse-battery', name: 'Test', consent: true })
			.expect(201)
		const { user } = createDataResponseSchema(authSessionResponseSchema).parse(response.body).data
		return { agent, userId: user.id }
	}

	const send = (
		user: TestUser,
		body: { text?: string; photo?: unknown },
		clientMessageId: string = randomUUID(),
	) => user.agent.post(MESSAGES_URL).send({ clientMessageId, ...body })

	afterEach(async () => {
		await app.close()
	})

	afterAll(() => {
		for (const spy of logSpies) spy.mockRestore()
	})

	it('sends the photo and the text to the vision model and marks the entries fromPhoto', async () => {
		await start()
		const owner = await registerUser('owner@kus.app')
		fake.respond(createCompletion([logFoodCall()]))

		const response = await send(owner, { text: '150 г', photo: toPhoto() }).expect(201)

		const { data } = sendResponseSchema.parse(response.body)
		expect(data.userMessage).toMatchObject({
			content: '150 г',
			status: 'COMPLETED',
			photo: { status: 'PROCESSED' },
		})
		expect(data.assistantMessage.photo).toBeNull()
		expect(fake.bodies[0]).toMatchObject({ model: VISION_MODEL })
		const content = getUserContent(fake.bodies[0]) as { type: string }[]
		expect(content.map((part) => part.type)).toEqual(['image_url', 'text'])
		expect(JSON.stringify(content[0])).toContain('"url":"data:image/jpeg;base64,')
		expect(content[1]).toMatchObject({ text: '150 г' })

		const entries = await prisma.foodEntry.findMany({ where: { userId: owner.userId } })
		expect(entries).toHaveLength(2)
		expect(entries.every((entry) => entry.fromPhoto)).toBe(true)
		const attachment = await prisma.messageAttachment.findFirstOrThrow()
		expect(attachment).toMatchObject({
			mimeType: 'image/jpeg',
			width: 640,
			height: 480,
			status: 'PROCESSED',
			storageKey: null,
		})
		const usage = await prisma.dailyUsage.findFirstOrThrow({ where: { userId: owner.userId } })
		expect(usage).toMatchObject({ messageCount: 1, photoCount: 1 })
	})

	it('takes a photo without text and keeps the entries of a text message fromPhoto: false', async () => {
		await start()
		const owner = await registerUser('owner@kus.app')
		fake.respond(createCompletion([logFoodCall()]), createCompletion([logFoodCall()]))

		const photoOnly = await send(owner, { photo: toPhoto() }).expect(201)
		await send(owner, { text: 'банан' }).expect(201)

		const { data } = sendResponseSchema.parse(photoOnly.body)
		expect(data.userMessage).toMatchObject({ content: null, photo: { status: 'PROCESSED' } })
		const content = getUserContent(fake.bodies[0]) as { type: string }[]
		expect(content.map((part) => part.type)).toEqual(['image_url'])
		// the text message goes to the plain model and carries no photo
		expect(fake.bodies[1]).toMatchObject({ model: 'test/model' })
		expect(typeof getUserContent(fake.bodies[1])).toBe('string')
		const fromPhoto = await prisma.foodEntry.groupBy({ by: ['fromPhoto'], _count: true })
		expect(fromPhoto.map((group) => [group.fromPhoto, group._count]).sort()).toEqual([
			[false, 2],
			[true, 2],
		])
	})

	it('tells the model that an earlier message had a photo, without sending it again', async () => {
		await start()
		const owner = await registerUser('owner@kus.app')
		fake.respond(createCompletion([logFoodCall()]), createCompletion([logFoodCall()]))

		await send(owner, { photo: toPhoto() }).expect(201)
		await send(owner, { text: 'ще чай' }).expect(201)

		const body = JSON.stringify(fake.bodies[1])
		expect(body).toContain('[фото]')
		expect(body).not.toContain('base64,')
	})

	it('needs a text or a photo', async () => {
		await start()
		const owner = await registerUser('owner@kus.app')

		const response = await send(owner, { text: '  ' }).expect(422)

		expect(apiErrorResponseSchema.parse(response.body).details).toEqual({
			fields: { _root: 'TEXT_OR_PHOTO_REQUIRED' },
		})
		expect(fake.bodies).toHaveLength(0)
	})

	it('stops photos at their own daily limit and lets texts through', async () => {
		await start({ AI_DAILY_PHOTO_LIMIT: '1' })
		const owner = await registerUser('owner@kus.app')
		fake.respond(createCompletion([logFoodCall()]), createCompletion([logFoodCall()]))
		await send(owner, { photo: toPhoto() }).expect(201)

		const limited = await send(owner, { photo: toPhoto() }).expect(429)
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

	it('reports the message limit, not the photo one, when the messages are used up', async () => {
		await start({ AI_DAILY_MESSAGE_LIMIT: '1' })
		const owner = await registerUser('owner@kus.app')
		fake.respond(createCompletion([logFoodCall()]))
		await send(owner, { text: 'банан' }).expect(201)

		const response = await send(owner, { photo: toPhoto() }).expect(429)

		expect(apiErrorResponseSchema.parse(response.body).errorCode).toBe('DAILY_LIMIT_REACHED')
	})

	it('replays a completed photo message without calling the model again', async () => {
		await start()
		const owner = await registerUser('owner@kus.app')
		const clientMessageId = randomUUID()
		fake.respond(createCompletion([logFoodCall()]))

		const first = await send(owner, { photo: toPhoto() }, clientMessageId).expect(201)
		const second = await send(owner, { photo: toPhoto() }, clientMessageId).expect(201)

		expect(fake.bodies).toHaveLength(1)
		expect(sendResponseSchema.parse(second.body).data.assistantMessage.id).toBe(
			sendResponseSchema.parse(first.body).data.assistantMessage.id,
		)
		expect(await prisma.messageAttachment.count()).toBe(1)
	})

	it('refuses a clientMessageId reused with or without a photo', async () => {
		await start()
		const owner = await registerUser('owner@kus.app')
		const withPhoto = randomUUID()
		const withText = randomUUID()
		fake.respond(createCompletion([logFoodCall()]), createCompletion([logFoodCall()]))
		await send(owner, { photo: toPhoto() }, withPhoto).expect(201)
		await send(owner, { text: 'банан' }, withText).expect(201)

		const droppedPhoto = await send(owner, { text: 'x' }, withPhoto).expect(409)
		const addedPhoto = await send(owner, { text: 'банан', photo: toPhoto() }, withText).expect(409)

		for (const response of [droppedPhoto, addedPhoto]) {
			expect(apiErrorResponseSchema.parse(response.body).errorCode).toBe('CLIENT_MESSAGE_ID_REUSED')
		}
		expect(fake.bodies).toHaveLength(2)
	})

	it('takes the photo again on a retry of a failed message', async () => {
		await start()
		const owner = await registerUser('owner@kus.app')
		const clientMessageId = randomUUID()
		fake.respond(new Error('network down'), createCompletion([logFoodCall()]))
		await send(owner, { photo: toPhoto() }, clientMessageId).expect(503)

		const retry = await send(owner, { photo: toPhoto() }, clientMessageId).expect(201)

		expect(sendResponseSchema.parse(retry.body).data.userMessage.photo).toEqual({
			status: 'PROCESSED',
		})
		expect(await prisma.messageAttachment.count()).toBe(1)
		expect(fake.bodies).toHaveLength(2)
	})

	it('answers photo_unusable with the reply, FAILED photo and no entries', async () => {
		await start()
		const owner = await registerUser('owner@kus.app')
		fake.respond(createCompletion([photoCall('unreadable')]))

		const response = await send(owner, { photo: toPhoto() }).expect(201)

		const { data } = sendResponseSchema.parse(response.body)
		expect(data.assistantMessage.content).toContain('Сфотографуй ще раз')
		expect(data.assistantMessage.meals).toEqual([])
		expect(data.userMessage).toMatchObject({ status: 'COMPLETED', photo: { status: 'FAILED' } })
		expect(await prisma.foodEntry.count()).toBe(0)
		expect((await prisma.messageAttachment.findFirstOrThrow()).status).toBe('FAILED')
	})

	it('rejects photo_unusable for a text message and retries once, then 503', async () => {
		await start()
		const owner = await registerUser('owner@kus.app')
		fake.respond(createCompletion([photoCall()]), createCompletion([photoCall()]))

		const response = await send(owner, { text: 'банан' }).expect(503)

		expect(apiErrorResponseSchema.parse(response.body).errorCode).toBe('AI_UNAVAILABLE')
		expect(fake.bodies).toHaveLength(2)
		expect(await prisma.foodEntry.count()).toBe(0)
	})

	it('cuts EXIF and comments from the JPEG before the model gets it', async () => {
		await start()
		const owner = await registerUser('owner@kus.app')
		fake.respond(createCompletion([logFoodCall()]))
		const withExif = createJpeg({ hasSentinel: true })

		await send(owner, { photo: toPhoto(withExif) }).expect(201)

		const [image] = getUserContent(fake.bodies[0]) as { image_url: { url: string } }[]
		const sent = Buffer.from(image?.image_url.url.split('base64,')[1] ?? '', 'base64')
		expect(sent.length).toBeGreaterThan(0)
		expect(sent.includes(JPEG_SENTINEL)).toBe(false)
		expect(sent.length).toBeLessThan(withExif.length)
		expect((await prisma.messageAttachment.findFirstOrThrow()).sizeBytes).toBe(sent.length)
	})

	it('does not show a photo of another user in the feed or let a replay through', async () => {
		await start()
		const owner = await registerUser('owner@kus.app')
		const other = await registerUser('other@kus.app')
		const clientMessageId = randomUUID()
		fake.respond(createCompletion([logFoodCall()]), createCompletion([logFoodCall()]))
		await send(owner, { photo: toPhoto() }, clientMessageId).expect(201)

		// the same id belongs to another user: a new message, not the owner's turn
		const otherResponse = await send(other, { text: 'банан' }, clientMessageId).expect(201)

		const { data } = sendResponseSchema.parse(otherResponse.body)
		expect(data.userMessage.photo).toBeNull()
		expect(fake.bodies).toHaveLength(2)
	})
})
