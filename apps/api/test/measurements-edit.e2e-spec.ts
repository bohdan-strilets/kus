import { Logger } from '@nestjs/common'
import type { NestExpressApplication } from '@nestjs/platform-express'
import {
	authSessionResponseSchema,
	chatMessageSchema,
	createCursorPaginatedResponseSchema,
	createDataResponseSchema,
	measurementCardSchema,
} from '@kus/shared'
import request from 'supertest'
import type TestAgent from 'supertest/lib/agent'
import { afterAll, afterEach, describe, expect, it, vi } from 'vitest'

import { getLocalDate } from '../src/common/time'
import { MeasurementKind, MeasurementSource } from '../src/generated/prisma/client'
import { createFakeAiClient } from '../src/modules/ai/ai.test-utils'
import type { PrismaService } from '../src/prisma'
import { createDbTestApp } from './create-db-test-app'

const MESSAGES_URL = '/api/v1/messages'
const measurementUrl = (id: string): string => `/api/v1/measurements/${id}`
const UNKNOWN_ID = '00000000-0000-4000-8000-000000000000'

const cardResponseSchema = createDataResponseSchema(measurementCardSchema)
const feedSchema = createCursorPaginatedResponseSchema(chatMessageSchema)

const fake = createFakeAiClient()

interface TestUser {
	agent: TestAgent
	userId: string
}

describe('measurement edits (e2e, real DB)', () => {
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

	/** A weight recorded by a user message and announced by an assistant reply, as the chat does. */
	const seedWeightCard = async (user: TestUser, value = 84) => {
		const { timezone } = await prisma.user.findUniqueOrThrow({ where: { id: user.userId } })
		const localDate = getLocalDate(new Date(), timezone)
		const question = await prisma.message.create({
			data: { userId: user.userId, role: 'USER', content: 'weight', status: 'COMPLETED' },
		})
		await prisma.message.create({
			data: {
				userId: user.userId,
				role: 'ASSISTANT',
				content: 'Logged',
				status: 'COMPLETED',
				replyToId: question.id,
			},
		})
		return prisma.measurement.create({
			data: {
				userId: user.userId,
				kind: MeasurementKind.WEIGHT,
				value,
				localDate,
				measuredAt: new Date(),
				source: MeasurementSource.CHAT,
				messageId: question.id,
			},
		})
	}

	const getFeedCards = async (user: TestUser) => {
		const response = await user.agent.get(MESSAGES_URL).expect(200)
		return feedSchema.parse(response.body).data.flatMap((message) => message.measurements)
	}

	afterEach(async () => {
		await app.close()
	})

	afterAll(() => {
		for (const spy of logSpies) spy.mockRestore()
	})

	it('changes the value of the owner and marks the source as EDIT', async () => {
		await start()
		const owner = await registerUser('owner@kus.app')
		const row = await seedWeightCard(owner)

		const response = await owner.agent
			.patch(measurementUrl(row.id))
			.send({ value: 83.46 })
			.expect(200)

		expect(cardResponseSchema.parse(response.body).data).toMatchObject({
			id: row.id,
			value: 83.5,
			source: 'EDIT',
			isDeleted: false,
		})
		const stored = await prisma.measurement.findUniqueOrThrow({ where: { id: row.id } })
		expect(stored.source).toBe('EDIT')
		expect(stored.value.toNumber()).toBe(83.5)
		expect(stored.messageId).toBe(row.messageId)
	})

	it('answers 404 to another user on all three routes and changes nothing', async () => {
		await start()
		const owner = await registerUser('owner@kus.app')
		const other = await registerUser('other@kus.app')
		const row = await seedWeightCard(owner)

		for (const response of [
			await other.agent.patch(measurementUrl(row.id)).send({ value: 70 }),
			await other.agent.delete(measurementUrl(row.id)),
			await other.agent.post(`${measurementUrl(row.id)}/restore`),
		]) {
			expect(response.status).toBe(404)
			expect(response.body).toMatchObject({ errorCode: 'MEASUREMENT_NOT_FOUND' })
		}
		const stored = await prisma.measurement.findUniqueOrThrow({ where: { id: row.id } })
		expect(stored).toMatchObject({ source: 'CHAT', deletedAt: null })
		expect(stored.value.toNumber()).toBe(84)
	})

	it('answers 404 for an unknown id and 401 without a session', async () => {
		await start()
		const owner = await registerUser('owner@kus.app')

		await owner.agent.delete(measurementUrl(UNKNOWN_ID)).expect(404)
		await request(app.getHttpServer())
			.patch(measurementUrl(UNKNOWN_ID))
			.send({ value: 80 })
			.expect(401)
	})

	it.each([
		{ value: 29.9, code: 'TOO_SMALL' },
		{ value: 300.1, code: 'TOO_LARGE' },
	])('rejects $value kg with 422 on the value field', async ({ value, code }) => {
		await start()
		const owner = await registerUser('owner@kus.app')
		const row = await seedWeightCard(owner)

		const response = await owner.agent.patch(measurementUrl(row.id)).send({ value }).expect(422)

		expect(response.body).toMatchObject({
			errorCode: 'VALIDATION_ERROR',
			details: { fields: { value: code } },
		})
	})

	it('rejects a value that is not a positive number with 422', async () => {
		await start()
		const owner = await registerUser('owner@kus.app')
		const row = await seedWeightCard(owner)

		const response = await owner.agent.patch(measurementUrl(row.id)).send({ value: -5 }).expect(422)

		expect(response.body).toMatchObject({ errorCode: 'VALIDATION_ERROR' })
	})

	it('deletes softly: the chat card stays as deleted, restore brings it back', async () => {
		await start()
		const owner = await registerUser('owner@kus.app')
		const row = await seedWeightCard(owner)

		await owner.agent.delete(measurementUrl(row.id)).expect(204)

		expect(await getFeedCards(owner)).toMatchObject([{ id: row.id, isDeleted: true }])
		expect(
			await prisma.measurement.count({ where: { id: row.id, deletedAt: { not: null } } }),
		).toBe(1)

		const restored = await owner.agent.post(`${measurementUrl(row.id)}/restore`).expect(200)

		expect(cardResponseSchema.parse(restored.body).data).toMatchObject({
			id: row.id,
			isDeleted: false,
		})
		expect(await getFeedCards(owner)).toMatchObject([{ id: row.id, isDeleted: false }])
	})

	it('restores a value that was not deleted without changing it', async () => {
		await start()
		const owner = await registerUser('owner@kus.app')
		const row = await seedWeightCard(owner)

		const response = await owner.agent.post(`${measurementUrl(row.id)}/restore`).expect(200)

		expect(cardResponseSchema.parse(response.body).data).toMatchObject({
			id: row.id,
			value: 84,
			isDeleted: false,
		})
	})

	it('answers 404 to a second delete and to an edit of a deleted value', async () => {
		await start()
		const owner = await registerUser('owner@kus.app')
		const row = await seedWeightCard(owner)

		await owner.agent.delete(measurementUrl(row.id)).expect(204)

		await owner.agent.delete(measurementUrl(row.id)).expect(404)
		await owner.agent.patch(measurementUrl(row.id)).send({ value: 80 }).expect(404)
	})
})
