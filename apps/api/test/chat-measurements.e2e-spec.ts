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

import { addDays, formatDbDate, getLocalDate } from '../src/common/time'
import { MeasurementKind, MeasurementSource } from '../src/generated/prisma/client'
import { createCompletion, createFakeAiClient } from '../src/modules/ai/ai.test-utils'
import type { PrismaService } from '../src/prisma'
import { createDbTestApp } from './create-db-test-app'

const MESSAGES_URL = '/api/v1/messages'
const sendResponseSchema = createDataResponseSchema(sendMessageResponseSchema)

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

describe('weight and waist from chat (e2e, real DB, fake model)', () => {
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

	const send = (user: TestUser, text: string) =>
		user.agent.post(MESSAGES_URL).send({ clientMessageId: randomUUID(), text })

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

	const findWeights = (userId: string) =>
		prisma.measurement.findMany({ where: { userId, kind: MeasurementKind.WEIGHT } })

	afterEach(async () => {
		await app.close()
	})

	afterAll(() => {
		for (const spy of logSpies) spy.mockRestore()
	})

	it('records a weight and a waist sent with a reply', async () => {
		await start()
		const owner = await registerUser('owner@kus.app')
		fake.respond(
			createCompletion([
				measurementCall({ value: 82.4 }),
				measurementCall({ kind: 'WAIST', value: 94 }),
				replyCall,
			]),
		)

		const response = await send(owner, 'вага 82,4, талія 94').expect(201)

		const { data } = sendResponseSchema.parse(response.body)
		const rows = await prisma.measurement.findMany({ where: { userId: owner.userId } })
		expect(rows.map((row) => [row.kind, row.value.toNumber()]).sort()).toEqual([
			['WAIST', 94],
			['WEIGHT', 82.4],
		])
		expect(rows.every((row) => row.source === MeasurementSource.CHAT)).toBe(true)
		expect(rows.every((row) => row.messageId === data.userMessage.id)).toBe(true)
	})

	it('records a weight together with food', async () => {
		await start()
		const owner = await registerUser('owner@kus.app')
		fake.respond(
			createCompletion([
				{ name: 'log_food', args: { items: [EGG], mealType: null, reply: 'Записав!' } },
				measurementCall({ value: 82.4 }),
			]),
		)

		await send(owner, '2 яйця, вага 82,4').expect(201)

		expect(await prisma.foodEntry.count({ where: { userId: owner.userId } })).toBe(1)
		expect((await findWeights(owner.userId)).map((row) => row.value.toNumber())).toEqual([82.4])
	})

	it('replaces the value of the same day when it is fixed', async () => {
		await start()
		const owner = await registerUser('owner@kus.app')
		fake.respond(
			createCompletion([measurementCall({ value: 82.4 }), replyCall]),
			createCompletion([measurementCall({ value: 82.6 }), replyCall]),
		)

		await send(owner, 'вага 82,4').expect(201)
		const second = sendResponseSchema.parse((await send(owner, 'ні, 82,6').expect(201)).body).data

		const rows = await findWeights(owner.userId)
		expect(rows).toHaveLength(1)
		expect(rows[0]?.value.toNumber()).toBe(82.6)
		expect(rows[0]?.messageId).toBe(second.userMessage.id)
	})

	it('puts a past day on that date', async () => {
		await start()
		const owner = await registerUser('owner@kus.app')
		const yesterday = addDays(await getToday(owner.userId), -1)
		fake.respond(
			createCompletion([measurementCall({ value: 83, date: formatDbDate(yesterday) }), replyCall]),
		)

		await send(owner, 'вчора важив 83').expect(201)

		const [row] = await findWeights(owner.userId)
		expect(row?.localDate.getTime()).toBe(yesterday.getTime())
	})

	it('stamps a past day at noon of that day and today at the moment of the message', async () => {
		await start()
		const owner = await registerUser('owner@kus.app')
		const { timezone } = await prisma.user.findUniqueOrThrow({ where: { id: owner.userId } })
		const today = await getToday(owner.userId)
		const yesterday = addDays(today, -1)
		fake.respond(
			createCompletion([measurementCall({ value: 83, date: formatDbDate(yesterday) }), replyCall]),
			createCompletion([measurementCall({ kind: 'WAIST', value: 94 }), replyCall]),
		)

		const before = Date.now()
		await send(owner, 'вчора важив 83').expect(201)
		await send(owner, 'талія 94').expect(201)

		const weight = await prisma.measurement.findFirstOrThrow({
			where: { userId: owner.userId, kind: MeasurementKind.WEIGHT },
		})
		const waist = await prisma.measurement.findFirstOrThrow({
			where: { userId: owner.userId, kind: MeasurementKind.WAIST },
		})
		expect(getLocalDate(weight.measuredAt, timezone).getTime()).toBe(yesterday.getTime())
		expect(
			Number(
				weight.measuredAt.toLocaleString('en-GB', {
					timeZone: timezone,
					hour: '2-digit',
					hour12: false,
				}),
			),
		).toBe(12)
		expect(waist.measuredAt.getTime()).toBeGreaterThanOrEqual(before)
		expect(waist.measuredAt.getTime()).toBeLessThanOrEqual(Date.now())
	})

	it('sends an out-of-range weight back to the model and logs nothing', async () => {
		await start()
		const owner = await registerUser('owner@kus.app')
		fake.respond(
			createCompletion([measurementCall({ value: 29.9 }), replyCall]),
			createCompletion([{ name: 'reply', args: { text: 'Перевір число' } }]),
		)

		const response = await send(owner, 'вага 29,9').expect(201)

		const { data } = sendResponseSchema.parse(response.body)
		expect(data.assistantMessage.content).toBe('Перевір число')
		expect(await findWeights(owner.userId)).toHaveLength(0)
		expect(JSON.stringify(fake.bodies[1])).toContain('outside 30–300 kg')
	})

	it('rejects a future date and a date more than 7 days back', async () => {
		await start()
		const owner = await registerUser('owner@kus.app')
		const today = await getToday(owner.userId)
		fake.respond(
			createCompletion([
				measurementCall({ value: 83, date: formatDbDate(addDays(today, 1)) }),
				replyCall,
			]),
			createCompletion([{ name: 'reply', args: { text: 'Завтра ще не настало' } }]),
			createCompletion([
				measurementCall({ value: 83, date: formatDbDate(addDays(today, -8)) }),
				replyCall,
			]),
			createCompletion([{ name: 'reply', args: { text: 'Лише останні 7 днів' } }]),
		)

		await send(owner, 'завтра 83').expect(201)
		await send(owner, 'вісім днів тому 83').expect(201)

		expect(await findWeights(owner.userId)).toHaveLength(0)
		expect(JSON.stringify(fake.bodies[1])).toContain('is in the future')
		expect(JSON.stringify(fake.bodies[3])).toContain('days back')
	})

	it('does not ask to confirm a big change of the waist', async () => {
		await start()
		const owner = await registerUser('owner@kus.app')
		const today = await getToday(owner.userId)
		await prisma.measurement.create({
			data: {
				userId: owner.userId,
				kind: MeasurementKind.WAIST,
				value: 94,
				localDate: addDays(today, -2),
				measuredAt: addDays(today, -2),
				source: MeasurementSource.CHAT,
			},
		})
		fake.respond(createCompletion([measurementCall({ kind: 'WAIST', value: 110 }), replyCall]))

		await send(owner, 'талія 110').expect(201)

		expect(fake.bodies).toHaveLength(1)
		expect(await prisma.measurement.count({ where: { userId: owner.userId } })).toBe(2)
	})

	it('sends a jump of more than 3 kg back to the model and logs nothing', async () => {
		await start()
		const owner = await registerUser('owner@kus.app')
		await seedWeight(owner.userId, addDays(await getToday(owner.userId), -4), 82)
		fake.respond(
			createCompletion([measurementCall({ value: 87 }), replyCall]),
			createCompletion([{ name: 'reply', args: { text: 'Це точно 87?' } }]),
		)

		const response = await send(owner, 'вага 87').expect(201)

		const { data } = sendResponseSchema.parse(response.body)
		expect(data.assistantMessage.content).toBe('Це точно 87?')
		expect(await findWeights(owner.userId)).toHaveLength(1)
		expect(JSON.stringify(fake.bodies[1])).toContain('differs by 5.0 kg')
	})

	it('logs the jump once the model reports the user confirmed it', async () => {
		await start()
		const owner = await registerUser('owner@kus.app')
		await seedWeight(owner.userId, addDays(await getToday(owner.userId), -4), 82)
		fake.respond(createCompletion([measurementCall({ value: 87, confirmedJump: true }), replyCall]))

		await send(owner, 'так, 87').expect(201)

		expect(await findWeights(owner.userId)).toHaveLength(2)
	})

	it('compares a backdated weight with its neighbour in the database', async () => {
		await start()
		const owner = await registerUser('owner@kus.app')
		const today = await getToday(owner.userId)
		const yesterday = formatDbDate(addDays(today, -1))
		await seedWeight(owner.userId, addDays(today, -2), 82)
		fake.respond(
			createCompletion([measurementCall({ value: 87, date: yesterday }), replyCall]),
			createCompletion([{ name: 'reply', args: { text: 'Це точно 87?' } }]),
		)

		await send(owner, 'вчора 87').expect(201)

		expect(await findWeights(owner.userId)).toHaveLength(1)
		expect(JSON.stringify(fake.bodies[1])).toContain(
			`differs by 5.0 kg from 82 on ${formatDbDate(addDays(today, -2))}`,
		)

		fake.respond(
			createCompletion([
				measurementCall({ value: 87, date: yesterday, confirmedJump: true }),
				replyCall,
			]),
		)
		await send(owner, 'так, вчора 87').expect(201)

		const rows = await findWeights(owner.userId)
		expect(rows.map((row) => row.value.toNumber()).sort()).toEqual([82, 87])
	})

	it('does not compare with a weight older than the jump window', async () => {
		await start()
		const owner = await registerUser('owner@kus.app')
		await seedWeight(owner.userId, addDays(await getToday(owner.userId), -21), 90)
		fake.respond(createCompletion([measurementCall({ value: 86 }), replyCall]))

		await send(owner, 'вага 86').expect(201)

		expect(fake.bodies).toHaveLength(1)
		expect(await findWeights(owner.userId)).toHaveLength(2)
	})

	it('keeps weights of different users apart', async () => {
		await start()
		const owner = await registerUser('owner@kus.app')
		const other = await registerUser('other@kus.app')
		await seedWeight(other.userId, addDays(await getToday(other.userId), -1), 60)
		fake.respond(createCompletion([measurementCall({ value: 87 }), replyCall]))

		await send(owner, 'вага 87').expect(201)

		const context = JSON.stringify(fake.bodies[0])
		expect(context).toContain('Weight: none logged.')
		expect(context).not.toContain('60 kg')
		expect(await findWeights(owner.userId)).toHaveLength(1)
		expect((await findWeights(other.userId)).map((row) => row.value.toNumber())).toEqual([60])
	})
})
