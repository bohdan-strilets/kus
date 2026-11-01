import { randomUUID } from 'node:crypto'

import { Logger } from '@nestjs/common'
import type { NestExpressApplication } from '@nestjs/platform-express'
import {
	apiErrorResponseSchema,
	authSessionResponseSchema,
	type ChatMessage,
	chatMessageSchema,
	createCursorPaginatedResponseSchema,
	createDataResponseSchema,
	exerciseDictionaryResponseSchema,
	programResponseSchema,
	rebaseProgramProposalResponseSchema,
	sendMessageResponseSchema,
	workoutResponseSchema,
} from '@kus/shared'
import request from 'supertest'
import type TestAgent from 'supertest/lib/agent'
import { afterAll, afterEach, describe, expect, it, vi } from 'vitest'

import {
	createCompletion,
	createFakeAiClient,
	type FakeToolCall,
} from '../src/modules/ai/ai.test-utils'
import type { PrismaService } from '../src/prisma'
import { createDbTestApp } from './create-db-test-app'

const MESSAGES_URL = '/api/v1/messages'
const PROGRAM_URL = '/api/v1/programs/active'
const proposalUrl = (messageId: string, action: 'accept' | 'rebase') =>
	`/api/v1/programs/proposals/${messageId}/${action}`

const sendResponse = createDataResponseSchema(sendMessageResponseSchema)
const programResponse = createDataResponseSchema(programResponseSchema)
const rebaseResponse = createDataResponseSchema(rebaseProgramProposalResponseSchema)
const feedResponse = createCursorPaginatedResponseSchema(chatMessageSchema)
const dictionaryResponse = createDataResponseSchema(exerciseDictionaryResponseSchema)
const dayResponse = createDataResponseSchema(workoutResponseSchema.array())
const fake = createFakeAiClient()

const bench = {
	name: 'Жим лежачи',
	kind: 'STRENGTH',
	sets: 3,
	repsMin: 8,
	repsMax: 12,
	weightKg: 60,
}
const squat = {
	name: 'Присідання',
	kind: 'STRENGTH',
	sets: 3,
	repsMin: 8,
	repsMax: 8,
	weightKg: 80,
}
const pushUps = { name: 'Віджимання', kind: 'STRENGTH', sets: 3, repsMin: 10, repsMax: 15 }

const proposeCall = (
	templates: { ref: string | null; name: string; exercises: unknown[] }[],
	args: Record<string, unknown> = {},
): FakeToolCall => ({
	name: 'propose_program',
	args: { mode: 'ROTATE', perWeek: 2, templates, reply: 'Два тренування на все тіло.', ...args },
})

const FIRST_PROGRAM = proposeCall([
	{ ref: null, name: 'Тренування А', exercises: [bench] },
	{ ref: null, name: 'Тренування Б', exercises: [squat] },
])

interface TestUser {
	agent: TestAgent
	userId: string
}

