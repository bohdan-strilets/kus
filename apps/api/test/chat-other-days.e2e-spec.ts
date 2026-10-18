import { randomUUID } from 'node:crypto'

import { Logger } from '@nestjs/common'
import type { NestExpressApplication } from '@nestjs/platform-express'
import {
	authSessionResponseSchema,
	createDataResponseSchema,
	sendMessageResponseSchema,
} from '@kus/shared'
import request from 'supertest'
import type TestAgent from 'supertest/lib/agent'
import { afterAll, afterEach, describe, expect, it, vi } from 'vitest'

import { addDays, formatDbDate, getLocalDate, getZonedMoment } from '../src/common/time'
import { createCompletion, createFakeAiClient, SOUP_ITEM } from '../src/modules/ai/ai.test-utils'
import { TYPICAL_MEAL_HOUR } from '../src/modules/entries/meal-type'
import type { PrismaService } from '../src/prisma'
import { createDbTestApp } from './create-db-test-app'

const MESSAGES_URL = '/api/v1/messages'
const sendResponseSchema = createDataResponseSchema(sendMessageResponseSchema)

const fake = createFakeAiClient()

interface TestUser {
	agent: TestAgent
	userId: string
	timezone: string
}

const logFood = (items: unknown[], date: string | null = null) => ({
	name: 'log_food',
	args: { items, date, mealType: null, reply: 'Записав!' },
})

const dated = (item: typeof SOUP_ITEM, date: string | null, mealType: string | null = null) => ({
	...item,
	date,
	mealType,
})

