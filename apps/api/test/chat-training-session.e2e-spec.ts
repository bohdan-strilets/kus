import { randomUUID } from 'node:crypto'

import { Logger } from '@nestjs/common'
import type { NestExpressApplication } from '@nestjs/platform-express'
import {
	authSessionResponseSchema,
	chatMessageSchema,
	createCursorPaginatedResponseSchema,
	createDataResponseSchema,
	sendMessageResponseSchema,
	shiftDate,
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
const WORKOUTS_URL = '/api/v1/workouts'
const sendResponseSchema = createDataResponseSchema(sendMessageResponseSchema)
const listResponseSchema = createCursorPaginatedResponseSchema(chatMessageSchema)
const workoutDataSchema = createDataResponseSchema(workoutResponseSchema)
const fake = createFakeAiClient()

const MINUTE_MS = 60_000
const HOUR_MS = 60 * MINUTE_MS

const bench = (weightKg: number, sets: Record<string, unknown>[] = []) => ({
	name: 'Жим лежачи',
	kind: 'STRENGTH',
	sets: [...sets, { reps: 8, weightKg, count: 3 }],
})
const squat = (weightKg: number) => ({
	name: 'Присід',
	kind: 'STRENGTH',
	sets: [{ reps: 5, weightKg, count: 3 }],
})
const treadmill = { name: 'Бігова доріжка', kind: 'CARDIO', durationMin: 10 }
const bike = { name: 'Велотренажер', kind: 'CARDIO', durationMin: 15 }

const workoutCall = (args: Record<string, unknown>): FakeToolCall => ({
	name: 'log_workout',
	args: { exercises: [bench(80)], reply: 'Записав.', ...args },
})

interface TestUser {
	agent: TestAgent
	userId: string
}

type Sent = Awaited<ReturnType<typeof sendAs>>

const sendAs = async (user: TestUser, text: string) => {
	const response = await user.agent
		.post(MESSAGES_URL)
		.send({ clientMessageId: randomUUID(), text })
		.expect(201)
	return sendResponseSchema.parse(response.body).data
}

describe('chat training sessions across messages (e2e, real DB, fake model)', () => {
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

	/** Moves the entries a message logged back in time, as if it had been sent earlier. */
	const moveEntriesBack = async (sent: Sent, ms: number): Promise<void> => {
		const entries = await prisma.exerciseEntry.findMany({
			where: { sourceMessageId: sent.userMessage.id },
		})
		for (const entry of entries) {
			await prisma.exerciseEntry.update({
				where: { id: entry.id },
				data: { performedAt: new Date(entry.performedAt.getTime() - ms) },
			})
		}
	}

	const getFeed = async (user: TestUser) =>
		listResponseSchema.parse((await user.agent.get(MESSAGES_URL).expect(200)).body).data

	afterEach(async () => {
		await app.close()
	})

	afterAll(() => {
		for (const spy of logSpies) spy.mockRestore()
	})

	it('a whole workout in one message with finish: one finished session, its summary and a record', async () => {
		await start()
		const owner = await registerUser('owner@kus.app')
		fake.respond(
			createCompletion([workoutCall({ exercises: [bench(80)] })]),
			createCompletion([
				workoutCall({
					place: 'GYM',
					finish: true,
					exercises: [
						treadmill,
						// the warm-up at 100 kg is heavier than ever, but warm-ups never make a record
						bench(85, [{ reps: 3, weightKg: 100, count: 1, isWarmup: true }]),
					],
				}),
			]),
		)
		const earlier = await sendAs(owner, 'жим 80 3×8')
		expect(earlier.hasNewWorkoutRecord).toBe(false)

		const sent = await sendAs(owner, 'зал: доріжка 10 хв, розминка 100×3, жим 85 3×8')

		const [card] = sent.assistantMessage.workoutCards
		const [workout] = sent.assistantMessage.workouts
		expect(card).toMatchObject({ workoutId: workout?.id, variant: 'SUMMARY' })
		expect(card?.exerciseIds).toEqual(workout?.exercises.map(({ id }) => id))
		expect(workout?.finishedAt).not.toBeNull()
		expect(workout?.exercises.map((exercise) => exercise.record)).toEqual([null, 'WEIGHT'])
		expect(sent.hasNewWorkoutRecord).toBe(true)
		const row = await prisma.workout.findUniqueOrThrow({ where: { id: workout?.id } })
		expect(row.finishedMessageId).toBe(sent.userMessage.id)
		// the first one, logged without finish, stays an open session with its exercises card
		expect(earlier.assistantMessage.workoutCards).toMatchObject([{ variant: 'EXERCISES' }])
	})

	it('builds one session over several messages: an exercises card each, the summary on «все»', async () => {
		await start()
		const owner = await registerUser('owner@kus.app')
		fake.respond(
			createCompletion([workoutCall({ place: 'GYM', exercises: [treadmill] })]),
			createCompletion([workoutCall({ appendRef: 'w1', exercises: [bench(80)] })]),
			createCompletion([workoutCall({ appendRef: 'w1', exercises: [squat(100)] })]),
			createCompletion([
				workoutCall({ appendRef: 'w1', finish: true, kcalBurned: 450, exercises: [bike] }),
			]),
		)

		const cardio = await sendAs(owner, 'зал, доріжка 10 хв')
		const press = await sendAs(owner, 'жим 80 3×8')
		const legs = await sendAs(owner, 'присід 100 3×5')
		const done = await sendAs(owner, 'все, ще вело 15 хв, 450 ккал')

		expect(await prisma.workout.count()).toBe(1)
		const workout = await prisma.workout.findFirstOrThrow({
			include: { exercises: { orderBy: { position: 'asc' } } },
		})
		expect(workout.exercises.map((entry) => [entry.name, entry.position])).toEqual([
			['Бігова доріжка', 0],
			['Жим лежачи', 1],
			['Присід', 2],
			['Велотренажер', 3],
		])
		expect(workout).toMatchObject({
			place: 'GYM',
			kcalBurned: 450,
			kcalSource: 'MANUAL',
			editedAt: null,
			finishedMessageId: done.userMessage.id,
		})
		for (const [sent, name] of [
			[cardio, 'Бігова доріжка'],
			[press, 'Жим лежачи'],
			[legs, 'Присід'],
		] as const) {
			const entry = workout.exercises.find((exercise) => exercise.name === name)
			expect(sent.assistantMessage.workoutCards).toEqual([
				{ workoutId: workout.id, variant: 'EXERCISES', exerciseIds: [entry?.id] },
			])
		}
		expect(done.assistantMessage.workoutCards).toMatchObject([
			{ workoutId: workout.id, variant: 'SUMMARY' },
		])
		expect(done.assistantMessage.workoutCards[0]?.exerciseIds).toHaveLength(4)

		// the feed after a reload (newest first) shows the same cards
		const feed = await getFeed(owner)
		const variantsByReply = feed
			.filter((message) => message.role === 'ASSISTANT')
			.map((message) => message.workoutCards.map((card) => card.variant))
		expect(variantsByReply).toEqual([['SUMMARY'], ['EXERCISES'], ['EXERCISES'], ['EXERCISES']])

		// told over an hour: the first message an hour before the finish
		await moveEntriesBack(cardio, 60 * MINUTE_MS)
		await moveEntriesBack(press, 40 * MINUTE_MS)
		await moveEntriesBack(legs, 20 * MINUTE_MS)
		const response = await owner.agent.get(`${WORKOUTS_URL}/${workout.id}`).expect(200)
		expect(workoutDataSchema.parse(response.body).data.estimatedDurationMin).toBe(60)
	})

	it('starts a new session when the session to add to was last added to more than 3 h ago', async () => {
		await start()
		const owner = await registerUser('owner@kus.app')
		fake.respond(
			createCompletion([workoutCall({})]),
			createCompletion([workoutCall({ appendRef: 'w1', exercises: [squat(100)] })]),
		)
		const morning = await sendAs(owner, 'жим 80 3×8')
		await moveEntriesBack(morning, 3 * HOUR_MS + MINUTE_MS)

		const later = await sendAs(owner, 'присід 100 3×5')

		expect(await prisma.workout.count()).toBe(2)
		expect(later.assistantMessage.workouts[0]?.id).not.toBe(
			morning.assistantMessage.workouts[0]?.id,
		)
		expect(later.assistantMessage.workoutCards).toMatchObject([{ variant: 'EXERCISES' }])
	})

	it('starts a new session when another place is named', async () => {
		await start()
		const owner = await registerUser('owner@kus.app')
		fake.respond(
			createCompletion([workoutCall({ place: 'GYM' })]),
			createCompletion([workoutCall({ appendRef: 'w1', place: 'HOME', exercises: [squat(40)] })]),
		)
		await sendAs(owner, 'зал: жим 80 3×8')

		await sendAs(owner, 'вдома присід 40 3×5')

		const workouts = await prisma.workout.findMany({ orderBy: { createdAt: 'asc' } })
		expect(workouts.map((workout) => workout.place)).toEqual(['GYM', 'HOME'])
	})

	it('adds a forgotten exercise to a finished session of yesterday: the new message gets its card, the day stays', async () => {
		await start()
		const owner = await registerUser('owner@kus.app')
		fake.respond(
			createCompletion([workoutCall({ exercises: [squat(90)] })]),
			createCompletion([workoutCall({ place: 'GYM', finish: true, exercises: [bench(80)] })]),
			createCompletion([workoutCall({ appendRef: 'w1', exercises: [squat(100)] })]),
		)
		const old = await sendAs(owner, 'присід 90 3×5')
		const finished = await sendAs(owner, 'зал: жим 80 3×8, все')
		const today = finished.assistantMessage.workouts[0]?.localDate ?? ''
		const yesterday = new Date(`${shiftDate(today, -1)}T00:00:00Z`)
		const sessionId = finished.assistantMessage.workouts[0]?.id ?? ''
		// the old squat a week ago, out of the context; the session just before midnight
		const oldId = old.assistantMessage.workouts[0]?.id ?? ''
		const weekAgo = new Date(`${shiftDate(today, -7)}T00:00:00Z`)
		await prisma.workout.update({ where: { id: oldId }, data: { localDate: weekAgo } })
		await prisma.exerciseEntry.updateMany({
			where: { workoutId: oldId },
			data: { localDate: weekAgo, performedAt: new Date(Date.now() - 7 * 24 * HOUR_MS) },
		})
		const finishedAt = new Date(Date.now() - HOUR_MS)
		await prisma.workout.update({
			where: { id: sessionId },
			data: { localDate: yesterday, finishedAt },
		})
		await prisma.exerciseEntry.updateMany({
			where: { workoutId: sessionId },
			data: { localDate: yesterday, performedAt: new Date(Date.now() - HOUR_MS - MINUTE_MS) },
		})

		const forgot = await sendAs(owner, 'забула: ще присід 100 3×5')

		expect(JSON.stringify(fake.bodies[2])).toContain('w1 GYM')
		const [card] = forgot.assistantMessage.workoutCards
		const [shown] = forgot.assistantMessage.workouts
		expect(card).toMatchObject({ workoutId: sessionId, variant: 'EXERCISES' })
		expect(card?.exerciseIds).toHaveLength(1)
		const added = shown?.exercises.find(({ id }) => id === card?.exerciseIds[0])
		expect(added?.name).toBe('Присід')
		expect(added?.record).toBe('WEIGHT')
		// added after the finish: the card can tell «змінено»
		expect(new Date(added?.performedAt ?? 0).getTime()).toBeGreaterThan(finishedAt.getTime())
		expect(forgot.hasNewWorkoutRecord).toBe(true)

		const session = await prisma.workout.findUniqueOrThrow({
			where: { id: sessionId },
			include: { exercises: true },
		})
		expect(session.localDate).toEqual(yesterday)
		expect(
			session.exercises.every((entry) => entry.localDate.getTime() === yesterday.getTime()),
		).toBe(true)
		expect(session.finishedAt).toEqual(finishedAt)
		expect(session.finishedMessageId).toBe(finished.userMessage.id)
		expect(session.records).toEqual([{ exerciseEntryId: added?.id, type: 'WEIGHT' }])
		// the summary stays on the message that finished the session
		const feed = await getFeed(owner)
		const summary = feed.find((message) => message.replyToId === finished.userMessage.id)
		expect(summary?.workoutCards).toMatchObject([{ workoutId: sessionId, variant: 'SUMMARY' }])
	})

	it('a group fix changes only the dictionary row: the entry keeps its snapshot, nothing is logged', async () => {
		await start()
		const owner = await registerUser('owner@kus.app')
		fake.respond(
			createCompletion([workoutCall({})]),
			createCompletion([
				workoutCall({ exercises: [], exerciseGroups: ['x1:SHOULDERS'], reply: 'Виправив.' }),
			]),
		)
		await sendAs(owner, 'жим 80 3×8')

		const fixed = await sendAs(owner, 'ні, це плечі')

		const exercise = await prisma.exercise.findFirstOrThrow({ where: { userId: owner.userId } })
		const entry = await prisma.exerciseEntry.findFirstOrThrow({ where: { userId: owner.userId } })
		expect(exercise.muscleGroup).toBe('SHOULDERS')
		expect(entry.muscleGroup).toBe('CHEST')
		expect(await prisma.workout.count()).toBe(1)
		expect(await prisma.exerciseEntry.count()).toBe(1)
		expect(fixed.assistantMessage.workoutCards).toEqual([])
	})

	it('adds only to sessions of the context: another user’s session is never a ref', async () => {
		await start()
		const owner = await registerUser('owner@kus.app')
		const stranger = await registerUser('stranger@kus.app')
		fake.respond(
			createCompletion([workoutCall({})]),
			createCompletion([workoutCall({ appendRef: 'w1', exercises: [squat(100)] })]),
			createCompletion([workoutCall({ exercises: [squat(100)] })]),
		)
		const strangers = await sendAs(stranger, 'жим 80 3×8')

		await sendAs(owner, 'присід 100 3×5')

		const context = JSON.stringify(fake.bodies[1])
		expect(context).not.toContain("Today's workouts (refs")
		expect(JSON.stringify(fake.bodies[2])).toContain('appendRef \\"w1\\" is not in')
		const strangerSession = await prisma.workout.findUniqueOrThrow({
			where: { id: strangers.assistantMessage.workouts[0]?.id },
			include: { exercises: true },
		})
		expect(strangerSession.exercises.map((entry) => entry.name)).toEqual(['Жим лежачи'])
		expect(await prisma.workout.count({ where: { userId: owner.userId } })).toBe(1)
	})

	it('deleting a session turns the cards of all its messages into the deleted line', async () => {
		await start()
		const owner = await registerUser('owner@kus.app')
		fake.respond(
			createCompletion([workoutCall({})]),
			createCompletion([workoutCall({ appendRef: 'w1', exercises: [squat(100)] })]),
			createCompletion([workoutCall({ appendRef: 'w1', finish: true, exercises: [] })]),
			createCompletion([
				{ name: 'delete_entry', args: { refs: ['w1'] } },
				{ name: 'reply', args: { text: 'Прибрав.' } },
			]),
		)
		const first = await sendAs(owner, 'жим 80 3×8')
		const second = await sendAs(owner, 'присід 100 3×5')
		const done = await sendAs(owner, 'все')
		expect(done.assistantMessage.workoutCards).toMatchObject([{ variant: 'SUMMARY' }])

		const deleted = await sendAs(owner, 'видали тренування')

		const updated = new Map(deleted.updatedMessages.map((message) => [message.id, message]))
		for (const sent of [first, second, done]) {
			expect(updated.get(sent.assistantMessage.id)?.workouts).toMatchObject([{ isDeleted: true }])
		}
	})

	it('«все» for a session past 3 h closes it at its last entry, with the summary on «все»', async () => {
		await start()
		const owner = await registerUser('owner@kus.app')
		fake.respond(
			createCompletion([workoutCall({})]),
			createCompletion([workoutCall({ appendRef: 'w1', finish: true, exercises: [] })]),
		)
		const first = await sendAs(owner, 'жим 80 3×8')
		await moveEntriesBack(first, 3 * HOUR_MS + MINUTE_MS)

		const done = await sendAs(owner, 'все')

		expect(await prisma.workout.count()).toBe(1)
		const workout = await prisma.workout.findFirstOrThrow({ include: { exercises: true } })
		expect(workout.finishedAt).toEqual(workout.exercises[0]?.performedAt)
		expect(workout.finishedMessageId).toBe(done.userMessage.id)
		expect(done.assistantMessage.workoutCards).toMatchObject([
			{ workoutId: workout.id, variant: 'SUMMARY' },
		])
	})

	it('«все» when every session of the day is finished closes nothing', async () => {
		await start()
		const owner = await registerUser('owner@kus.app')
		fake.respond(
			createCompletion([workoutCall({ finish: true })]),
			createCompletion([workoutCall({ appendRef: 'w1', finish: true, exercises: [] })]),
		)
		const first = await sendAs(owner, 'жим 80 3×8, все')
		await moveEntriesBack(first, 3 * HOUR_MS + MINUTE_MS)
		const before = await prisma.workout.findFirstOrThrow()

		const done = await sendAs(owner, 'все')

		const after = await prisma.workout.findFirstOrThrow()
		expect(after.finishedAt).toEqual(before.finishedAt)
		expect(after.finishedMessageId).toBe(first.userMessage.id)
		expect(done.assistantMessage.workoutCards).toEqual([])
		expect(done.updatedMessages).toEqual([])
	})

	it('a fix that adds an exercise shows it on the fixing message; the summary stays where it was', async () => {
		await start()
		const owner = await registerUser('owner@kus.app')
		fake.respond(
			createCompletion([workoutCall({ finish: true })]),
			createCompletion([
				workoutCall({ replaceRef: 'w1', exercises: [bench(80), squat(100)], reply: 'Виправив.' }),
			]),
		)
		const first = await sendAs(owner, 'жим 80 3×8, все')

		const fix = await sendAs(owner, 'ще був присід 100 3×5')

		const workout = await prisma.workout.findFirstOrThrow({ include: { exercises: true } })
		const squatEntry = workout.exercises.find((entry) => entry.name === 'Присід')
		const benchEntry = workout.exercises.find((entry) => entry.name === 'Жим лежачи')
		expect(squatEntry?.sourceMessageId).toBe(fix.userMessage.id)
		expect(benchEntry?.sourceMessageId).toBe(first.userMessage.id)
		expect(workout.finishedMessageId).toBe(first.userMessage.id)
		expect(fix.assistantMessage.workoutCards).toEqual([
			{ workoutId: workout.id, variant: 'EXERCISES', exerciseIds: [squatEntry?.id] },
		])
		const summary = fix.updatedMessages.find((message) => message.id === first.assistantMessage.id)
		expect(summary?.workoutCards).toMatchObject([{ workoutId: workout.id, variant: 'SUMMARY' }])
		expect(summary?.workoutCards[0]?.exerciseIds).toHaveLength(2)
	})
})
