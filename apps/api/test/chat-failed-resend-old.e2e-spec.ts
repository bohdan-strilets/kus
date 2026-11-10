import { randomUUID } from 'node:crypto'

import { Logger } from '@nestjs/common'
import type { NestExpressApplication } from '@nestjs/platform-express'
import {
	authSessionResponseSchema,
	createDataResponseSchema,
	sendMessageResponseSchema,
} from '@kus/shared'
import request from 'supertest'
import { afterAll, afterEach, describe, expect, it, vi } from 'vitest'

import { createCompletion, createFakeAiClient, logFoodCall } from '../src/modules/ai/ai.test-utils'
import type { PrismaService } from '../src/prisma'
import { createDbTestApp } from './create-db-test-app'

const MESSAGES_URL = '/api/v1/messages'
const sendResponseSchema = createDataResponseSchema(sendMessageResponseSchema)
const OLD_AGE_HOURS = 30

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

	it('reuses the old row and logs the food on the day of its createdAt, not today', async () => {
		fake.reset()
		;({ app, prisma } = await createDbTestApp({ aiClient: fake.client }))
		const agent = request.agent(app.getHttpServer())
		const registered = await agent
			.post('/api/v1/auth/register')
			.send({
				email: 'owner@kus.app',
				password: 'correct-horse-battery',
				name: 'Test',
				consent: true,
			})
			.expect(201)
		const { user } = createDataResponseSchema(authSessionResponseSchema).parse(registered.body).data
		const clientMessageId = randomUUID()
		const created = await prisma.message.create({
			data: {
				userId: user.id,
				role: 'USER',
				status: 'FAILED',
				clientMessageId,
				content: '3 яйця',
			},
		})
		await prisma.$executeRaw`UPDATE messages SET created_at = now() - make_interval(hours => ${OLD_AGE_HOURS}), updated_at = now() - make_interval(hours => ${OLD_AGE_HOURS}) WHERE id = ${created.id}::uuid`
		const old = await prisma.message.findUniqueOrThrow({ where: { id: created.id } })

		fake.respond(createCompletion([logFoodCall()]))
		const response = await agent
			.post(MESSAGES_URL)
			.send({ clientMessageId, text: '3 яйця' })
			.expect(201)

		const { data } = sendResponseSchema.parse(response.body)
		expect(data.userMessage.id).toBe(created.id)
		expect(await prisma.message.count({ where: { role: 'USER' } })).toBe(1)
		const meals = await prisma.meal.findMany({ where: { userId: user.id } })
		const mealDay = meals.map((meal) => meal.localDate.toISOString().slice(0, 10))
		const oldDay = old.createdAt.toISOString().slice(0, 10)
		const todayUtc = new Date().toISOString().slice(0, 10)
		expect(mealDay).toEqual([oldDay])
		expect(oldDay).not.toBe(todayUtc)
	})
})
