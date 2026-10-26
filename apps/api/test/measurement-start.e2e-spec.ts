import { randomUUID } from 'node:crypto'

import { Logger } from '@nestjs/common'
import type { NestExpressApplication } from '@nestjs/platform-express'
import {
	authSessionResponseSchema,
	createDataResponseSchema,
	progressResponseSchema,
	sendMessageResponseSchema,
	type ProgressResponse,
} from '@kus/shared'
import request from 'supertest'
import type TestAgent from 'supertest/lib/agent'
import { afterAll, afterEach, describe, expect, it, vi } from 'vitest'

import { addDays, formatDbDate, getLocalDate } from '../src/common/time'
import { MeasurementKind, MeasurementSource } from '../src/generated/prisma/client'
import { createCompletion, createFakeAiClient } from '../src/modules/ai/ai.test-utils'
import type { PrismaService } from '../src/prisma'
import { createDbTestApp } from './create-db-test-app'

const PROGRESS_URL = '/api/v1/progress'
const MESSAGES_URL = '/api/v1/messages'
const progressResponse = createDataResponseSchema(progressResponseSchema)
const sendResponseSchema = createDataResponseSchema(sendMessageResponseSchema)
const NOON_HOURS = 12

// The order the rows were WRITTEN in, fixed apart from the dates they are FOR (those are relative
// to today, so the 7/30/90-day windows behave as in production).
const FIRST_WRITTEN_AT = new Date('2026-10-13T15:26:53Z')
const BACKDATED_WRITTEN_AT = new Date('2026-10-13T15:27:57Z')
const LATER_WRITTEN_AT = new Date('2026-10-23T08:00:00Z')

const fake = createFakeAiClient()
const replyCall = { name: 'reply', args: { text: 'Записав' } }
const measurementCall = (args: Record<string, unknown>) => ({
	name: 'log_measurement',
	args: { kind: 'WEIGHT', date: null, confirmedJump: false, ...args },
})

interface TestUser {
	agent: TestAgent
	userId: string
}

