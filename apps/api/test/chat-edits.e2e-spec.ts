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

import {
	createCompletion,
	createFakeAiClient,
	type FakeToolCall,
	logFoodCall,
	SOUP_ITEM,
	soupClarifyCall,
} from '../src/modules/ai/ai.test-utils'
import type { PrismaService } from '../src/prisma'
import { createDbTestApp } from './create-db-test-app'

const MESSAGES_URL = '/api/v1/messages'
const sendResponseSchema = createDataResponseSchema(sendMessageResponseSchema)

const fake = createFakeAiClient()

const BORSCHT_ITEM = {
	...SOUP_ITEM,
	name: 'Борщ',
	grams: 350,
	kcal: 175,
	protein: 7,
	fat: 8,
	carbs: 19,
	category: 'borscht',
}

const reply = (text: string): FakeToolCall => ({ name: 'reply', args: { text } })

interface TestUser {
	agent: TestAgent
	userId: string
}

describe('chat edits of logged food (e2e, real DB, fake model)', () => {
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

	const send = async (user: TestUser, text: string) => {
		const response = await user.agent
			.post(MESSAGES_URL)
			.send({ clientMessageId: randomUUID(), text })
			.expect(201)
		return sendResponseSchema.parse(response.body).data
	}

	afterEach(async () => {
		await app.close()
	})

	afterAll(() => {
		for (const spy of logSpies) spy.mockRestore()
	})

	it('rescales a portion by ref, keeps a correction and returns the refreshed old card', async () => {
		await start()
		const owner = await registerUser('owner@kus.app')
		fake.respond(
			createCompletion([logFoodCall([BORSCHT_ITEM])]),
			createCompletion([
				{ name: 'correct_entry', args: { changes: [{ ref: 'e1', grams: 600 }] } },
				reply('Змінив борщ на 600 г'),
			]),
		)
		const first = await send(owner, 'тарілка борщу')

		const second = await send(owner, 'зміни порцію на 600 г')

		expect(JSON.stringify(fake.bodies[1])).toContain('\\"Борщ\\": 350 g, 175 kcal')
		expect(second.assistantMessage).toMatchObject({ content: 'Змінив борщ на 600 г', meals: [] })
		expect(second.updatedMessages.map((message) => message.id)).toEqual([first.assistantMessage.id])
		expect(second.updatedMessages[0]?.meals[0]?.entries[0]).toMatchObject({
			grams: 600,
			kcal: 300,
			protein: 12,
			isEdited: true,
		})
		expect(second.dayTotals.totals.kcal).toBe(300)
		expect(await prisma.foodEntry.count()).toBe(1)
		const correction = await prisma.correction.findFirstOrThrow()
		expect(correction.before).toMatchObject({ grams: 350, kcal: 175 })
		expect(correction.after).toMatchObject({ grams: 600, kcal: 300 })
	})

	it('marks new values given in the chat as MANUAL, not the label they replaced', async () => {
		await start()
		const owner = await registerUser('owner@kus.app')
		const labelBar = {
			...BORSCHT_ITEM,
			name: 'Батончик',
			grams: 60,
			kcal: 240,
			protein: 20,
			fat: 8,
			carbs: 22,
			category: 'protein_bar',
			source: 'LABEL',
		}
		const values = { kcal: 200, protein: 15, fat: 6, carbs: 21.5, fiber: null }
		fake.respond(
			createCompletion([logFoodCall([labelBar])]),
			createCompletion([
				{ name: 'correct_entry', args: { changes: [{ ref: 'e1', values }] } },
				reply('Оновив батончик'),
			]),
		)
		await send(owner, 'батончик 60 г, на етикетці 400 ккал на 100 г')

		await send(owner, 'там було 200 ккал')

		const entry = await prisma.foodEntry.findFirstOrThrow()
		expect(entry).toMatchObject({ kcal: 200, source: 'MANUAL', isEdited: true })
	})

	it('keeps a different food the model estimated as ESTIMATE, not MANUAL', async () => {
		await start()
		const owner = await registerUser('owner@kus.app')
		const values = { kcal: 120, protein: 8, fat: 4, carbs: 13, fiber: null }
		fake.respond(
			createCompletion([logFoodCall([BORSCHT_ITEM])]),
			createCompletion([
				{
					name: 'correct_entry',
					args: { changes: [{ ref: 'e1', name: 'Суп курячий', category: 'soup', values }] },
				},
				reply('Змінив на курячий суп'),
			]),
		)
		await send(owner, 'тарілка борщу')

		await send(owner, 'це був не борщ, а курячий суп')

		const entry = await prisma.foodEntry.findFirstOrThrow()
		expect(entry).toMatchObject({ name: 'Суп курячий', category: 'soup', source: 'ESTIMATE' })
	})

	it('deletes an entry by ref and brings it back with restore_entry', async () => {
		await start()
		const owner = await registerUser('owner@kus.app')
		fake.respond(
			createCompletion([logFoodCall()]),
			createCompletion([{ name: 'delete_entry', args: { refs: ['e2'] } }, reply('Прибрав гречку')]),
			// active eggs are e1, the deleted buckwheat follows as e2
			createCompletion([{ name: 'restore_entry', args: { refs: ['e2'] } }, reply('Повернув')]),
		)
		await send(owner, '3 яйця і 100 г гречки')

		const deleted = await send(owner, 'видали гречку')

		expect(deleted.updatedMessages[0]?.meals[0]?.entries.map((entry) => entry.name)).toEqual([
			'Яйце варене',
		])
		expect(deleted.dayTotals.totals.kcal).toBe(233)

		const restored = await send(owner, 'поверни')

		expect(JSON.stringify(fake.bodies[2])).toContain('Deleted today')
		expect(restored.updatedMessages[0]?.meals[0]?.entries).toHaveLength(2)
		expect(restored.dayTotals.totals.kcal).toBe(343)
		const corrections = await prisma.correction.findMany({ orderBy: { createdAt: 'asc' } })
		expect(corrections.map((item) => item.after)).toEqual([{ deleted: true }, { deleted: false }])
	})

	it('refreshes every card of the meal, not only the one whose entry changed', async () => {
		await start()
		const owner = await registerUser('owner@kus.app')
		fake.respond(
			createCompletion([logFoodCall([BORSCHT_ITEM])]),
			createCompletion([logFoodCall([SOUP_ITEM])]),
			createCompletion([{ name: 'delete_entry', args: { refs: ['e1'] } }, reply('Прибрав борщ')]),
		)
		const first = await send(owner, 'тарілка борщу')
		const second = await send(owner, 'і тарілка супу')

		const deleted = await send(owner, 'видали борщ')

		expect(deleted.updatedMessages.map((message) => message.id).sort()).toEqual(
			[first.assistantMessage.id, second.assistantMessage.id].sort(),
		)
		const soupCard = deleted.updatedMessages.find((item) => item.id === second.assistantMessage.id)
		expect(soupCard?.meals[0]?.totals.kcal).toBe(150)
	})

	it('answers an open question in words: the same entry changes, the question closes', async () => {
		await start()
		const owner = await registerUser('owner@kus.app')
		const values = { kcal: 240, protein: 12, fat: 12, carbs: 21, fiber: null, grams: null }
		fake.respond(
			createCompletion([logFoodCall([SOUP_ITEM]), soupClarifyCall]),
			createCompletion([
				{
					name: 'resolve_clarification',
					args: { ref: 'c1', answer: 'щось середнє', optionIndex: null, values },
				},
				reply('Оновив суп'),
			]),
		)
		const first = await send(owner, 'тарілка супу')

		const second = await send(owner, 'щось середнє між ними')

		expect(JSON.stringify(fake.bodies[1])).toContain('c1 about e1')
		expect(await prisma.foodEntry.count()).toBe(1)
		const updated = second.updatedMessages.find((item) => item.id === first.assistantMessage.id)
		expect(updated?.meals[0]?.entries[0]).toMatchObject({ kcal: 240, fat: 12 })
		expect(updated?.clarifications[0]).toMatchObject({
			status: 'ANSWERED',
			answer: 'щось середнє',
			answeredOptionIndex: null,
		})
		const clarification = await prisma.clarification.findFirstOrThrow()
		expect(clarification.answerMessageId).toBe(second.userMessage.id)
	})

	it('dismisses an open question about an entry changed in words, so a later tap changes nothing', async () => {
		await start()
		const owner = await registerUser('owner@kus.app')
		fake.respond(
			createCompletion([logFoodCall([SOUP_ITEM]), soupClarifyCall]),
			createCompletion([
				{ name: 'correct_entry', args: { changes: [{ ref: 'e1', grams: 200 }] } },
				reply('Змінив суп на 200 г'),
			]),
		)
		const first = await send(owner, 'тарілка супу')
		const clarificationId = first.assistantMessage.clarifications[0]?.id ?? ''

		const second = await send(owner, 'там було 200 г')

		const updated = second.updatedMessages.find((item) => item.id === first.assistantMessage.id)
		expect(updated?.clarifications[0]?.status).toBe('DISMISSED')
		await owner.agent
			.post(`/api/v1/clarifications/${clarificationId}/answer`)
			.send({ optionIndex: 1 })
			.expect(409)
		const entry = await prisma.foodEntry.findFirstOrThrow()
		expect(entry).toMatchObject({ grams: 200, kcal: 100 })
	})

	it('IDOR: another user sees none of the entries and cannot change them by ref', async () => {
		await start()
		const owner = await registerUser('owner@kus.app')
		const stranger = await registerUser('stranger@kus.app')
		const deleteFirst = createCompletion([
			{ name: 'delete_entry', args: { refs: ['e1'] } },
			reply('Видалив'),
		])
		fake.respond(createCompletion([logFoodCall([BORSCHT_ITEM])]), deleteFirst, deleteFirst)
		await send(owner, 'тарілка борщу')

		await stranger.agent
			.post(MESSAGES_URL)
			.send({ clientMessageId: randomUUID(), text: 'видали борщ' })
			.expect(503)

		const strangerPrompt = JSON.stringify(fake.bodies[1])
		expect(strangerPrompt).toContain('Nothing logged yet today.')
		expect(strangerPrompt).not.toContain('\\"Борщ\\":')
		const entry = await prisma.foodEntry.findFirstOrThrow({ where: { userId: owner.userId } })
		expect(entry.deletedAt).toBeNull()
		expect(await prisma.correction.count()).toBe(0)
	})
})
