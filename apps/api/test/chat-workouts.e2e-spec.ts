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
	EGGS_AND_BUCKWHEAT_ITEMS,
	type FakeToolCall,
	logFoodCall,
} from '../src/modules/ai/ai.test-utils'
import type { PrismaService } from '../src/prisma'
import { WorkoutsRepository } from '../src/modules/workouts/workouts.repository'
import { createDbTestApp } from './create-db-test-app'

const MESSAGES_URL = '/api/v1/messages'
const sendResponseSchema = createDataResponseSchema(sendMessageResponseSchema)
const fake = createFakeAiClient()

const reply = (text: string): FakeToolCall => ({ name: 'reply', args: { text } })

const bench = (weightKg: number, overrides: Record<string, unknown> = {}) => ({
	name: 'Жим лежачи',
	kind: 'STRENGTH',
	sets: [{ reps: 8, weightKg, count: 3 }],
	...overrides,
})

const workoutCall = (args: Record<string, unknown>): FakeToolCall => ({
	name: 'log_workout',
	args: { exercises: [bench(80)], reply: 'Записав тренування.', ...args },
})

interface TestUser {
	agent: TestAgent
	userId: string
}

describe('chat workouts (e2e, real DB, fake model)', () => {
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

	it('logs a workout from a message: exercises, expanded sets, the dictionary and the card', async () => {
		await start()
		const owner = await registerUser('owner@kus.app')
		fake.respond(
			createCompletion([
				workoutCall({
					place: 'GYM',
					durationMin: 55,
					kcalBurned: 320,
					exercises: [
						{ name: 'Бігова доріжка', kind: 'CARDIO', durationMin: 15, distanceKm: 2.5 },
						bench(80, {
							sets: [{ reps: 8, weightKg: 40, count: 1, isWarmup: true }, ...bench(80).sets],
						}),
					],
				}),
			]),
		)

		const sent = await send(owner, 'зал: доріжка 15 хв, жим 80 3×8')

		expect(sent.assistantMessage.content).toBe('Записав тренування.')
		const [card] = sent.assistantMessage.workouts
		expect(card).toMatchObject({
			place: 'GYM',
			durationMin: 55,
			kcalBurned: 320,
			kcalSource: 'MANUAL',
		})
		expect(card?.exercises.map((exercise) => exercise.name)).toEqual([
			'Бігова доріжка',
			'Жим лежачи',
		])
		expect(card?.exercises[0]).toMatchObject({ durationMin: 15, distanceM: 2500, kind: 'CARDIO' })
		expect(card?.exercises[1]?.sets.map((set) => [set.weightKg, set.isWarmup])).toEqual([
			[40, true],
			[80, false],
			[80, false],
			[80, false],
		])
		expect(await prisma.exercise.count({ where: { userId: owner.userId } })).toBe(2)
		expect(await prisma.exerciseEntry.count({ where: { exerciseId: null } })).toBe(0)
		// a workout never touches the food of the day
		expect(sent.dayTotals.totals.kcal).toBe(0)
	})

	it("puts today's workout and the dictionary exercise into the next context", async () => {
		await start()
		const owner = await registerUser('owner@kus.app')
		fake.respond(
			createCompletion([workoutCall({ place: 'GYM', durationMin: 55 })]),
			createCompletion([reply('ок')]),
		)
		await send(owner, 'жим 80 3×8')

		await send(owner, 'а жим сьогодні був добрий?')

		const context = JSON.stringify(fake.bodies[1])
		expect(context).toContain("Today's workouts (refs")
		expect(context).toMatch(/w1 GYM \d{2}:\d{2}, last \d{2}:\d{2}, 55 min:/)
		expect(context).toContain('\\"Жим лежачи\\" [x1 CHEST] 3×8 at 80 kg')
		expect(context).toContain('Exercises (refs for exerciseRef')
		expect(context).toContain('x1 \\"Жим лежачи\\" (STRENGTH, CHEST)')
	})

	it("lists the exercises of today's workout under «Exercises» even when the text names none", async () => {
		await start()
		const owner = await registerUser('owner@kus.app')
		fake.respond(createCompletion([workoutCall({})]), createCompletion([reply('ок')]))
		await send(owner, 'жим 80 3×8')

		await send(owner, 'ні, це ноги')

		const context = JSON.stringify(fake.bodies[1])
		expect(context).toContain('x1 \\"Жим лежачи\\" (STRENGTH, CHEST)')
		expect(context).toContain('[x1 CHEST]')
	})

	it('replaces a whole workout in place and refreshes the first card', async () => {
		await start()
		const owner = await registerUser('owner@kus.app')
		fake.respond(
			createCompletion([workoutCall({ exercises: [bench(85)] })]),
			createCompletion([
				workoutCall({ replaceRef: 'w1', exercises: [bench(75)], reply: 'Виправив.' }),
			]),
		)
		const first = await send(owner, 'жим 85 3×8')

		const second = await send(owner, 'ні, жим був 75')

		expect(await prisma.workout.count()).toBe(1)
		expect(second.assistantMessage.workouts).toEqual([])
		expect(second.updatedMessages.map((message) => message.id)).toEqual([first.assistantMessage.id])
		const [card] = second.updatedMessages[0]?.workouts ?? []
		expect(card?.id).toBe(first.assistantMessage.workouts[0]?.id)
		expect(first.assistantMessage.workouts[0]?.isEdited).toBe(false)
		expect(card?.isEdited).toBe(true)
		expect(card?.exercises[0]?.sets.map((set) => set.weightKg)).toEqual([75, 75, 75])
		expect(await prisma.exerciseEntry.count()).toBe(1)
		expect(await prisma.exerciseSet.count()).toBe(3)
	})

	it('deletes a workout by its w-ref and brings it back', async () => {
		await start()
		const owner = await registerUser('owner@kus.app')
		fake.respond(
			createCompletion([workoutCall({})]),
			createCompletion([{ name: 'delete_entry', args: { refs: ['w1'] } }, reply('Прибрав.')]),
			createCompletion([{ name: 'restore_entry', args: { refs: ['w1'] } }, reply('Повернув.')]),
		)
		const first = await send(owner, 'жим 80 3×8')

		const deleted = await send(owner, 'видали тренування')
		const hidden = deleted.updatedMessages.find(
			(message) => message.id === first.assistantMessage.id,
		)
		const restored = await send(owner, 'поверни тренування')

		expect(hidden?.workouts).toMatchObject([
			{ id: first.assistantMessage.workouts[0]?.id, isDeleted: true },
		])
		expect(JSON.stringify(fake.bodies[2])).toContain('Deleted today (refs for restore_entry):')
		expect(restored.updatedMessages[0]?.workouts).toMatchObject([{ isDeleted: false }])
		expect((await prisma.workout.findFirstOrThrow()).deletedAt).toBeNull()
	})

	it('logs food and a workout from one message, each reply covering its own part', async () => {
		await start()
		const owner = await registerUser('owner@kus.app')
		fake.respond(
			createCompletion([
				logFoodCall(EGGS_AND_BUCKWHEAT_ITEMS),
				workoutCall({ reply: 'Тренування теж є.' }),
			]),
		)

		const sent = await send(owner, "після залу з'їв яйця і гречку, жим 80 3×8")

		expect(sent.assistantMessage.content).toBe('Записав! Тренування теж є.')
		expect(sent.assistantMessage.meals).toHaveLength(1)
		expect(sent.assistantMessage.workouts).toHaveLength(1)
	})

	it('marks a heavier set as a record, but not a first result or an equal one', async () => {
		await start()
		const owner = await registerUser('owner@kus.app')
		fake.respond(
			createCompletion([workoutCall({ exercises: [bench(80)] })]),
			createCompletion([workoutCall({ exercises: [bench(80)] })]),
			createCompletion([workoutCall({ exercises: [bench(82.5)] })]),
		)

		const first = await send(owner, 'жим 80')
		const equal = await send(owner, 'ще жим 80')
		const heavier = await send(owner, 'жим 82.5')

		expect(first.assistantMessage.workouts[0]?.exercises[0]?.record).toBeNull()
		expect(equal.assistantMessage.workouts[0]?.exercises[0]?.record).toBeNull()
		expect(heavier.assistantMessage.workouts[0]?.exercises[0]?.record).toBe('WEIGHT')
	})

	it('marks more reps without weight as a REPS record; warm-ups and weighted sets never count', async () => {
		await start()
		const owner = await registerUser('owner@kus.app')
		const pullUps = (sets: Record<string, unknown>[]) =>
			workoutCall({ exercises: [{ name: 'Підтягування', kind: 'STRENGTH', sets }] })
		fake.respond(
			createCompletion([pullUps([{ reps: 10, weightKg: null, count: 2 }])]),
			createCompletion([
				pullUps([
					{ reps: 20, weightKg: null, count: 1, isWarmup: true },
					{ reps: 10, weightKg: 0, count: 2 },
				]),
			]),
			createCompletion([pullUps([{ reps: 15, weightKg: 10, count: 1 }])]),
			createCompletion([pullUps([{ reps: 12, weightKg: 0, count: 1 }])]),
		)

		const first = await send(owner, 'підтягування 2×10')
		const warmUp = await send(owner, 'підтягування розминка 20, потім 2×10')
		const weighted = await send(owner, 'підтягування з вагою 10 кг 15 разів')
		const more = await send(owner, 'підтягування 12')

		const recordOf = (sent: typeof first) => sent.assistantMessage.workouts[0]?.exercises[0]?.record
		expect(recordOf(first)).toBeNull()
		expect(recordOf(warmUp)).toBeNull()
		// weighted: a first weight is no record, and its 15 reps are not a bodyweight result
		expect(recordOf(weighted)).toBeNull()
		expect(recordOf(more)).toBe('REPS')
	})

	it('writes the group to the dictionary and the entry; cardio has none', async () => {
		await start()
		const owner = await registerUser('owner@kus.app')
		fake.respond(
			createCompletion([
				workoutCall({
					exercises: [
						{ name: 'Бігова доріжка', kind: 'CARDIO', durationMin: 15, distanceKm: 2.5 },
						bench(80),
					],
				}),
			]),
		)

		const sent = await send(owner, 'доріжка 15 хв, жим 80 3×8')

		expect(
			sent.assistantMessage.workouts[0]?.exercises.map((exercise) => exercise.muscleGroup),
		).toEqual([null, 'CHEST'])
		const exercises = await prisma.exercise.findMany({
			where: { userId: owner.userId },
			orderBy: { name: 'asc' },
		})
		expect(exercises.map((exercise) => [exercise.name, exercise.muscleGroup])).toEqual([
			['Бігова доріжка', null],
			['Жим лежачи', 'CHEST'],
		])
		const entries = await prisma.exerciseEntry.findMany({
			where: { userId: owner.userId },
			orderBy: { position: 'asc' },
		})
		expect(entries.map((entry) => entry.muscleGroup)).toEqual([null, 'CHEST'])
	})

	it('lets two parallel turns create the same new exercise without failing either', async () => {
		await start()
		const owner = await registerUser('owner@kus.app')
		const repository = app.get(WorkoutsRepository)
		const data = {
			userId: owner.userId,
			name: 'Тяга',
			nameNormalized: 'тяга',
			kind: 'STRENGTH' as const,
		}

		const [first, second] = await Promise.all([
			prisma.$transaction((tx) => repository.createExercise(data, tx)),
			prisma.$transaction((tx) => repository.createExercise(data, tx)),
		])

		expect(first.id).toBe(second.id)
		expect(await prisma.exercise.count({ where: { userId: owner.userId } })).toBe(1)
	})

	it('keeps the dictionary and the workouts of each user apart', async () => {
		await start()
		const owner = await registerUser('owner@kus.app')
		const stranger = await registerUser('stranger@kus.app')
		fake.respond(createCompletion([workoutCall({})]), createCompletion([reply('ок')]))
		await send(owner, 'жим 80 3×8')

		await send(stranger, 'жим')

		const context = JSON.stringify(fake.bodies[1])
		expect(context).not.toContain("Today's workouts (refs")
		expect(context).not.toContain('Exercises (refs')
		expect(await prisma.exercise.count({ where: { userId: stranger.userId } })).toBe(0)
	})
})
