import { randomUUID } from 'node:crypto'

import { Logger } from '@nestjs/common'
import type { NestExpressApplication } from '@nestjs/platform-express'
import {
	authSessionResponseSchema,
	chatMessageSchema,
	createCursorPaginatedResponseSchema,
	createDataResponseSchema,
	sendMessageResponseSchema,
	type SendMessageResponse,
} from '@kus/shared'
import request from 'supertest'
import type TestAgent from 'supertest/lib/agent'
import { afterAll, afterEach, describe, expect, it, vi } from 'vitest'

import { addDays, formatDbDate, getLocalDate } from '../src/common/time'
import { GoalType, MeasurementKind, MeasurementSource } from '../src/generated/prisma/client'
import { createCompletion, createFakeAiClient } from '../src/modules/ai/ai.test-utils'
import type { PrismaService } from '../src/prisma'
import { createDbTestApp } from './create-db-test-app'

const MESSAGES_URL = '/api/v1/messages'
const sendResponseSchema = createDataResponseSchema(sendMessageResponseSchema)
const listResponseSchema = createCursorPaginatedResponseSchema(chatMessageSchema)

const fake = createFakeAiClient()

interface TestUser {
	agent: TestAgent
	userId: string
}

const replyCall = { name: 'reply', args: { text: 'Записав' } }

const measurementCall = (args: Record<string, unknown>) => ({
	name: 'log_measurement',
	args: { kind: 'WEIGHT', date: null, confirmedJump: false, ...args },
})

const EGG = {
	name: 'Яйце варене',
	grams: 100,
	quantity: 2,
	kcal: 155,
	protein: 13,
	fat: 11,
	carbs: 1,
	fiber: null,
	category: 'eggs',
	source: 'REFERENCE',
	confidence: 0.9,
	assumption: null,
	memoryRef: null,
}

const logFoodCall = { name: 'log_food', args: { items: [EGG], mealType: null, reply: 'Записав!' } }

