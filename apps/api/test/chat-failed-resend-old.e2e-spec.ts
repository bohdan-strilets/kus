import { randomUUID } from 'node:crypto'

import { Logger } from '@nestjs/common'
import type { NestExpressApplication } from '@nestjs/platform-express'
import { createDataResponseSchema, sendMessageResponseSchema } from '@kus/shared'
import { afterAll, afterEach, describe, expect, it, vi } from 'vitest'

import { getLocalDateString } from '../src/common/time'
import { createCompletion, createFakeAiClient, logFoodCall } from '../src/modules/ai/ai.test-utils'
import type { PrismaService } from '../src/prisma'
import { registerUser, type TestUser, uploadPhoto } from './chat-photo-test-utils'
import { createDbTestApp } from './create-db-test-app'

const MESSAGES_URL = '/api/v1/messages'
const sendResponseSchema = createDataResponseSchema(sendMessageResponseSchema)
const OLD_AGE_HOURS = 30
const DEFAULT_TIMEZONE = 'Europe/Warsaw'

const fake = createFakeAiClient()

describe('resend of an old FAILED message (e2e, real DB, fake model)', () => {
	let app: NestExpressApplication
	let prisma: PrismaService
	const logSpies = [
		vi.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined),
		vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined),
	]

	afterEach(async () => {
		await app.close()
	})

	afterAll(() => {
		for (const spy of logSpies) spy.mockRestore()
	})

	const start = async (): Promise<TestUser> => {
		fake.reset()
		;({ app, prisma } = await createDbTestApp({ aiClient: fake.client }))
		return registerUser(app, 'owner@kus.app')
	}

	/** A message the first try failed on, written OLD_AGE_HOURS ago. */
	const createOldFailed = async (
		user: TestUser,
		clientMessageId: string,
		fileId?: string,
	): Promise<{ id: string; oldDay: string }> => {
		const created = await prisma.message.create({
			data: {
				userId: user.userId,
				role: 'USER',
				status: 'FAILED',
				clientMessageId,
				content: '3 яйця',
				...(fileId
					? {
							attachments: {
								create: [
									{
										fileId,
										position: 0,
										mimeType: 'image/jpeg',
										width: 1,
										height: 1,
										sizeBytes: 1,
										status: 'PENDING',
									},
								],
							},
						}
					: {}),
			},
		})
		await prisma.$executeRaw`UPDATE messages SET created_at = now() - make_interval(hours => ${OLD_AGE_HOURS}), updated_at = now() - make_interval(hours => ${OLD_AGE_HOURS}) WHERE id = ${created.id}::uuid`
		const old = await prisma.message.findUniqueOrThrow({ where: { id: created.id } })
		return { id: created.id, oldDay: getLocalDateString(old.createdAt, DEFAULT_TIMEZONE) }
	}

	const getMealDays = async (user: TestUser): Promise<string[]> => {
		const meals = await prisma.meal.findMany({ where: { userId: user.userId } })
		return meals.map((meal) => meal.localDate.toISOString().slice(0, 10))
	}

	const today = (): string => getLocalDateString(new Date(), DEFAULT_TIMEZONE)

	it('reuses the old row and logs the food on the day of its createdAt without sendNow', async () => {
		const user = await start()
		const clientMessageId = randomUUID()
		const { id, oldDay } = await createOldFailed(user, clientMessageId)

		fake.respond(createCompletion([logFoodCall()]))
		const response = await user.agent
			.post(MESSAGES_URL)
			.send({ clientMessageId, text: '3 яйця' })
			.expect(201)

		const { data } = sendResponseSchema.parse(response.body)
		expect(data.userMessage.id).toBe(id)
		expect(await prisma.message.count({ where: { role: 'USER' } })).toBe(1)
		expect(await getMealDays(user)).toEqual([oldDay])
		expect(oldDay).not.toBe(today())
	})

	it('logs the food today and restamps the same row with sendNow', async () => {
		const user = await start()
		const clientMessageId = randomUUID()
		const { id, oldDay } = await createOldFailed(user, clientMessageId)

		fake.respond(createCompletion([logFoodCall()]))
		const response = await user.agent
			.post(MESSAGES_URL)
			.send({ clientMessageId, text: '3 яйця', sendNow: true })
			.expect(201)

		const { data } = sendResponseSchema.parse(response.body)
		expect(data.userMessage.id).toBe(id)
		expect(await prisma.message.count({ where: { role: 'USER' } })).toBe(1)
		expect(await getMealDays(user)).toEqual([today()])
		expect(oldDay).not.toBe(today())
		const row = await prisma.message.findUniqueOrThrow({ where: { id } })
		expect(getLocalDateString(row.createdAt, DEFAULT_TIMEZONE)).toBe(today())
	})

	it('logs a FAILED message with a stored photo today with sendNow: no PHOTO_IN_USE', async () => {
		const user = await start()
		const photoId = await uploadPhoto(user)
		const clientMessageId = randomUUID()
		const { id } = await createOldFailed(user, clientMessageId, photoId)

		fake.respond(createCompletion([logFoodCall()]))
		const response = await user.agent
			.post(MESSAGES_URL)
			.send({ clientMessageId, text: '3 яйця', photoIds: [photoId], sendNow: true })
			.expect(201)

		const { data } = sendResponseSchema.parse(response.body)
		expect(data.userMessage.id).toBe(id)
		expect(await getMealDays(user)).toEqual([today()])
	})

	it('ignores sendNow for a new message', async () => {
		const user = await start()

		fake.respond(createCompletion([logFoodCall()]))
		await user.agent
			.post(MESSAGES_URL)
			.send({ clientMessageId: randomUUID(), text: '3 яйця', sendNow: true })
			.expect(201)

		expect(await getMealDays(user)).toEqual([today()])
	})
})
