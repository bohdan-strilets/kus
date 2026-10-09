import { randomUUID } from 'node:crypto'

import { Logger } from '@nestjs/common'
import type { NestExpressApplication } from '@nestjs/platform-express'
import {
	apiErrorResponseSchema,
	authSessionResponseSchema,
	chatMessageSchema,
	createCursorPaginatedResponseSchema,
	createDataResponseSchema,
	dayResponseSchema,
	type FoodEntryResponse,
	foodEntryResponseSchema,
	sendMessageResponseSchema,
} from '@kus/shared'
import request from 'supertest'
import type TestAgent from 'supertest/lib/agent'
import { afterAll, afterEach, describe, expect, it, vi } from 'vitest'

import { getLocalDateString } from '../src/common/time'
import {
	createCompletion,
	createFakeAiClient,
	EGGS_AND_BUCKWHEAT_ITEMS,
	logFoodCall,
	SOUP_ITEM,
	soupClarifyCall,
} from '../src/modules/ai/ai.test-utils'
import type { PrismaService } from '../src/prisma'
import { createDbTestApp } from './create-db-test-app'

const MESSAGES_URL = '/api/v1/messages'
const entryUrl = (id: string): string => `/api/v1/food-entries/${id}`
const dayUrl = (localDate: string): string => `/api/v1/days/${localDate}`
const TIMEZONE = 'Europe/Warsaw'

const sendResponseSchema = createDataResponseSchema(sendMessageResponseSchema)
const entryResponseSchema = createDataResponseSchema(foodEntryResponseSchema)
const dayResponse = createDataResponseSchema(dayResponseSchema)
const feedResponseSchema = createCursorPaginatedResponseSchema(chatMessageSchema)

const fake = createFakeAiClient()

interface TestUser {
	agent: TestAgent
	userId: string
}

