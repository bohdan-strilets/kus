import { randomUUID } from 'node:crypto'

import { Logger } from '@nestjs/common'
import type { NestExpressApplication } from '@nestjs/platform-express'
import { authSessionResponseSchema, createDataResponseSchema } from '@kus/shared'
import request from 'supertest'
import type TestAgent from 'supertest/lib/agent'
import { afterAll, afterEach, describe, expect, it, vi } from 'vitest'

import { addDays, formatDbDate, getLocalDate } from '../src/common/time'
import {
	createCompletion,
	createFakeAiClient,
	type FakeToolCall,
} from '../src/modules/ai/ai.test-utils'
import type { PrismaService } from '../src/prisma'
import { createDbTestApp } from './create-db-test-app'

const MESSAGES_URL = '/api/v1/messages'
const fake = createFakeAiClient()
const MESSAGE_TEXT = 'коли я почав ходити в зал'
const REPLY: FakeToolCall = { name: 'reply', args: { text: 'Дивлюсь' } }

interface TestUser {
	agent: TestAgent
	userId: string
	timezone: string
}

const toDbDate = (date: string): Date => new Date(`${date}T00:00:00Z`)

const getWorkouts = (args: Record<string, unknown>): FakeToolCall => ({
	name: 'get_workouts',
	args,
})

describe('get_workouts (e2e, real DB, fake model)', () => {
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
		const { timezone } = await prisma.user.findUniqueOrThrow({ where: { id: user.id } })
		return { agent, userId: user.id, timezone }
	}

	const send = (user: TestUser, text: string) =>
		user.agent.post(MESSAGES_URL).send({ clientMessageId: randomUUID(), text })

	const daysAgo = (user: TestUser, days: number): string =>
		formatDbDate(addDays(getLocalDate(new Date(), user.timezone), -days))

	/** One workout with one bench entry of 5×5 at `weightKg`, straight into the database. */
	const seedWorkout = async (
		user: TestUser,
		{
			date,
			weightKg,
			deletedAt = null,
			entryDeletedAt = null,
			source = 'CHAT',
			finishedAt = new Date(),
		}: {
			date: string
			weightKg: number
			deletedAt?: Date | null
			entryDeletedAt?: Date | null
			source?: 'CHAT' | 'LIVE'
			finishedAt?: Date | null
		},
	) => {
		const performedAt = source === 'LIVE' ? new Date() : new Date(`${date}T12:00:00Z`)
		const workout = await prisma.workout.create({
			data: {
				userId: user.userId,
				localDate: toDbDate(date),
				durationMin: 60,
				source,
				startedAt: source === 'LIVE' ? performedAt : null,
				finishedAt,
				deletedAt,
			},
		})
		await prisma.exerciseEntry.create({
			data: {
				userId: user.userId,
				workoutId: workout.id,
				name: 'Жим лежачи',
				kind: 'STRENGTH',
				source: 'MANUAL',
				performedAt,
				localDate: toDbDate(date),
				deletedAt: entryDeletedAt,
				sets: {
					create: Array.from({ length: 5 }, (_, position) => ({
						userId: user.userId,
						position,
						reps: 5,
						weightKg,
					})),
				},
			},
		})
		return workout
	}

	const requestText = (index: number): string => JSON.stringify(fake.bodies[index])

	afterEach(async () => {
		await app.close()
	})

	afterAll(() => {
		for (const spy of logSpies) spy.mockRestore()
	})

	it('answers with the first workout ever and the counted period of the user', async () => {
		await start()
		const owner = await registerUser('owner@kus.app')
		await seedWorkout(owner, { date: daysAgo(owner, 200), weightKg: 60 })
		await seedWorkout(owner, { date: daysAgo(owner, 3), weightKg: 80 })
		fake.respond(createCompletion([getWorkouts({ days: 30 })]), createCompletion([REPLY]))

		await send(owner, MESSAGE_TEXT).expect(201)

		expect(fake.bodies).toHaveLength(2)
		const result = requestText(1)
		expect(result).toContain(`First workout ever: ${daysAgo(owner, 200)}; all time: 2 workouts.`)
		expect(result).toContain('Workouts: 1 (first')
		expect(result).toContain('working sets 5')
	})

	it("does not show another user's workouts, a deleted workout or a deleted entry", async () => {
		await start()
		const owner = await registerUser('owner@kus.app')
		const stranger = await registerUser('stranger@kus.app')
		await seedWorkout(stranger, { date: daysAgo(stranger, 2), weightKg: 200 })
		await seedWorkout(owner, { date: daysAgo(owner, 2), weightKg: 70, deletedAt: new Date() })
		await seedWorkout(owner, { date: daysAgo(owner, 1), weightKg: 71, entryDeletedAt: new Date() })
		fake.respond(createCompletion([getWorkouts({ days: 30 })]), createCompletion([REPLY]))

		await send(owner, MESSAGE_TEXT).expect(201)

		const result = requestText(1)
		expect(result).toContain('all time: 1 workouts.')
		expect(result).not.toContain('200 kg')
		expect(result).not.toContain('70 kg')
		expect(result).not.toContain('71 kg')
	})

	it('does not count an open live session, but says it is there', async () => {
		await start()
		const owner = await registerUser('owner@kus.app')
		await seedWorkout(owner, {
			date: daysAgo(owner, 0),
			weightKg: 90,
			source: 'LIVE',
			finishedAt: null,
		})
		fake.respond(createCompletion([getWorkouts({ days: 7 })]), createCompletion([REPLY]))

		await send(owner, MESSAGE_TEXT).expect(201)

		const result = requestText(1).slice(requestText(1).indexOf('"role":"tool"'))
		expect(result).toContain('No workouts in this period.')
		expect(result).toContain('An open session of today is not counted here')
		expect(result).not.toContain('90 kg')
	})

	it('cuts an end date in the future to today', async () => {
		await start()
		const owner = await registerUser('owner@kus.app')
		const today = daysAgo(owner, 0)
		fake.respond(
			createCompletion([getWorkouts({ days: 7, endDate: '2099-01-01' })]),
			createCompletion([REPLY]),
		)

		await send(owner, MESSAGE_TEXT).expect(201)

		expect(requestText(1)).toContain(`${daysAgo(owner, 6)}…${today} (7 days)`)
	})

	it('answers 93 days as an error result the model can fix, without reading', async () => {
		await start()
		const owner = await registerUser('owner@kus.app')
		fake.respond(createCompletion([getWorkouts({ days: 93 })]), createCompletion([REPLY]))

		await send(owner, MESSAGE_TEXT).expect(201)

		expect(requestText(1)).toContain('error: invalid arguments')
	})
})