describe('program proposals in the chat (e2e, real DB, fake model)', () => {
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

	const send = async (user: TestUser, text: string, call: FakeToolCall) => {
		fake.respond(createCompletion([call]))
		const response = await user.agent
			.post(MESSAGES_URL)
			.send({ clientMessageId: randomUUID(), text })
			.expect(201)
		return sendResponse.parse(response.body).data
	}

	const accept = (user: TestUser, messageId: string, status = 201) =>
		user.agent.post(proposalUrl(messageId, 'accept')).expect(status)

	const errorCode = (body: unknown): string => apiErrorResponseSchema.parse(body).errorCode

	const findInFeed = async (user: TestUser, id: string): Promise<ChatMessage | undefined> => {
		const feed = feedResponse.parse((await user.agent.get(MESSAGES_URL).expect(200)).body)
		return feed.data.find((message) => message.id === id)
	}

	/** A first program accepted from the chat; returns its card message. */
	const seedAccepted = async (user: TestUser): Promise<ChatMessage> => {
		const { assistantMessage } = await send(user, 'склади програму', FIRST_PROGRAM)
		await accept(user, assistantMessage.id)
		return assistantMessage
	}

	afterEach(async () => {
		await app.close()
	})

	afterAll(() => {
		for (const spy of logSpies) spy.mockRestore()
	})

	it('proposes a first program as a card, accepts it once and shows the card accepted', async () => {
		await start()
		const owner = await registerUser('owner@kus.app')

		const { assistantMessage } = await send(owner, 'склади мені програму', FIRST_PROGRAM)

		// no program yet, but the message talks about one: the rules come alone
		const context = JSON.stringify(fake.bodies[0])
		expect(context).toContain('# Program')
		expect(context).not.toContain('Active: ')
		expect(assistantMessage.content).toBe('Два тренування на все тіло.')
		expect(assistantMessage.programCard).toMatchObject({
			v: 1,
			baseVersionId: null,
			changes: { initial: true, lines: [] },
			program: { mode: 'ROTATE', perWeek: 2 },
		})
		expect(assistantMessage.programCard?.program.templates[0]?.exercises[0]?.target).toMatchObject({
			sets: 3,
			repsMin: 8,
			repsMax: 12,
			weightKg: 60,
			progressStepKg: 2.5,
			restSec: 90,
		})
		expect(assistantMessage.programCardState).toEqual({ status: 'OPEN', versionCreatedAt: null })
		// nothing is saved before «Прийняти»
		expect(await prisma.workoutProgram.count({ where: { userId: owner.userId } })).toBe(0)

		const accepted = programResponse.parse((await accept(owner, assistantMessage.id)).body).data

		expect(accepted.templates.map(({ name }) => name)).toEqual(['Тренування А', 'Тренування Б'])
		const version = await prisma.programVersion.findFirstOrThrow({
			where: { userId: owner.userId },
		})
		expect(version.sourceMessageId).toBe(assistantMessage.id)
		expect((await findInFeed(owner, assistantMessage.id))?.programCardState).toEqual({
			status: 'ACCEPTED',
			versionCreatedAt: version.createdAt.toISOString(),
		})

		const again = await accept(owner, assistantMessage.id, 409)
		expect(errorCode(again.body)).toBe('PROGRAM_PROPOSAL_ALREADY_ACCEPTED')
	})

	it('puts the template exercises into the dictionary with their group, filling a group-less row', async () => {
		await start()
		const owner = await registerUser('groups@kus.app')
		await prisma.exercise.create({
			data: {
				userId: owner.userId,
				name: 'Підтягування',
				nameNormalized: 'підтягування',
				kind: 'STRENGTH',
				aliases: [],
			},
		})
		const { assistantMessage } = await send(
			owner,
			'склади програму',
			proposeCall([
				{
					ref: null,
					name: 'Тренування А',
					exercises: [
						{ name: 'Тяга верхнього блока', kind: 'STRENGTH', muscleGroup: 'BACK', sets: 3 },
						{ name: 'Підтягування', kind: 'STRENGTH', muscleGroup: 'BACK', sets: 3 },
					],
				},
				{ ref: null, name: 'Тренування Б', exercises: [squat] },
			]),
		)
		await accept(owner, assistantMessage.id)

		const back = dictionaryResponse.parse(
			(await owner.agent.get('/api/v1/workouts/exercises?group=BACK').expect(200)).body,
		).data
		expect(back.map(({ name }) => name).sort()).toEqual(['Підтягування', 'Тяга верхнього блока'])
	})

	it('shows the program in the context and turns a change into − / + lines and a new version', async () => {
		await start()
		const owner = await registerUser('owner@kus.app')
		await seedAccepted(owner)

		const { assistantMessage } = await send(
			owner,
			'заміни жим на віджимання',
			proposeCall([
				{ ref: 't1', name: 'Тренування А', exercises: [pushUps] },
				{ ref: 't2', name: 'Тренування Б', exercises: [squat] },
			]),
		)

		const context = JSON.stringify(fake.bodies[1])
		expect(context).toContain('Active: ROTATE, 2 per week. Next: t1.')
		// «жим» names the dictionary exercise, so «Exercises» lists it and the program shows its x-ref
		expect(context).toContain('t1 \\"Тренування А\\": x1 Жим лежачи 3×8–12 60 kg')
		expect(context).toContain('t2 \\"Тренування Б\\": Присідання 3×8 80 kg')
		expect(
			assistantMessage.programCard?.changes.lines.map(({ op, name }) => `${op} ${name}`),
		).toEqual(['ADD Віджимання', 'REMOVE Жим лежачи'])
		await accept(owner, assistantMessage.id)
		expect(await prisma.programVersion.count({ where: { userId: owner.userId } })).toBe(2)
	})

	it('answers with a sentence of its own and no card when the program already is that', async () => {
		await start()
		const owner = await registerUser('owner@kus.app')
		await seedAccepted(owner)

		const { assistantMessage } = await send(
			owner,
			'зроби програму як є',
			proposeCall([
				{ ref: 't1', name: 'Тренування А', exercises: [bench] },
				{ ref: 't2', name: 'Тренування Б', exercises: [squat] },
			]),
		)

		expect(assistantMessage.content).toBe('Це вже так у програмі.')
		expect(assistantMessage.programCard).toBeNull()
	})

	it('refuses a stale card (409), rebases it into a new card and replaces the old one', async () => {
		await start()
		const owner = await registerUser('owner@kus.app')
		await seedAccepted(owner)
		const { assistantMessage: stale } = await send(
			owner,
			'додай віджимання в А',
			proposeCall([
				{ ref: 't1', name: 'Тренування А', exercises: [bench, pushUps] },
				{ ref: 't2', name: 'Тренування Б', exercises: [squat] },
			]),
		)
		// «Готово» of the editor in between
		const active = programResponse.parse((await owner.agent.get(PROGRAM_URL).expect(200)).body).data
		await owner.agent
			.post(`${PROGRAM_URL}/versions`)
			.send({
				baseVersionId: active.version.id,
				templateId: active.templates[1]?.id,
				exercises: [
					{
						name: 'Присідання',
						exerciseId: null,
						kind: 'STRENGTH',
						muscleGroup: 'LEGS',
						target: {
							sets: 4,
							repsMin: 8,
							repsMax: 8,
							weightKg: 80,
							progressStepKg: 2.5,
							restSec: 90,
							durationMin: null,
							distanceM: null,
						},
					},
				],
			})
			.expect(201)

		const conflict = await accept(owner, stale.id, 409)
		expect(errorCode(conflict.body)).toBe('PROGRAM_VERSION_CONFLICT')
		expect((await findInFeed(owner, stale.id))?.programCardState?.status).toBe('OUTDATED')

		const rebased = rebaseResponse.parse(
			(await owner.agent.post(proposalUrl(stale.id, 'rebase')).expect(201)).body,
		).data

		expect(rebased.message.content).toBe('Перерахував від поточної програми.')
		expect(rebased.message.programCardState?.status).toBe('OPEN')
		// the editor's 4 sets of squats are the base now: the card wants 3 back, and adds push-ups
		expect(
			rebased.message.programCard?.changes.lines.map(({ op, name }) => `${op} ${name}`),
		).toEqual(['ADD Віджимання', 'CHANGE Присідання'])
		expect(rebased.previousMessage.programCardState?.status).toBe('REPLACED')
		const replaced = await accept(owner, stale.id, 409)
		expect(errorCode(replaced.body)).toBe('PROGRAM_PROPOSAL_REPLACED')
		await accept(owner, rebased.message.id)
		expect(await prisma.programVersion.count({ where: { userId: owner.userId } })).toBe(3)
	})

	it('answers a parallel second «Прийняти» of the same card with ALREADY_ACCEPTED, not a version conflict', async () => {
		await start()
		const owner = await registerUser('owner@kus.app')
		const { assistantMessage } = await send(owner, 'склади програму', FIRST_PROGRAM)

		const responses = await Promise.all([
			owner.agent.post(proposalUrl(assistantMessage.id, 'accept')),
			owner.agent.post(proposalUrl(assistantMessage.id, 'accept')),
		])

		expect(responses.map(({ status }) => status).sort()).toEqual([201, 409])
		const refused = responses.find(({ status }) => status === 409)
		expect(errorCode(refused?.body)).toBe('PROGRAM_PROPOSAL_ALREADY_ACCEPTED')
		expect(await prisma.programVersion.count({ where: { userId: owner.userId } })).toBe(1)
	})

	it('makes one new card of two parallel «Перерахувати»; the other one is REPLACED', async () => {
		await start()
		const owner = await registerUser('owner@kus.app')
		await seedAccepted(owner)
		const { assistantMessage: stale } = await send(
			owner,
			'додай віджимання в А',
			proposeCall([
				{ ref: 't1', name: 'Тренування А', exercises: [bench, pushUps] },
				{ ref: 't2', name: 'Тренування Б', exercises: [squat] },
			]),
		)
		const active = programResponse.parse((await owner.agent.get(PROGRAM_URL).expect(200)).body).data
		await owner.agent
			.post(`${PROGRAM_URL}/versions`)
			.send({
				baseVersionId: active.version.id,
				templateId: active.templates[1]?.id,
				exercises: [
					{
						name: 'Присідання',
						exerciseId: null,
						kind: 'STRENGTH',
						muscleGroup: 'LEGS',
						target: {
							sets: 4,
							repsMin: 8,
							repsMax: 8,
							weightKg: 80,
							progressStepKg: 2.5,
							restSec: 90,
							durationMin: null,
							distanceM: null,
						},
					},
				],
			})
			.expect(201)
		const before = await prisma.message.count({ where: { userId: owner.userId } })

		const responses = await Promise.all([
			owner.agent.post(proposalUrl(stale.id, 'rebase')),
			owner.agent.post(proposalUrl(stale.id, 'rebase')),
		])

		expect(responses.map(({ status }) => status).sort()).toEqual([201, 409])
		const refused = responses.find(({ status }) => status === 409)
		expect(errorCode(refused?.body)).toBe('PROGRAM_PROPOSAL_REPLACED')
		expect(await prisma.message.count({ where: { userId: owner.userId } })).toBe(before + 1)
	})

	it('builds a change on the card not accepted yet: the model sees it, the new card replaces it', async () => {
		await start()
		const owner = await registerUser('owner@kus.app')
		const { assistantMessage: first } = await send(owner, 'склади програму', FIRST_PROGRAM)

		const { assistantMessage: second } = await send(
			owner,
			'заміни присідання на віджимання',
			proposeCall([
				{ ref: 't1', name: 'Тренування А', exercises: [bench] },
				{ ref: 't2', name: 'Тренування Б', exercises: [pushUps] },
			]),
		)

		const context = JSON.stringify(fake.bodies[1])
		expect(context).not.toContain('Active: ')
		expect(context).toContain(
			'# Program\\nProposal not accepted yet (the card in the chat), build changes on it:\\nROTATE, 2 per week.\\nt1 \\"Тренування А\\": Жим лежачи 3×8–12 60 kg\\nt2 \\"Тренування Б\\": Присідання 3×8 80 kg\\n',
		)
		// still no program: the new card is a first program, its templates keep the proposal's keys
		expect(second.programCard).toMatchObject({ baseVersionId: null, changes: { initial: true } })
		expect(second.programCard?.program.templates.map(({ key }) => key)).toEqual(
			first.programCard?.program.templates.map(({ key }) => key),
		)
		expect(second.programCard?.program.templates[1]?.exercises.map(({ name }) => name)).toEqual([
			'Віджимання',
		])
		expect(second.programCardState?.status).toBe('OPEN')
		expect((await findInFeed(owner, first.id))?.programCardState?.status).toBe('REPLACED')
	})

	it('gives no card when «Готово» in the editor lands while the model answers', async () => {
		await start()
		const owner = await registerUser('owner@kus.app')
		await seedAccepted(owner)
		const active = programResponse.parse((await owner.agent.get(PROGRAM_URL).expect(200)).body).data
		const saveInEditor = () =>
			owner.agent
				.post(`${PROGRAM_URL}/versions`)
				.send({
					baseVersionId: active.version.id,
					templateId: active.templates[0]?.id,
					exercises: [
						{
							name: 'Жим лежачи',
							exerciseId: null,
							kind: 'STRENGTH',
							muscleGroup: 'CHEST',
							target: {
								sets: 5,
								repsMin: 5,
								repsMax: 5,
								weightKg: 70,
								progressStepKg: 2.5,
								restSec: 120,
								durationMin: null,
								distanceM: null,
							},
						},
					],
				})
				.expect(201)
		// the context is built before the model call; the editor saves during it
		vi.mocked(fake.client.post).mockImplementationOnce(async (_path, { body }) => {
			fake.bodies.push(body)
			await saveInEditor()
			return createCompletion([
				proposeCall([
					{ ref: 't1', name: 'Тренування А', exercises: [bench, pushUps] },
					{ ref: 't2', name: 'Тренування Б', exercises: [squat] },
				]),
			])
		})

		const response = await owner.agent
			.post(MESSAGES_URL)
			.send({ clientMessageId: randomUUID(), text: 'додай віджимання в А' })
			.expect(201)
		const { assistantMessage } = sendResponse.parse(response.body).data

		expect(assistantMessage.content).toBe(
			'Програму щойно змінено в редакторі — напиши ще раз, що змінити.',
		)
		expect(assistantMessage.programCard).toBeNull()
		expect(await prisma.programVersion.count({ where: { userId: owner.userId } })).toBe(2)
	})

	it("answers 404 for another user's card and for a message without one", async () => {
		await start()
		const owner = await registerUser('owner@kus.app')
		const stranger = await registerUser('stranger@kus.app')
		const { assistantMessage, userMessage } = await send(owner, 'склади програму', FIRST_PROGRAM)

		const foreign = await accept(stranger, assistantMessage.id, 404)
		expect(errorCode(foreign.body)).toBe('PROGRAM_PROPOSAL_NOT_FOUND')
		await stranger.agent.post(proposalUrl(assistantMessage.id, 'rebase')).expect(404)
		await accept(owner, userMessage.id, 404)
		expect(await prisma.workoutProgram.count()).toBe(0)
	})

	it('binds a workout to the template it names: the queue moves and the journal shows the name', async () => {
		await start()
		const owner = await registerUser('owner@kus.app')
		await seedAccepted(owner)
		const before = programResponse.parse((await owner.agent.get(PROGRAM_URL).expect(200)).body).data
		expect(before.next?.templateId).toBe(before.templates[0]?.id)

		const sent = await send(owner, 'зробив А', {
			name: 'log_workout',
			args: {
				exercises: [
					{ name: 'Жим лежачи', kind: 'STRENGTH', sets: [{ reps: 8, weightKg: 60, count: 3 }] },
				],
				templateRef: 't1',
				finish: true,
				reply: 'Записав тренування А.',
			},
		})

		const [workout] = sent.assistantMessage.workouts
		expect(workout?.templateName).toBe('Тренування А')
		const row = await prisma.workout.findFirstOrThrow({ where: { userId: owner.userId } })
		expect(row.templateId).toBe(before.templates[0]?.id)
		const after = programResponse.parse((await owner.agent.get(PROGRAM_URL).expect(200)).body).data
		expect(after.next?.templateId).toBe(after.templates[1]?.id)
		const day = dayResponse.parse(
			(await owner.agent.get(`/api/v1/workouts/day/${workout?.localDate}`).expect(200)).body,
		).data
		expect(day[0]?.templateName).toBe('Тренування А')
	})
})