describe('food entries edit sheet (e2e, real DB, fake model)', () => {
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

	/** Logs the items and returns the reply's entries, as the chat card and the sheet get them. */
	const log = async (user: TestUser, items: unknown[] = EGGS_AND_BUCKWHEAT_ITEMS) => {
		fake.respond(createCompletion([logFoodCall(items)]))
		const response = await user.agent
			.post(MESSAGES_URL)
			.send({ clientMessageId: randomUUID(), text: 'їжа' })
			.expect(201)
		const { assistantMessage } = sendResponseSchema.parse(response.body).data
		const entries = assistantMessage.meals.flatMap((meal) => meal.entries)
		return { replyId: assistantMessage.id, entries }
	}

	const getDay = async (user: TestUser) =>
		dayResponse.parse((await user.agent.get(dayUrl(today())).expect(200)).body).data

	const patch = async (user: TestUser, id: string, body: object): Promise<FoodEntryResponse> => {
		const response = await user.agent.patch(entryUrl(id)).send(body).expect(200)
		return entryResponseSchema.parse(response.body).data
	}

	afterEach(async () => {
		await app.close()
	})

	afterAll(() => {
		for (const spy of logSpies) spy.mockRestore()
	})

	it('rescales the entry by density, keeps a correction and marks it edited', async () => {
		await start()
		const owner = await registerUser('owner@kus.app')
		const { replyId, entries } = await log(owner)
		const buckwheat = entries[1]
		if (!buckwheat) throw new Error('No buckwheat logged')

		const updated = await patch(owner, buckwheat.id, { grams: 150 })

		expect(updated).toMatchObject({
			id: buckwheat.id,
			grams: 150,
			kcal: 165,
			protein: 6.3,
			carbs: 29.9,
			isEdited: true,
			source: 'REFERENCE',
		})
		const day = await getDay(owner)
		expect(day.totals.kcal).toBe(233 + 165)
		expect(day.meals[0]?.entries.map((entry) => entry.kcal)).toEqual([233, 165])
		const correction = await prisma.correction.findFirstOrThrow()
		expect(correction.before).toMatchObject({ grams: 100, kcal: 110 })
		expect(correction.after).toMatchObject({ grams: 150, kcal: 165 })
		// the chat card tells the change too
		const feed = feedResponseSchema.parse((await owner.agent.get(MESSAGES_URL).expect(200)).body)
		const reply = feed.data.find((message) => message.id === replyId)
		expect(reply?.meals[0]?.entries[1]).toMatchObject({ grams: 150, isEdited: true })
		expect(reply?.meals[0]?.totals.kcal).toBe(233 + 165)
	})

	it('moves the entry to another meal of the day; the meal it leaves empty disappears', async () => {
		await start()
		const owner = await registerUser('owner@kus.app')
		const { replyId, entries } = await log(owner, [SOUP_ITEM])
		const soup = entries[0]
		if (!soup) throw new Error('No soup logged')
		const before = await getDay(owner)
		const fromType = before.meals[0]?.type
		const toType = fromType === 'DINNER' ? 'BREAKFAST' : 'DINNER'

		const updated = await patch(owner, soup.id, { mealType: toType })

		expect(updated).toMatchObject({ id: soup.id, grams: 300, kcal: 150, isEdited: true })
		const day = await getDay(owner)
		expect(day.meals.map((meal) => meal.type)).toEqual([toType])
		expect(day.meals[0]?.entries.map((entry) => entry.id)).toEqual([soup.id])
		expect(day.totals.kcal).toBe(150)
		// the typical hour of a meal already past today, never the future
		expect(Date.parse(day.meals[0]?.eatenAt ?? '')).toBeLessThanOrEqual(Date.now())
		const correction = await prisma.correction.findFirstOrThrow()
		expect(correction.before).toEqual({ mealType: fromType })
		expect(correction.after).toEqual({ mealType: toType })
		// the chat card follows the entry into its new meal
		const feed = feedResponseSchema.parse((await owner.agent.get(MESSAGES_URL).expect(200)).body)
		const reply = feed.data.find((message) => message.id === replyId)
		expect(reply?.meals.map((meal) => meal.type)).toEqual([toType])
	})

	it('changes the weight and the meal at once; an unchanged request writes nothing', async () => {
		await start()
		const owner = await registerUser('owner@kus.app')
		const { entries } = await log(owner, [SOUP_ITEM])
		const soup = entries[0]
		if (!soup) throw new Error('No soup logged')
		const { meals } = await getDay(owner)
		const toType = meals[0]?.type === 'LUNCH' ? 'SNACK' : 'LUNCH'

		await patch(owner, soup.id, { grams: 600, mealType: toType })
		const same = await patch(owner, soup.id, { grams: 600, mealType: toType })

		expect(same).toMatchObject({ grams: 600, kcal: 300 })
		const day = await getDay(owner)
		expect(day.meals.map((meal) => meal.type)).toEqual([toType])
		expect(day.totals.kcal).toBe(300)
		expect(await prisma.correction.count()).toBe(2)
	})

	it('soft-deletes the entry: gone from the day and the card, kept in the table', async () => {
		await start()
		const owner = await registerUser('owner@kus.app')
		const { replyId, entries } = await log(owner)
		const eggs = entries[0]
		if (!eggs) throw new Error('No eggs logged')

		await owner.agent.delete(entryUrl(eggs.id)).expect(204)

		const day = await getDay(owner)
		expect(day.meals[0]?.entries.map((entry) => entry.name)).toEqual(['Гречка варена'])
		expect(day.totals.kcal).toBe(110)
		const stored = await prisma.foodEntry.findUniqueOrThrow({ where: { id: eggs.id } })
		expect(stored.deletedAt).not.toBeNull()
		const correction = await prisma.correction.findFirstOrThrow()
		expect(correction.after).toEqual({ deleted: true })
		const feed = feedResponseSchema.parse((await owner.agent.get(MESSAGES_URL).expect(200)).body)
		const reply = feed.data.find((message) => message.id === replyId)
		expect(reply?.meals[0]?.entries).toHaveLength(1)
		// a second delete finds nothing active
		await owner.agent.delete(entryUrl(eggs.id)).expect(404)
	})

	it('dismisses an open question about the entry it changes or deletes', async () => {
		await start()
		const owner = await registerUser('owner@kus.app')
		fake.respond(createCompletion([logFoodCall([SOUP_ITEM]), soupClarifyCall]))
		const response = await owner.agent
			.post(MESSAGES_URL)
			.send({ clientMessageId: randomUUID(), text: 'тарілка супу' })
			.expect(201)
		const { assistantMessage } = sendResponseSchema.parse(response.body).data
		const clarificationId = assistantMessage.clarifications[0]?.id ?? ''
		const soupId = assistantMessage.meals[0]?.entries[0]?.id ?? ''

		await patch(owner, soupId, { grams: 200 })

		const clarification = await prisma.clarification.findUniqueOrThrow({
			where: { id: clarificationId },
		})
		expect(clarification.status).toBe('DISMISSED')
		await owner.agent
			.post(`/api/v1/clarifications/${clarificationId}/answer`)
			.send({ optionIndex: 1 })
			.expect(409)
		const entry = await prisma.foodEntry.findFirstOrThrow()
		expect(entry).toMatchObject({ grams: 200, kcal: 100 })
	})

	it('validates the body and the id, and requires auth', async () => {
		await start()
		const owner = await registerUser('owner@kus.app')
		const { entries } = await log(owner, [SOUP_ITEM])
		const soupId = entries[0]?.id ?? ''

		const empty = await owner.agent.patch(entryUrl(soupId)).send({}).expect(422)
		expect(apiErrorResponseSchema.parse(empty.body)).toMatchObject({
			errorCode: 'VALIDATION_ERROR',
			details: { fields: { _root: 'NOTHING_TO_CHANGE' } },
		})
		const tooHeavy = await owner.agent.patch(entryUrl(soupId)).send({ grams: 5001 }).expect(422)
		expect(apiErrorResponseSchema.parse(tooHeavy.body).details).toEqual({
			fields: { grams: 'TOO_LARGE' },
		})
		const other = await owner.agent.patch(entryUrl(soupId)).send({ mealType: 'OTHER' }).expect(422)
		expect(apiErrorResponseSchema.parse(other.body).details).toEqual({
			fields: { mealType: 'INVALID_VALUE' },
		})
		await owner.agent.patch(entryUrl('not-a-uuid')).send({ grams: 100 }).expect(422)
		const missing = await owner.agent.patch(entryUrl(randomUUID())).send({ grams: 100 }).expect(404)
		expect(apiErrorResponseSchema.parse(missing.body).errorCode).toBe('ENTRY_NOT_FOUND')
		await owner.agent.delete(entryUrl(randomUUID())).expect(404)

		const server = app.getHttpServer()
		await request(server).patch(entryUrl(soupId)).send({ grams: 100 }).expect(401)
		await request(server).delete(entryUrl(soupId)).expect(401)
		const entry = await prisma.foodEntry.findFirstOrThrow()
		expect(entry).toMatchObject({ grams: 300, deletedAt: null })
	})

	it("IDOR: another user's entry is not found, not changed, not deleted", async () => {
		await start()
		const owner = await registerUser('owner@kus.app')
		const stranger = await registerUser('stranger@kus.app')
		const { entries } = await log(owner, [SOUP_ITEM])
		const soupId = entries[0]?.id ?? ''

		const edit = await stranger.agent.patch(entryUrl(soupId)).send({ grams: 600 }).expect(404)
		expect(apiErrorResponseSchema.parse(edit.body).errorCode).toBe('ENTRY_NOT_FOUND')
		await stranger.agent.patch(entryUrl(soupId)).send({ mealType: 'DINNER' }).expect(404)
		await stranger.agent.delete(entryUrl(soupId)).expect(404)

		const entry = await prisma.foodEntry.findFirstOrThrow()
		expect(entry).toMatchObject({ userId: owner.userId, grams: 300, deletedAt: null })
		expect(await prisma.correction.count()).toBe(0)
		const strangerDay = await getDay(stranger)
		expect(strangerDay.meals).toEqual([])
	})
})