describe('start of weight and waist for display (e2e, real DB)', () => {
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

	const getToday = async (userId: string): Promise<Date> => {
		const { timezone } = await prisma.user.findUniqueOrThrow({ where: { id: userId } })
		return getLocalDate(new Date(), timezone)
	}

	const seed = ({
		userId,
		kind,
		localDate,
		value,
		createdAt,
	}: {
		userId: string
		kind: MeasurementKind
		localDate: Date
		value: number
		createdAt: Date
	}) =>
		prisma.measurement.create({
			data: {
				userId,
				kind,
				value,
				localDate,
				measuredAt: new Date(localDate.getTime() + NOON_HOURS * 60 * 60 * 1000),
				source: MeasurementSource.CHAT,
				createdAt,
			},
		})

	const getProgress = async (user: TestUser, range?: number): Promise<ProgressResponse> => {
		const query = range === undefined ? '' : `?range=${range}`
		const response = await user.agent.get(`${PROGRESS_URL}${query}`).expect(200)
		return progressResponse.parse(response.body).data
	}

	const send = async (user: TestUser, text: string) => {
		const response = await user.agent
			.post(MESSAGES_URL)
			.send({ clientMessageId: randomUUID(), text })
			.expect(201)
		return sendResponseSchema.parse(response.body).data
	}

	/** Production's waist: 101 written first, then 102 for an earlier day a minute later, then two 99. */
	const seedBackdatedWaist = async (user: TestUser, { hasLastDay }: { hasLastDay: boolean }) => {
		const today = await getToday(user.userId)
		const waist = (daysBack: number, value: number, createdAt: Date) =>
			seed({
				userId: user.userId,
				kind: MeasurementKind.WAIST,
				localDate: addDays(today, -daysBack),
				value,
				createdAt,
			})
		await waist(13, 101, FIRST_WRITTEN_AT)
		await waist(17, 102, BACKDATED_WRITTEN_AT)
		await waist(3, 99, LATER_WRITTEN_AT)
		if (hasLastDay) await waist(1, 99, LATER_WRITTEN_AT)
		return today
	}

	afterEach(async () => {
		await app.close()
	})

	afterAll(() => {
		for (const spy of logSpies) spy.mockRestore()
	})

	describe('«Прогрес»', () => {
		it('starts the waist at the earliest day even when it was written a minute later', async () => {
			await start()
			const owner = await registerUser('owner@kus.app')
			const today = await seedBackdatedWaist(owner, { hasLastDay: true })

			const { waist } = await getProgress(owner, 30)

			expect(waist?.current).toEqual({ value: 99, localDate: formatDbDate(addDays(today, -1)) })
			expect(waist?.start).toEqual({ value: 102, localDate: formatDbDate(addDays(today, -17)) })
			expect(waist?.fromStart).toBe(-3)
		})

		it('does not depend on the range: the start is the same for 7 and 90 days', async () => {
			await start()
			const owner = await registerUser('owner@kus.app')
			await seedBackdatedWaist(owner, { hasLastDay: true })

			const [week, quarter] = await Promise.all([getProgress(owner, 7), getProgress(owner, 90)])

			expect(week.waist?.start).toEqual(quarter.waist?.start)
			expect(week.waist?.fromStart).toBe(-3)
			expect(quarter.waist?.fromStart).toBe(-3)
		})

		it('starts the weight at the earliest day too', async () => {
			await start()
			const owner = await registerUser('owner@kus.app')
			const today = await getToday(owner.userId)
			const weight = (daysBack: number, value: number, createdAt: Date) =>
				seed({
					userId: owner.userId,
					kind: MeasurementKind.WEIGHT,
					localDate: addDays(today, -daysBack),
					value,
					createdAt,
				})
			await weight(10, 90, FIRST_WRITTEN_AT)
			await weight(14, 92, BACKDATED_WRITTEN_AT)
			await weight(1, 88.4, LATER_WRITTEN_AT)

			const data = await getProgress(owner, 30)

			expect(data.weight?.start).toEqual({
				value: 92,
				localDate: formatDbDate(addDays(today, -14)),
			})
			expect(data.weight?.fromStart).toBe(-3.6)
		})

		it('keeps the old behaviour when the day order and the writing order agree', async () => {
			await start()
			const owner = await registerUser('owner@kus.app')
			const today = await getToday(owner.userId)
			const weight = (daysBack: number, value: number, createdAt: Date) =>
				seed({
					userId: owner.userId,
					kind: MeasurementKind.WEIGHT,
					localDate: addDays(today, -daysBack),
					value,
					createdAt,
				})
			await weight(16, 91, FIRST_WRITTEN_AT)
			await weight(5, 89.5, BACKDATED_WRITTEN_AT)
			await weight(1, 88.4, LATER_WRITTEN_AT)

			const data = await getProgress(owner, 30)

			expect(data.weight?.start).toEqual({
				value: 91,
				localDate: formatDbDate(addDays(today, -16)),
			})
			expect(data.weight?.fromStart).toBe(-2.6)
		})

		it('gives the start to the very first value only: fromStart is null at the start itself', async () => {
			await start()
			const owner = await registerUser('owner@kus.app')
			const today = await getToday(owner.userId)
			await seed({
				userId: owner.userId,
				kind: MeasurementKind.WAIST,
				localDate: today,
				value: 100,
				createdAt: FIRST_WRITTEN_AT,
			})

			const { waist } = await getProgress(owner)

			expect(waist?.start).toEqual({ value: 100, localDate: formatDbDate(today) })
			expect(waist?.fromStart).toBeNull()
		})

		it("ignores a deleted earliest value and another user's earlier value", async () => {
			await start()
			const owner = await registerUser('owner@kus.app')
			const other = await registerUser('other@kus.app')
			const today = await getToday(owner.userId)
			const waist = (userId: string, daysBack: number, value: number) =>
				seed({
					userId,
					kind: MeasurementKind.WAIST,
					localDate: addDays(today, -daysBack),
					value,
					createdAt: FIRST_WRITTEN_AT,
				})
			const deleted = await waist(owner.userId, 20, 110)
			await prisma.measurement.update({
				where: { id: deleted.id },
				data: { deletedAt: new Date() },
			})
			await waist(other.userId, 25, 120)
			await waist(owner.userId, 10, 100)
			await waist(owner.userId, 1, 98)

			const data = await getProgress(owner, 30)

			expect(data.waist?.start).toEqual({
				value: 100,
				localDate: formatDbDate(addDays(today, -10)),
			})
			expect(data.waist?.fromStart).toBe(-2)
		})
	})

	describe('«Прогрес»: changeSince for a single value in the range', () => {
		const cases = [
			['WAIST', MeasurementKind.WAIST],
			['WEIGHT', MeasurementKind.WEIGHT],
		] as const

		it.each(cases)(
			'%s: one value in 7 days and an earlier one outside give the change and its date',
			async (_name, kind) => {
				await start()
				const owner = await registerUser('owner@kus.app')
				const today = await getToday(owner.userId)
				const row = (daysBack: number, value: number) =>
					seed({
						userId: owner.userId,
						kind,
						localDate: addDays(today, -daysBack),
						value,
						createdAt: FIRST_WRITTEN_AT,
					})
				await row(30, 95)
				await row(10, 93)
				await row(2, 91.5)

				const data = await getProgress(owner, 7)
				const trend = kind === MeasurementKind.WAIST ? data.waist : data.weight

				expect(trend?.points).toHaveLength(1)
				expect(trend?.changeInRange).toBeNull()
				// the nearest earlier value (10 days back), not the oldest one
				expect(trend?.changeSince).toEqual({
					change: -1.5,
					sinceDate: formatDbDate(addDays(today, -10)),
				})
			},
		)

		it.each(cases)('%s: one value and nothing before the range gives null', async (_name, kind) => {
			await start()
			const owner = await registerUser('owner@kus.app')
			const today = await getToday(owner.userId)
			await seed({
				userId: owner.userId,
				kind,
				localDate: addDays(today, -2),
				value: 91.5,
				createdAt: FIRST_WRITTEN_AT,
			})

			const data = await getProgress(owner, 7)
			const trend = kind === MeasurementKind.WAIST ? data.waist : data.weight

			expect(trend?.points).toHaveLength(1)
			expect(trend?.changeSince).toBeNull()
		})

		it.each(cases)('%s: two values in the range give null', async (_name, kind) => {
			await start()
			const owner = await registerUser('owner@kus.app')
			const today = await getToday(owner.userId)
			for (const [daysBack, value] of [
				[10, 93],
				[4, 92],
				[1, 91],
			] as const) {
				await seed({
					userId: owner.userId,
					kind,
					localDate: addDays(today, -daysBack),
					value,
					createdAt: FIRST_WRITTEN_AT,
				})
			}

			const data = await getProgress(owner, 7)
			const trend = kind === MeasurementKind.WAIST ? data.waist : data.weight

			expect(trend?.changeInRange).toBe(-1)
			expect(trend?.changeSince).toBeNull()
		})
	})

	describe('chat card', () => {
		it('measures the waist from the earliest day, not from the first written value', async () => {
			await start()
			const owner = await registerUser('owner@kus.app')
			await seedBackdatedWaist(owner, { hasLastDay: false })
			fake.respond(createCompletion([measurementCall({ kind: 'WAIST', value: 99 }), replyCall]))

			const { assistantMessage } = await send(owner, 'талія 99')

			expect(assistantMessage.measurements).toHaveLength(1)
			expect(assistantMessage.measurements[0]).toMatchObject({
				kind: 'WAIST',
				value: 99,
				fromStart: -3,
			})
		})

		it('measures the weight from the earliest day too', async () => {
			await start()
			const owner = await registerUser('owner@kus.app')
			const today = await getToday(owner.userId)
			for (const [daysBack, value, createdAt] of [
				[10, 90, FIRST_WRITTEN_AT],
				[14, 92, BACKDATED_WRITTEN_AT],
			] as const) {
				await seed({
					userId: owner.userId,
					kind: MeasurementKind.WEIGHT,
					localDate: addDays(today, -daysBack),
					value,
					createdAt,
				})
			}
			fake.respond(createCompletion([measurementCall({ value: 88 }), replyCall]))

			const { assistantMessage } = await send(owner, 'вага 88')

			expect(assistantMessage.measurements[0]).toMatchObject({ value: 88, fromStart: -4 })
		})

		it('keeps the old fromStart when the order of days and of writing agree', async () => {
			await start()
			const owner = await registerUser('owner@kus.app')
			const today = await getToday(owner.userId)
			await seed({
				userId: owner.userId,
				kind: MeasurementKind.WEIGHT,
				localDate: addDays(today, -10),
				value: 91,
				createdAt: FIRST_WRITTEN_AT,
			})
			fake.respond(createCompletion([measurementCall({ value: 88.4 }), replyCall]))

			const { assistantMessage } = await send(owner, 'вага 88,4')

			expect(assistantMessage.measurements[0]).toMatchObject({ value: 88.4, fromStart: -2.6 })
		})
	})

	describe('achievements keep the creation-time base', () => {
		it('a weight with an earlier day written later does not move the kg-lost base', async () => {
			await start()
			const owner = await registerUser('owner@kus.app')
			const today = await getToday(owner.userId)
			await seed({
				userId: owner.userId,
				kind: MeasurementKind.WEIGHT,
				localDate: addDays(today, -3),
				value: 91,
				createdAt: FIRST_WRITTEN_AT,
			})
			// an earlier day, written later and higher: by day it would be the start (95)
			await seed({
				userId: owner.userId,
				kind: MeasurementKind.WEIGHT,
				localDate: addDays(today, -8),
				value: 95,
				createdAt: BACKDATED_WRITTEN_AT,
			})
			fake.respond(createCompletion([measurementCall({ value: 89.5 }), replyCall]))

			const { assistantMessage } = await send(owner, 'вага 89,5')

			const achievements = await prisma.achievement.findMany({
				where: { userId: owner.userId, type: 'WEIGHT_KG_LOST' },
			})
			// base 91 (first written): 1.5 kg lost = 1 whole kg; from 95 it would have been 5
			expect(achievements.map((item) => item.value)).toEqual([1])
			expect(assistantMessage.achievements.map((item) => item.value)).toEqual([1])
			// while the card shows the start by day
			expect(assistantMessage.measurements[0]?.fromStart).toBe(-5.5)
		})
	})
})
