import { randomUUID } from 'node:crypto'

import { Logger } from '@nestjs/common'
import type { NestExpressApplication } from '@nestjs/platform-express'
import {
	apiErrorResponseSchema,
	authSessionResponseSchema,
	chatMessageSchema,
	createDataResponseSchema,
	sendMessageResponseSchema,
} from '@kus/shared'
import request from 'supertest'
import type TestAgent from 'supertest/lib/agent'
import { afterAll, afterEach, describe, expect, it, vi } from 'vitest'

import {
	createCompletion,
	createFakeAiClient,
	logFoodCall,
	SOUP_ITEM,
	soupClarifyCall,
} from '../src/modules/ai/ai.test-utils'
import type { PrismaService } from '../src/prisma'
import { createDbTestApp } from './create-db-test-app'

const sendResponseSchema = createDataResponseSchema(sendMessageResponseSchema)
const answerResponseSchema = createDataResponseSchema(chatMessageSchema)
const answerUrl = (id: string): string => `/api/v1/clarifications/${id}/answer`

const fake = createFakeAiClient()

interface TestUser {
	agent: TestAgent
	userId: string
}

describe('clarification answers (e2e, real DB, fake model)', () => {
	let app: NestExpressApplication
	let prisma: PrismaService
	const logSpies = [
		vi.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined),
		vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined),
	]

	const start = async (): Promise<void> => {
		fake.reset()
		;({ app, prisma } = await createDbTestApp({ aiClient: fake.client }))
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

	/** «тарілка супу» → the soup logged at 150 kcal with «Овочевий 150 / Харчо 330». */
	const askAboutSoup = async (user: TestUser): Promise<{ clarificationId: string }> => {
		fake.respond(createCompletion([logFoodCall([SOUP_ITEM]), soupClarifyCall]))
		const response = await user.agent
			.post('/api/v1/messages')
			.send({ clientMessageId: randomUUID(), text: 'тарілка супу' })
			.expect(201)
		const [clarification] = sendResponseSchema.parse(response.body).data.assistantMessage
			.clarifications
		if (!clarification) throw new Error('The soup question was not stored')
		return { clarificationId: clarification.id }
	}

	afterEach(async () => {
		await app.close()
	})

	afterAll(() => {
		for (const spy of logSpies) spy.mockRestore()
	})

	it('re-logs the entry with the tapped answer, keeps a correction and closes the question', async () => {
		await start()
		const owner = await registerUser('owner@kus.app')
		const { clarificationId } = await askAboutSoup(owner)

		const response = await owner.agent
			.post(answerUrl(clarificationId))
			.send({ optionIndex: 1 })
			.expect(200)

		const message = answerResponseSchema.parse(response.body).data
		expect(message.clarifications[0]).toMatchObject({ status: 'ANSWERED', answeredOptionIndex: 1 })
		const meal = message.meals[0]
		expect(meal?.entries[0]).toMatchObject({
			kcal: 330,
			protein: 18,
			fat: 18,
			carbs: 24,
			grams: 300,
		})
		expect(meal?.totals.kcal).toBe(330)
		const corrections = await prisma.correction.findMany()
		expect(corrections.map(({ before, after }) => [before, after])).toEqual([
			[
				{ kcal: 150, protein: 6, fat: 6, carbs: 18 },
				{ kcal: 330, protein: 18, fat: 18, carbs: 24 },
			],
		])
		expect(fake.bodies).toHaveLength(1)

		const again = await owner.agent
			.post(answerUrl(clarificationId))
			.send({ optionIndex: 0 })
			.expect(409)
		expect(apiErrorResponseSchema.parse(again.body).errorCode).toBe(
			'CLARIFICATION_ALREADY_ANSWERED',
		)
	})

	it('renames the entry when the tapped option carries a new name', async () => {
		await start()
		const owner = await registerUser('owner@kus.app')
		const pasta = {
			...SOUP_ITEM,
			name: 'Макарони варені',
			grams: 100,
			kcal: 160,
			protein: 6,
			fat: 1,
			carbs: 31,
			category: 'pasta',
		}
		const question = {
			name: 'clarify',
			args: {
				question: 'Варені чи сухі?',
				itemIndexes: [0],
				options: [
					{
						label: 'Варені',
						kcal: 160,
						protein: 6,
						fat: 1,
						carbs: 31,
						fiber: null,
						grams: null,
						name: null,
					},
					{
						label: 'Сухі',
						kcal: 360,
						protein: 12,
						fat: 2,
						carbs: 74,
						fiber: null,
						grams: null,
						name: 'Макарони сухі',
					},
				],
			},
		}
		fake.respond(createCompletion([logFoodCall([pasta]), question]))
		const sent = await owner.agent
			.post('/api/v1/messages')
			.send({ clientMessageId: randomUUID(), text: '100 г макаронів' })
			.expect(201)
		const clarificationId =
			sendResponseSchema.parse(sent.body).data.assistantMessage.clarifications[0]?.id ?? ''

		const response = await owner.agent
			.post(answerUrl(clarificationId))
			.send({ optionIndex: 1 })
			.expect(200)

		const message = answerResponseSchema.parse(response.body).data
		expect(message.meals[0]?.entries[0]).toMatchObject({ name: 'Макарони сухі', kcal: 360 })
		expect(message.clarifications[0]?.answer).toBe('Сухі')
		const correction = await prisma.correction.findFirstOrThrow()
		expect(correction.before).toMatchObject({ name: 'Макарони варені' })
		expect(correction.after).toMatchObject({ name: 'Макарони сухі' })
	})

	it('IDOR: another user can neither answer nor learn of the question', async () => {
		await start()
		const owner = await registerUser('owner@kus.app')
		const stranger = await registerUser('stranger@kus.app')
		const { clarificationId } = await askAboutSoup(owner)

		const response = await stranger.agent
			.post(answerUrl(clarificationId))
			.send({ optionIndex: 1 })
			.expect(404)

		expect(apiErrorResponseSchema.parse(response.body).errorCode).toBe('CLARIFICATION_NOT_FOUND')
		const entry = await prisma.foodEntry.findFirstOrThrow({ where: { userId: owner.userId } })
		expect(entry.kcal).toBe(150)
		const clarification = await prisma.clarification.findUniqueOrThrow({
			where: { id: clarificationId },
		})
		expect(clarification.status).toBe('OPEN')
	})

	it('validates the id and the option index', async () => {
		await start()
		const owner = await registerUser('owner@kus.app')
		const { clarificationId } = await askAboutSoup(owner)

		const missing = await owner.agent
			.post(answerUrl(clarificationId))
			.send({ optionIndex: 3 })
			.expect(422)
		expect(apiErrorResponseSchema.parse(missing.body).details).toEqual({
			fields: { optionIndex: 'TOO_LARGE' },
		})
		await owner.agent.post(answerUrl(clarificationId)).send({ optionIndex: 9 }).expect(422)
		await owner.agent.post(answerUrl(clarificationId)).send({}).expect(422)
		await owner.agent.post(answerUrl('not-a-uuid')).send({ optionIndex: 0 }).expect(422)
		await owner.agent.post(answerUrl(randomUUID())).send({ optionIndex: 0 }).expect(404)
		await request(app.getHttpServer())
			.post(answerUrl(clarificationId))
			.send({ optionIndex: 0 })
			.expect(401)
	})

	it('refuses a question stored before options carried values, changing nothing', async () => {
		await start()
		const owner = await registerUser('owner@kus.app')
		const { clarificationId } = await askAboutSoup(owner)
		await prisma.clarification.update({
			where: { id: clarificationId },
			data: {
				options: [
					{ label: 'Овочевий', kcal: 150 },
					{ label: 'Харчо', kcal: 330 },
				],
			},
		})

		const response = await owner.agent
			.post(answerUrl(clarificationId))
			.send({ optionIndex: 1 })
			.expect(409)

		expect(apiErrorResponseSchema.parse(response.body).errorCode).toBe(
			'CLARIFICATION_NOT_APPLICABLE',
		)
		expect((await prisma.foodEntry.findFirstOrThrow()).kcal).toBe(150)
	})

	it('refuses a question whose entries were deleted', async () => {
		await start()
		const owner = await registerUser('owner@kus.app')
		const { clarificationId } = await askAboutSoup(owner)
		await prisma.foodEntry.updateMany({ data: { deletedAt: new Date() } })

		await owner.agent.post(answerUrl(clarificationId)).send({ optionIndex: 1 }).expect(409)

		const clarification = await prisma.clarification.findUniqueOrThrow({
			where: { id: clarificationId },
		})
		expect(clarification.status).toBe('OPEN')
	})
})
