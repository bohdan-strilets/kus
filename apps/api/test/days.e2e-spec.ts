import { randomUUID } from 'node:crypto'

import { Logger } from '@nestjs/common'
import type { NestExpressApplication } from '@nestjs/platform-express'
import {
	apiErrorResponseSchema,
	authSessionResponseSchema,
	createDataResponseSchema,
	dayResponseSchema,
} from '@kus/shared'
import request from 'supertest'
import type TestAgent from 'supertest/lib/agent'
import { afterAll, afterEach, describe, expect, it, vi } from 'vitest'

import { addDays, getLocalDateString } from '../src/common/time'
import {
	createCompletion,
	createFakeAiClient,
	EGGS_AND_BUCKWHEAT_ITEMS,
	logFoodCall,
	SOUP_ITEM,
} from '../src/modules/ai/ai.test-utils'
import type { PrismaService } from '../src/prisma'
import { createDbTestApp } from './create-db-test-app'

const dayResponse = createDataResponseSchema(dayResponseSchema)
const TIMEZONE = 'Europe/Warsaw'
const dayUrl = (localDate: string): string => `/api/v1/days/${localDate}`

const fake = createFakeAiClient()

interface TestUser {
	agent: TestAgent
	userId: string
}

describe('days (e2e, real DB)', () => {
	let app: NestExpressApplication
	let prisma: PrismaService
	const logSpies = [
		vi.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined),
		vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined),
	]
	const today = (): string => getLocalDateString(new Date(), TIMEZONE)

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

	const log = async (user: TestUser, items: unknown[]): Promise<void> => {
		fake.respond(createCompletion([logFoodCall(items)]))
		await user.agent
			.post('/api/v1/messages')
			.send({ clientMessageId: randomUUID(), text: 'їжа' })
			.expect(201)
	}

	afterEach(async () => {
		await app.close()
	})

	afterAll(() => {
		for (const spy of logSpies) spy.mockRestore()
	})

	it('returns an empty day without a goal', async () => {
		await start()
		const owner = await registerUser('owner@kus.app')

		const response = await owner.agent.get(dayUrl(today())).expect(200)

		expect(dayResponse.parse(response.body).data).toEqual({
			localDate: today(),
			meals: [],
			totals: { kcal: 0, protein: 0, fat: 0, carbs: 0, fiber: 0 },
			goal: null,
			remainingKcal: null,
		})
	})

	it('sums every meal of the day and counts the remainder from the goal', async () => {
		await start()
		const owner = await registerUser('owner@kus.app')
		await prisma.userGoal.create({
			data: {
				userId: owner.userId,
				type: 'MAINTAIN',
				dailyKcal: 2200,
				proteinG: 140,
				fatG: 80,
				carbsG: 225,
				validFrom: new Date('2026-01-01T00:00:00Z'),
			},
		})
		await log(owner, EGGS_AND_BUCKWHEAT_ITEMS)
		await log(owner, [SOUP_ITEM])

		const { data } = dayResponse.parse((await owner.agent.get(dayUrl(today())).expect(200)).body)

		// both messages went to the meal the clock picked: one meal with all three entries
		expect(data.meals).toHaveLength(1)
		expect(data.meals[0]?.entries.map((entry) => entry.name)).toEqual([
			'Яйце варене',
			'Гречка варена',
			'Суп',
		])
		expect(data.totals.kcal).toBe(493)
		expect(data.goal).toEqual({ kcal: 2200, protein: 140, carbs: 225, fat: 80 })
		expect(data.remainingKcal).toBe(1707)
	})

	it('IDOR: another user gets their own empty day for the same date', async () => {
		await start()
		const owner = await registerUser('owner@kus.app')
		const stranger = await registerUser('stranger@kus.app')
		await log(owner, [SOUP_ITEM])

		const { data } = dayResponse.parse((await stranger.agent.get(dayUrl(today())).expect(200)).body)

		expect(data.meals).toEqual([])
		expect(data.totals.kcal).toBe(0)
	})

	it('leaves soft-deleted entries and their empty meals out', async () => {
		await start()
		const owner = await registerUser('owner@kus.app')
		await log(owner, [SOUP_ITEM])
		await prisma.foodEntry.updateMany({ data: { deletedAt: new Date() } })

		const { data } = dayResponse.parse((await owner.agent.get(dayUrl(today())).expect(200)).body)

		expect(data.meals).toEqual([])
		expect(data.totals.kcal).toBe(0)
	})

	it('rejects an invalid date, a day after tomorrow and a request without a session', async () => {
		await start()
		const owner = await registerUser('owner@kus.app')

		await owner.agent.get(dayUrl('2026-13-01')).expect(422)
		await owner.agent.get(dayUrl('today')).expect(422)
		const tomorrow = getLocalDateString(addDays(new Date(), 1), TIMEZONE)
		await owner.agent.get(dayUrl(tomorrow)).expect(200)
		const future = await owner.agent
			.get(dayUrl(getLocalDateString(addDays(new Date(), 3), TIMEZONE)))
			.expect(422)
		expect(apiErrorResponseSchema.parse(future.body).details).toEqual({
			fields: { localDate: 'IN_FUTURE' },
		})
		await request(app.getHttpServer()).get(dayUrl(today())).expect(401)
	})
})
