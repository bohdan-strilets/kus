import { Logger } from '@nestjs/common'
import type { NestExpressApplication } from '@nestjs/platform-express'
import {
	apiErrorResponseSchema,
	authSessionResponseSchema,
	createDataResponseSchema,
	dailyGoalSchema,
	dayResponseSchema,
} from '@kus/shared'
import request from 'supertest'
import type TestAgent from 'supertest/lib/agent'
import { afterAll, afterEach, describe, expect, it, vi } from 'vitest'

import { getLocalDateString } from '../src/common/time'
import { createFakeAiClient } from '../src/modules/ai/ai.test-utils'
import type { PrismaService } from '../src/prisma'
import { createDbTestApp } from './create-db-test-app'

const GOAL_URL = '/api/v1/goals/current'
const TIMEZONE = 'Europe/Warsaw'
const goalResponse = createDataResponseSchema(dailyGoalSchema)
const dayResponse = createDataResponseSchema(dayResponseSchema)
const GOAL = { kcal: 2200, protein: 140, carbs: 225, fat: 80 }

const fake = createFakeAiClient()

interface TestUser {
	agent: TestAgent
	userId: string
}

describe('goals (e2e, real DB)', () => {
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

	afterEach(async () => {
		await app.close()
	})

	afterAll(() => {
		for (const spy of logSpies) spy.mockRestore()
	})

	it('sets the goal from today on; the day shows it and a second change rewrites the same row', async () => {
		await start()
		const owner = await registerUser('owner@kus.app')

		const response = await owner.agent.put(GOAL_URL).send(GOAL).expect(200)

		expect(goalResponse.parse(response.body).data).toEqual(GOAL)
		const day = await owner.agent.get(`/api/v1/days/${today()}`).expect(200)
		expect(dayResponse.parse(day.body).data).toMatchObject({ goal: GOAL, remainingKcal: 2200 })

		await owner.agent
			.put(GOAL_URL)
			.send({ ...GOAL, kcal: 2000 })
			.expect(200)
		const goals = await prisma.userGoal.findMany({ where: { userId: owner.userId } })
		expect(goals).toHaveLength(1)
		expect(goals[0]).toMatchObject({ dailyKcal: 2000, type: 'MAINTAIN' })
	})

	it('keeps the goal of earlier days and its type', async () => {
		await start()
		const owner = await registerUser('owner@kus.app')
		const past = new Date('2026-01-01T00:00:00Z')
		await prisma.userGoal.create({
			data: {
				userId: owner.userId,
				type: 'LOSE',
				dailyKcal: 1800,
				proteinG: 120,
				fatG: 60,
				carbsG: 180,
				validFrom: past,
			},
		})

		await owner.agent.put(GOAL_URL).send(GOAL).expect(200)

		const goals = await prisma.userGoal.findMany({
			where: { userId: owner.userId },
			orderBy: { validFrom: 'asc' },
		})
		expect(goals.map((goal) => [goal.dailyKcal, goal.type])).toEqual([
			[1800, 'LOSE'],
			[2200, 'LOSE'],
		])
		const pastDay = await owner.agent.get('/api/v1/days/2026-01-01').expect(200)
		expect(dayResponse.parse(pastDay.body).data.goal?.kcal).toBe(1800)
	})

	it('isolates users: a goal is only the own one', async () => {
		await start()
		const owner = await registerUser('owner@kus.app')
		const stranger = await registerUser('stranger@kus.app')

		await owner.agent.put(GOAL_URL).send(GOAL).expect(200)

		const day = await stranger.agent.get(`/api/v1/days/${today()}`).expect(200)
		expect(dayResponse.parse(day.body).data.goal).toBeNull()
		expect(await prisma.userGoal.count({ where: { userId: stranger.userId } })).toBe(0)
	})

	it('validates the bounds and requires auth', async () => {
		await start()
		const owner = await registerUser('owner@kus.app')

		const low = await owner.agent
			.put(GOAL_URL)
			.send({ ...GOAL, kcal: 500, protein: 700 })
			.expect(422)

		expect(apiErrorResponseSchema.parse(low.body)).toMatchObject({
			errorCode: 'VALIDATION_ERROR',
			details: { fields: { kcal: 'TOO_SMALL', protein: 'TOO_LARGE' } },
		})
		await request(app.getHttpServer()).put(GOAL_URL).send(GOAL).expect(401)
		expect(await prisma.userGoal.count()).toBe(0)
	})
})