describe('food and measurements on other days (e2e, real DB, fake model)', () => {
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

	const send = (user: TestUser, text: string, clientMessageId: string = randomUUID()) =>
		user.agent.post(MESSAGES_URL).send({ clientMessageId, text })

	const getToday = (user: TestUser): Date => getLocalDate(new Date(), user.timezone)

	afterEach(async () => {
		await app.close()
	})

	afterAll(() => {
		for (const spy of logSpies) spy.mockRestore()
	})

	it('logs yesterday into yesterday’s meal at its typical hour and keeps today in the header', async () => {
		await start()
		const owner = await registerUser('owner@kus.app')
		const yesterday = addDays(getToday(owner), -1)
		fake.respond(createCompletion([logFood([dated(SOUP_ITEM, formatDbDate(yesterday), 'DINNER')])]))

		const response = await send(owner, 'вчора на вечерю суп').expect(201)

		const { data } = sendResponseSchema.parse(response.body)
		const meal = await prisma.meal.findFirstOrThrow({ where: { userId: owner.userId } })
		expect(meal.localDate.getTime()).toBe(yesterday.getTime())
		expect(meal.eatenAt.getTime()).toBe(
			getZonedMoment(yesterday, TYPICAL_MEAL_HOUR.DINNER, owner.timezone).getTime(),
		)
		expect(data.assistantMessage.meals.map(({ localDate }) => localDate)).toEqual([
			formatDbDate(yesterday),
		])
		expect(data.dayTotals.localDate).toBe(formatDbDate(getToday(owner)))
		expect(data.dayTotals.totals.kcal).toBe(0)
	})

	it('plans tomorrow: the meal lies in the future at the typical hour of tomorrow', async () => {
		await start()
		const owner = await registerUser('owner@kus.app')
		const tomorrow = addDays(getToday(owner), 1)
		fake.respond(createCompletion([logFood([dated(SOUP_ITEM, formatDbDate(tomorrow), 'LUNCH')])]))

		const response = await send(owner, 'завтра на обід суп').expect(201)

		const { data } = sendResponseSchema.parse(response.body)
		const meal = await prisma.meal.findFirstOrThrow({ where: { userId: owner.userId } })
		expect(meal.localDate.getTime()).toBe(tomorrow.getTime())
		expect(meal.eatenAt.getTime()).toBe(
			getZonedMoment(tomorrow, TYPICAL_MEAL_HOUR.LUNCH, owner.timezone).getTime(),
		)
		expect(meal.eatenAt.getTime()).toBeGreaterThan(Date.now())
		expect(data.dayTotals.totals.kcal).toBe(0)
	})

	it('splits one message over days: today counts in the header, yesterday does not', async () => {
		await start()
		const owner = await registerUser('owner@kus.app')
		const yesterday = addDays(getToday(owner), -1)
		fake.respond(
			createCompletion([
				logFood([
					dated(SOUP_ITEM, formatDbDate(yesterday), 'DINNER'),
					dated({ ...SOUP_ITEM, name: 'Каша' }, null, 'BREAKFAST'),
				]),
			]),
		)

		const response = await send(owner, 'вчора на вечерю суп, сьогодні на сніданок каша').expect(201)

		const { data } = sendResponseSchema.parse(response.body)
		const meals = await prisma.meal.findMany({
			where: { userId: owner.userId },
			orderBy: { localDate: 'asc' },
		})
		expect(meals.map(({ localDate, type }) => [formatDbDate(localDate), type])).toEqual([
			[formatDbDate(yesterday), 'DINNER'],
			[formatDbDate(getToday(owner)), 'BREAKFAST'],
		])
		expect(data.assistantMessage.meals.map(({ localDate }) => localDate)).toEqual([
			formatDbDate(yesterday),
			formatDbDate(getToday(owner)),
		])
		expect(data.dayTotals.totals.kcal).toBe(SOUP_ITEM.kcal)
	})

	it('shows the header of the day the message was sent on when the answer is replayed', async () => {
		await start()
		const owner = await registerUser('owner@kus.app')
		const today = getToday(owner)
		const yesterday = addDays(today, -1)
		fake.respond(createCompletion([logFood([dated(SOUP_ITEM, formatDbDate(yesterday), 'DINNER')])]))
		const clientMessageId = randomUUID()
		await send(owner, 'вчора суп', clientMessageId).expect(201)
		// the message was sent two days ago: the replay after midnight must not look at the meal's day
		const sentAt = getZonedMoment(addDays(today, -2), 12, owner.timezone)
		await prisma.message.updateMany({
			where: { userId: owner.userId, clientMessageId },
			data: { createdAt: sentAt },
		})

		const replay = await send(owner, 'вчора суп', clientMessageId).expect(201)

		const { data } = sendResponseSchema.parse(replay.body)
		expect(data.dayTotals.localDate).toBe(formatDbDate(addDays(today, -2)))
		expect(await prisma.foodEntry.count({ where: { userId: owner.userId } })).toBe(1)
	})

	it('runs a resent FAILED message on the clock of the message, not of the resend', async () => {
		await start()
		const owner = await registerUser('owner@kus.app')
		const today = getToday(owner)
		const yesterday = addDays(today, -1)
		const clientMessageId = randomUUID()
		fake.respond(new Error('network down'), createCompletion([logFood([SOUP_ITEM])]))
		await send(owner, 'суп', clientMessageId).expect(503)
		// "sent" yesterday at noon, resent after midnight
		await prisma.message.updateMany({
			where: { userId: owner.userId, clientMessageId },
			data: { createdAt: getZonedMoment(yesterday, 12, owner.timezone) },
		})

		const retry = await send(owner, 'суп', clientMessageId).expect(201)

		const { data } = sendResponseSchema.parse(retry.body)
		const meal = await prisma.meal.findFirstOrThrow({ where: { userId: owner.userId } })
		expect(meal.localDate.getTime()).toBe(yesterday.getTime())
		expect(meal.type).toBe('LUNCH')
		expect(data.dayTotals.localDate).toBe(formatDbDate(yesterday))
		// the model was told the day of the message as "today"
		const lastBody = JSON.stringify(fake.bodies.at(-1))
		expect(lastBody).toContain(`${formatDbDate(yesterday)} 12:00`)
	})

	it('shows the model entries of other days logged today, with their date', async () => {
		await start()
		const owner = await registerUser('owner@kus.app')
		const yesterday = addDays(getToday(owner), -1)
		fake.respond(
			createCompletion([logFood([dated(SOUP_ITEM, formatDbDate(yesterday), 'DINNER')])]),
			createCompletion([{ name: 'reply', args: { text: 'Ок' } }]),
		)
		await send(owner, 'вчора суп').expect(201)

		await send(owner, 'дякую').expect(201)

		const context = JSON.stringify(fake.bodies.at(-1))
		expect(context).toContain(`e1 DINNER ${formatDbDate(yesterday)} `)
		expect(context).toContain('Days: ')
	})

	it('deletes a listed weight on request and returns its card as deleted', async () => {
		await start()
		const owner = await registerUser('owner@kus.app')
		const yesterday = formatDbDate(addDays(getToday(owner), -1))
		fake.respond(
			createCompletion([
				{
					name: 'log_measurement',
					args: { kind: 'WEIGHT', value: 83, date: yesterday, confirmedJump: false },
				},
				{ name: 'reply', args: { text: 'Записав' } },
			]),
			createCompletion([
				{ name: 'delete_measurement', args: { kind: 'WEIGHT', date: yesterday } },
				{ name: 'reply', args: { text: 'Видалив' } },
			]),
		)
		const first = sendResponseSchema.parse((await send(owner, 'вчора важив 83').expect(201)).body)

		const response = await send(owner, 'видали вагу за вчора').expect(201)

		const { data } = sendResponseSchema.parse(response.body)
		const row = await prisma.measurement.findFirstOrThrow({ where: { userId: owner.userId } })
		expect(row.deletedAt).not.toBeNull()
		const updated = data.updatedMessages.find(
			({ replyToId }) => replyToId === first.data.userMessage.id,
		)
		expect(updated?.measurements.map(({ isDeleted }) => isDeleted)).toEqual([true])
	})
})
