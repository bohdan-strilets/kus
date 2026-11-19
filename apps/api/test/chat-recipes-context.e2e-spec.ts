import { randomUUID } from 'node:crypto'

import { Logger } from '@nestjs/common'
import type { NestExpressApplication } from '@nestjs/platform-express'
import { authSessionResponseSchema, createDataResponseSchema } from '@kus/shared'
import request from 'supertest'
import type TestAgent from 'supertest/lib/agent'
import { afterAll, afterEach, describe, expect, it, vi } from 'vitest'

import { createCompletion, createFakeAiClient } from '../src/modules/ai/ai.test-utils'
import type { PrismaService } from '../src/prisma'
import { createDbTestApp } from './create-db-test-app'

const MESSAGES_URL = '/api/v1/messages'
const fake = createFakeAiClient()
const replyCall = { name: 'reply', args: { text: 'Ок' } }
/** Names no recipe, so an r-ref can only come from a find_food read. */
const MESSAGE_TEXT = 'їв ту штуку'

interface TestUser {
	agent: TestAgent
	userId: string
}

interface SeedOptions {
	aliases?: string[]
	deletedAt?: Date
}

describe('saved recipes in the model context (e2e, real DB, fake model)', () => {
	let app: NestExpressApplication
	let prisma: PrismaService
	const logSpies = [
		vi.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined),
		vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined),
		vi.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined),
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

	const send = (user: TestUser, text: string) =>
		user.agent.post(MESSAGES_URL).send({ clientMessageId: randomUUID(), text })

	/** A 1000 g pot of 1000 kcal (100 kcal/100 g) with a 350 g portion. */
	const seedRecipe = (user: TestUser, name: string, options: SeedOptions = {}) =>
		prisma.recipe.create({
			data: {
				userId: user.userId,
				name,
				nameNormalized: name.trim().toLowerCase(),
				aliases: options.aliases ?? [],
				cookedGrams: 1000,
				defaultGrams: 350,
				category: 'soup',
				deletedAt: options.deletedAt,
				ingredients: {
					create: [
						{
							name: 'Буряк',
							grams: 500,
							kcal: 600,
							proteinG: 20,
							fatG: 10,
							carbsG: 100,
							position: 0,
						},
						{
							name: 'Яловичина',
							grams: 500,
							kcal: 400,
							proteinG: 60,
							fatG: 20,
							carbsG: 0,
							position: 1,
						},
					],
				},
			},
		})

	const requestText = (index: number): string => JSON.stringify(fake.bodies[index])

	afterEach(async () => {
		await app.close()
	})

	afterAll(() => {
		for (const spy of logSpies) spy.mockRestore()
	})

	it('shows only the recipes the message names, with the backend’s numbers, and no block otherwise', async () => {
		await start()
		const owner = await registerUser('owner@kus.app')
		await seedRecipe(owner, 'Борщ', { aliases: ['борщик'] })
		await seedRecipe(owner, 'Плов')
		fake.respond(createCompletion([replyCall]), createCompletion([replyCall]))

		await send(owner, 'з’їв борщик').expect(201)
		await send(owner, 'просто привіт').expect(201)

		const first = requestText(0)
		expect(first).toContain('Saved recipes (data')
		expect(first).toContain('r1 \\"Борщ\\" portion 350 g, 100 kcal/100 g')
		expect(first).not.toContain('Плов')
		expect(requestText(1)).not.toContain('Saved recipes (data')
	})

	it('never shows a recipe of another user or a deleted one', async () => {
		await start()
		const owner = await registerUser('owner@kus.app')
		const stranger = await registerUser('stranger@kus.app')
		await seedRecipe(stranger, 'Борщ чужий')
		await seedRecipe(owner, 'Борщ видалений', { deletedAt: new Date() })
		fake.respond(createCompletion([replyCall]))

		await send(owner, 'з’їв борщ').expect(201)

		const everything = requestText(0)
		expect(everything).not.toContain('Saved recipes (data')
		expect(everything).not.toContain('чужий')
		expect(everything).not.toContain('видалений')
	})

	it('find_food with scope saved lists a recipe with its ingredients and an r-ref, own and active only', async () => {
		await start()
		const owner = await registerUser('owner@kus.app')
		const stranger = await registerUser('stranger@kus.app')
		await seedRecipe(owner, 'Борщ')
		await seedRecipe(owner, 'Борщ видалений', { deletedAt: new Date() })
		await seedRecipe(stranger, 'Борщ чужий')
		fake.respond(
			createCompletion([{ name: 'find_food', args: { query: 'борщ', scope: 'saved' } }]),
			createCompletion([replyCall]),
		)

		await send(owner, MESSAGE_TEXT).expect(201)

		const result = requestText(1)
		expect(result).toContain(
			'r1 \\"Борщ\\" — recipe: portion 350 g, 100 kcal/100 g; ingredients: Буряк 500 g, Яловичина 500 g',
		)
		expect(result).not.toContain('чужий')
		expect(result).not.toContain('видалений')
	})
})