describe('measurement cards and achievements in chat messages (e2e, real DB, fake model)', () => {
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

	const send = async (
		user: TestUser,
		text: string,
		clientMessageId: string = randomUUID(),
	): Promise<SendMessageResponse> => {
		const response = await user.agent.post(MESSAGES_URL).send({ clientMessageId, text }).expect(201)
		return sendResponseSchema.parse(response.body).data
	}

	const getToday = async (userId: string): Promise<Date> => {
		const { timezone } = await prisma.user.findUniqueOrThrow({ where: { id: userId } })
		return getLocalDate(new Date(), timezone)
	}

	const seedWeight = (userId: string, localDate: Date, value: number) =>
		prisma.measurement.create({
			data: {
				userId,
				kind: MeasurementKind.WEIGHT,
				value,
				localDate,
				measuredAt: localDate,
				source: MeasurementSource.CHAT,
			},
		})

	const setGoal = (userId: string, goalType: GoalType, targetWeightKg: number) =>
		prisma.userProfile.upsert({
			where: { userId },
			create: { userId, goalType, targetWeightKg, paceKgPerWeek: 0.5 },
			update: { goalType, targetWeightKg, paceKgPerWeek: 0.5 },
		})

	/** A day with food, straight in the DB. */
	const seedFoodDay = async (userId: string, localDate: Date): Promise<void> => {
		const meal = await prisma.meal.create({
			data: { userId, type: 'LUNCH', localDate, eatenAt: addDays(localDate, 0) },
		})
		await prisma.foodEntry.create({
			data: {
				userId,
				mealId: meal.id,
				name: 'Обід',
				grams: 300,
				kcal: 500,
				proteinG: 25,
				fatG: 15,
				carbsG: 60,
				source: 'ESTIMATE',
				confidence: 0.5,
			},
		})
	}

	const seedFoodDaysBack = async (userId: string, days: number): Promise<void> => {
		const today = await getToday(userId)
		for (let back = 1; back <= days; back += 1) await seedFoodDay(userId, addDays(today, -back))
	}

	const findAchievements = (userId: string) =>
		prisma.achievement.findMany({ where: { userId }, orderBy: [{ type: 'asc' }, { value: 'asc' }] })

	afterEach(async () => {
		await app.close()
	})

	afterAll(() => {
		for (const spy of logSpies) spy.mockRestore()
	})

	describe('measurement cards', () => {
		it('puts the weight card into the reply with the comparisons and the chart', async () => {
			await start()
			const owner = await registerUser('owner@kus.app')
			const today = await getToday(owner.userId)
			await setGoal(owner.userId, GoalType.LOSE, 78)
			await seedWeight(owner.userId, addDays(today, -10), 90)
			fake.respond(createCompletion([measurementCall({ value: 82.4 }), replyCall]))

			const { assistantMessage, userMessage } = await send(owner, 'вага 82,4')

			expect(userMessage.measurements).toEqual([])
			expect(assistantMessage.measurements).toHaveLength(1)
			expect(assistantMessage.measurements[0]).toMatchObject({
				kind: 'WEIGHT',
				value: 82.4,
				localDate: formatDbDate(today),
				source: 'CHAT',
				fromStart: -7.6,
				toGoal: 4.4,
				isGoalReached: false,
				weekChange: null,
				planPaceKgPerWeek: 0.5,
				chart: [
					{ localDate: formatDbDate(addDays(today, -10)), value: 90 },
					{ localDate: formatDbDate(today), value: 82.4 },
				],
			})
		})

		it('measures from the first value ever written, not the earliest date', async () => {
			await start()
			const owner = await registerUser('owner@kus.app')
			const today = await getToday(owner.userId)
			await seedWeight(owner.userId, addDays(today, -2), 84)
			const backdated = formatDbDate(addDays(today, -5))
			fake.respond(createCompletion([measurementCall({ value: 83, date: backdated }), replyCall]))

			const { assistantMessage } = await send(owner, 'п’ять днів тому було 83')

			expect(assistantMessage.measurements[0]).toMatchObject({
				localDate: backdated,
				fromStart: -1,
			})
		})

		it('keeps the card and the event of a replayed clientMessageId', async () => {
			await start()
			const owner = await registerUser('owner@kus.app')
			const today = await getToday(owner.userId)
			await seedWeight(owner.userId, addDays(today, -10), 84)
			const clientMessageId = randomUUID()
			fake.respond(createCompletion([measurementCall({ value: 82.9 }), replyCall]))

			const first = await send(owner, 'вага 82,9', clientMessageId)
			const replay = await send(owner, 'вага 82,9', clientMessageId)

			expect(first.assistantMessage.achievements).toHaveLength(1)
			expect(replay.assistantMessage.measurements).toEqual(first.assistantMessage.measurements)
			expect(replay.assistantMessage.achievements).toEqual(first.assistantMessage.achievements)
			expect(replay.updatedMessages).toEqual([])
			expect(fake.bodies).toHaveLength(1)
			expect(await findAchievements(owner.userId)).toHaveLength(1)
		})

		it('takes the card off the earlier reply when the value is fixed', async () => {
			await start()
			const owner = await registerUser('owner@kus.app')
			fake.respond(
				createCompletion([measurementCall({ value: 82.4 }), replyCall]),
				createCompletion([measurementCall({ value: 82.6 }), replyCall]),
			)

			const first = await send(owner, 'вага 82,4')
			const second = await send(owner, 'ні, 82,6')

			expect(first.assistantMessage.measurements).toHaveLength(1)
			expect(second.assistantMessage.measurements[0]?.value).toBe(82.6)
			expect(second.updatedMessages).toHaveLength(1)
			expect(second.updatedMessages[0]).toMatchObject({
				id: first.assistantMessage.id,
				content: 'Записав',
				measurements: [],
			})
			const feed = listResponseSchema.parse(
				(await owner.agent.get(MESSAGES_URL).expect(200)).body,
			).data
			expect(feed.flatMap((message) => message.measurements.map((card) => card.value))).toEqual([
				82.6,
			])
		})

		it('shows each user only their own cards and achievements', async () => {
			await start()
			const owner = await registerUser('owner@kus.app')
			const other = await registerUser('other@kus.app')
			const today = await getToday(owner.userId)
			await seedWeight(owner.userId, addDays(today, -10), 84)
			fake.respond(createCompletion([measurementCall({ value: 82.9 }), replyCall]))
			const { userMessage, assistantMessage } = await send(owner, 'вага 82,9')
			// rows of the other user pointing at the owner's messages must never reach the owner's feed
			await prisma.measurement.create({
				data: {
					userId: other.userId,
					kind: MeasurementKind.WEIGHT,
					value: 60,
					localDate: today,
					measuredAt: new Date(),
					source: MeasurementSource.CHAT,
					messageId: userMessage.id,
				},
			})
			await prisma.achievement.create({
				data: {
					userId: other.userId,
					type: 'WEIGHT_KG_LOST',
					value: 9,
					achievedAt: new Date(),
					messageId: assistantMessage.id,
				},
			})

			const feed = listResponseSchema.parse(
				(await owner.agent.get(MESSAGES_URL).expect(200)).body,
			).data

			const reply = feed.find((message) => message.id === assistantMessage.id)
			expect(reply?.measurements.map((card) => card.value)).toEqual([82.9])
			expect(reply?.achievements.map((item) => item.value)).toEqual([1])
			const otherFeed = listResponseSchema.parse(
				(await other.agent.get(MESSAGES_URL).expect(200)).body,
			).data
			expect(otherFeed).toEqual([])
		})
	})

	describe('kg lost', () => {
		it('announces the first whole kilogram below the start, in the reply and the DB', async () => {
			await start()
			const owner = await registerUser('owner@kus.app')
			await seedWeight(owner.userId, addDays(await getToday(owner.userId), -10), 84)
			fake.respond(createCompletion([measurementCall({ value: 83 }), replyCall]))

			const { assistantMessage } = await send(owner, 'вага 83')

			expect(assistantMessage.achievements).toHaveLength(1)
			expect(assistantMessage.achievements[0]).toMatchObject({ type: 'WEIGHT_KG_LOST', value: 1 })
			const rows = await findAchievements(owner.userId)
			expect(rows.map((row) => [row.type, row.value, row.messageId])).toEqual([
				['WEIGHT_KG_LOST', 1, assistantMessage.id],
			])
		})

		it('does not announce a part of a kilogram', async () => {
			await start()
			const owner = await registerUser('owner@kus.app')
			await seedWeight(owner.userId, addDays(await getToday(owner.userId), -10), 84)
			fake.respond(createCompletion([measurementCall({ value: 83.1 }), replyCall]))

			const { assistantMessage } = await send(owner, 'вага 83,1')

			expect(assistantMessage.achievements).toEqual([])
			expect(await findAchievements(owner.userId)).toEqual([])
		})

		it('does not celebrate losing for the goal GAIN, but still shows the card', async () => {
			await start()
			const owner = await registerUser('owner@kus.app')
			const today = await getToday(owner.userId)
			await setGoal(owner.userId, GoalType.GAIN, 90)
			await seedWeight(owner.userId, addDays(today, -10), 84)
			fake.respond(createCompletion([measurementCall({ value: 82 }), replyCall]))

			const { assistantMessage } = await send(owner, 'вага 82')

			expect(assistantMessage.achievements).toEqual([])
			expect(assistantMessage.measurements[0]).toMatchObject({ toGoal: 8, isGoalReached: false })
			expect(await findAchievements(owner.userId)).toEqual([])
		})

		it('does not celebrate a waist, and does not repeat a kilogram already celebrated', async () => {
			await start()
			const owner = await registerUser('owner@kus.app')
			const today = await getToday(owner.userId)
			await seedWeight(owner.userId, addDays(today, -10), 84)
			fake.respond(
				createCompletion([measurementCall({ kind: 'WAIST', value: 90 }), replyCall]),
				createCompletion([measurementCall({ value: 83 }), replyCall]),
				createCompletion([measurementCall({ value: 83.2 }), replyCall]),
			)

			const waist = await send(owner, 'талія 90')
			const first = await send(owner, 'вага 83')
			const fixed = await send(owner, 'ні, 83,2')

			expect(waist.assistantMessage.achievements).toEqual([])
			expect(first.assistantMessage.achievements.map((item) => item.value)).toEqual([1])
			expect(fixed.assistantMessage.achievements).toEqual([])
			expect(await findAchievements(owner.userId)).toHaveLength(1)
		})

		it('stores every kilogram reached and announces the highest', async () => {
			await start()
			const owner = await registerUser('owner@kus.app')
			await seedWeight(owner.userId, addDays(await getToday(owner.userId), -10), 90)
			fake.respond(createCompletion([measurementCall({ value: 86.6 }), replyCall]))

			const { assistantMessage } = await send(owner, 'вага 86,6')

			expect(assistantMessage.achievements.map((item) => item.value)).toEqual([3])
			expect((await findAchievements(owner.userId)).map((row) => row.value)).toEqual([1, 2, 3])
		})
	})

	describe('food streak', () => {
		it('announces a streak of 3 days', async () => {
			await start()
			const owner = await registerUser('owner@kus.app')
			await seedFoodDaysBack(owner.userId, 2)
			fake.respond(createCompletion([logFoodCall]))

			const { assistantMessage } = await send(owner, '2 яйця')

			expect(assistantMessage.achievements).toHaveLength(1)
			expect(assistantMessage.achievements[0]).toMatchObject({ type: 'FOOD_STREAK', value: 3 })
			expect((await findAchievements(owner.userId)).map((row) => row.value)).toEqual([3])
		})

		it('does not announce a streak with a gap', async () => {
			await start()
			const owner = await registerUser('owner@kus.app')
			const today = await getToday(owner.userId)
			await seedFoodDay(owner.userId, addDays(today, -1))
			await seedFoodDay(owner.userId, addDays(today, -3))
			fake.respond(createCompletion([logFoodCall]))

			const { assistantMessage } = await send(owner, '2 яйця')

			expect(assistantMessage.achievements).toEqual([])
			expect(await findAchievements(owner.userId)).toEqual([])
		})

		it('stores 3, 7 and 14 for a streak of 20 and announces only 14', async () => {
			await start()
			const owner = await registerUser('owner@kus.app')
			await seedFoodDaysBack(owner.userId, 19)
			fake.respond(createCompletion([logFoodCall]))

			const { assistantMessage } = await send(owner, '2 яйця')

			expect(assistantMessage.achievements.map((item) => item.value)).toEqual([14])
			const rows = await findAchievements(owner.userId)
			expect(rows.map((row) => row.value)).toEqual([3, 7, 14])
			expect(rows.filter((row) => row.messageId !== null).map((row) => row.value)).toEqual([14])
		})

		it('does not check the streak on a reply that only records a weight', async () => {
			await start()
			const owner = await registerUser('owner@kus.app')
			const today = await getToday(owner.userId)
			await seedFoodDaysBack(owner.userId, 2)
			await seedFoodDay(owner.userId, today)
			fake.respond(createCompletion([measurementCall({ value: 82 }), replyCall]))

			const { assistantMessage } = await send(owner, 'вага 82')

			expect(assistantMessage.achievements).toEqual([])
			expect(await findAchievements(owner.userId)).toEqual([])
		})

		it('announces both a streak and a lost kilogram from one turn', async () => {
			await start()
			const owner = await registerUser('owner@kus.app')
			const today = await getToday(owner.userId)
			await seedFoodDaysBack(owner.userId, 2)
			await seedWeight(owner.userId, addDays(today, -10), 84)
			fake.respond(createCompletion([logFoodCall, measurementCall({ value: 83 })]))

			const { assistantMessage } = await send(owner, '2 яйця, вага 83')

			expect(assistantMessage.achievements.map((item) => [item.type, item.value]).sort()).toEqual([
				['FOOD_STREAK', 3],
				['WEIGHT_KG_LOST', 1],
			])
		})

		it('completes a streak when an entry is brought back, but not when one is deleted', async () => {
			await start()
			const owner = await registerUser('owner@kus.app')
			await seedFoodDaysBack(owner.userId, 2)
			fake.respond(
				createCompletion([logFoodCall]),
				createCompletion([{ name: 'delete_entry', args: { refs: ['e1'] } }, replyCall]),
				createCompletion([{ name: 'restore_entry', args: { refs: ['e1'] } }, replyCall]),
			)
			await send(owner, '2 яйця')
			// the streak was announced once; forget it to see whether a later turn checks again
			await prisma.achievement.deleteMany({ where: { userId: owner.userId } })

			const deleted = await send(owner, 'видали')
			expect(deleted.assistantMessage.achievements).toEqual([])
			expect(await findAchievements(owner.userId)).toEqual([])

			const { assistantMessage } = await send(owner, 'поверни')

			expect(assistantMessage.achievements.map((item) => item.value)).toEqual([3])
			expect((await findAchievements(owner.userId)).map((row) => row.value)).toEqual([3])
		})

		it('gives one achievement to two parallel turns', async () => {
			await start()
			const owner = await registerUser('owner@kus.app')
			await seedFoodDaysBack(owner.userId, 2)
			fake.respond(createCompletion([logFoodCall]), createCompletion([logFoodCall]))

			const [first, second] = await Promise.all([send(owner, '2 яйця'), send(owner, '2 яйця')])

			const announced = [first, second].flatMap((turn) => turn.assistantMessage.achievements)
			expect(announced).toHaveLength(1)
			expect(announced[0]).toMatchObject({ type: 'FOOD_STREAK', value: 3 })
			expect(await findAchievements(owner.userId)).toHaveLength(1)
		})
	})
})
