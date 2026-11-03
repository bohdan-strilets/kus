// Investigation (no AI calls): what the model sees after «ще 10 хв доріжки» in a live session, what
// a repeated cardio call does to a later live session, and why the chat card counter changes at finish.
import { randomUUID } from 'node:crypto'

import { Logger } from '@nestjs/common'
import type { NestExpressApplication } from '@nestjs/platform-express'
import {
	chatMessageSchema,
	createCursorPaginatedResponseSchema,
	createDataResponseSchema,
	liveWorkoutResponseSchema,
	sendMessageResponseSchema,
	type WorkoutResponse,
	workoutFinishedSchema,
} from '@kus/shared'
import { afterEach, describe, expect, it, vi } from 'vitest'

import {
	createCompletion,
	createFakeAiClient,
	type FakeToolCall,
} from '../src/modules/ai/ai.test-utils'
import type { PrismaService } from '../src/prisma'
import { createDbTestApp } from './create-db-test-app'
import {
	LIVE_URL,
	liveExercise,
	liveSet,
	registerUser,
	type TestUser,
} from './workout-logging-test-utils'

const MESSAGES_URL = '/api/v1/messages'
const sendResponse = createDataResponseSchema(sendMessageResponseSchema)
const liveResponse = createDataResponseSchema(liveWorkoutResponseSchema)
const finishResponse = createDataResponseSchema(workoutFinishedSchema)
const feedResponse = createCursorPaginatedResponseSchema(chatMessageSchema)
const fake = createFakeAiClient()

const CARDIO = { name: 'Доріжка', kind: 'CARDIO', durationMin: 10 }
const cardioCall = (args: Record<string, unknown> = {}): FakeToolCall => ({
	name: 'log_workout',
	args: { exercises: [CARDIO], reply: 'Додав.', ...args },
})
const replyCall = (text: string): FakeToolCall => ({ name: 'reply', args: { text } })

/** The «Today's workouts» block of a model request body, as plain text. */
const getWorkoutsBlock = (body: unknown): string => {
	const text = JSON.stringify(body).replaceAll('\\n', '\n').replaceAll('\\"', '"')
	const start = text.indexOf("Today's workouts (refs")
	if (start === -1) return '(no section)'
	const rest = text.slice(start)
	const end = rest.search(/\n\n/)
	return end === -1 ? rest.slice(0, 1500) : rest.slice(0, end)
}

const countStrength = (workout: WorkoutResponse) => {
	const strength = workout.exercises.filter(({ kind }) => kind !== 'CARDIO')
	return {
		exercises: strength.length,
		sets: strength.reduce((n, e) => n + e.sets.filter((s) => !s.isWarmup).length, 0),
		cardioMin: workout.exercises
			.filter(({ kind }) => kind === 'CARDIO')
			.reduce((n, e) => n + (e.durationMin ?? 0), 0),
	}
}

describe('live + chat cardio (investigation, fake model)', () => {
	let app: NestExpressApplication
	let prisma: PrismaService
	vi.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined)
	vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined)

	const start = async (): Promise<TestUser> => {
		fake.reset()
		;({ app, prisma } = await createDbTestApp({ aiClient: fake.client }))
		return registerUser(app, 'owner@kus.app')
	}
	const send = async (who: TestUser, text: string) => {
		const response = await who.agent
			.post(MESSAGES_URL)
			.send({ clientMessageId: randomUUID(), text })
			.expect(201)
		return sendResponse.parse(response.body).data
	}
	const openLive = async (who: TestUser, exercises: unknown[]) => {
		const created = await who.agent.post(LIVE_URL).send({ templateId: null }).expect(201)
		const { workout } = liveResponse.parse(created.body).data
		await who.agent
			.put(`${LIVE_URL}/${workout.id}`)
			.send({ knownEditedAt: null, exercises })
			.expect(200)
		return workout.id
	}
	const finish = async (who: TestUser, id: string) =>
		finishResponse.parse((await who.agent.post(`${LIVE_URL}/${id}/finish`).expect(200)).body).data
	const names = async (workoutId: string) =>
		(
			await prisma.exerciseEntry.findMany({
				where: { workoutId, deletedAt: null },
				orderBy: { position: 'asc' },
			})
		).map(({ name, durationMin }) => (durationMin === null ? name : `${name} ${durationMin}`))
	const lastBlock = () => getWorkoutsBlock(fake.bodies.at(-1))

	afterEach(async () => {
		await app.close()
	})

	it("Q1: prints «Today's workouts» open, finished, and for the next live session", async () => {
		const owner = await start()
		const first = await openLive(owner, [liveExercise({ sets: [liveSet(), liveSet({ reps: 6 })] })])
		fake.respond(createCompletion([cardioCall({ appendRef: 'w1' })]))
		await send(owner, 'ще 10 хв доріжки')
		fake.respond(createCompletion([replyCall('ок')]))
		await send(owner, 'ага')
		const openBlock = lastBlock()
		const done = await finish(owner, first)
		fake.respond(createCompletion([replyCall('ок')]))
		await send(owner, 'дякую')
		const finishedBlock = lastBlock()
		const second = await openLive(owner, [liveExercise({ name: 'Присід', sets: [liveSet()] })])
		fake.respond(createCompletion([replyCall('ок')]))
		await send(owner, 'все')
		const nextBlock = lastBlock()
		expect(done.workout.exercises.map(({ name }) => name)).toEqual(['Жим лежачи', 'Доріжка'])
		expect(openBlock).toMatch(/- w1 [^\n]*"Жим лежачи"[^\n]*"Доріжка"[^\n]*10 min/)
		expect(finishedBlock).toMatch(/- w1 [^\n]*finished[^\n]*"Доріжка"[^\n]*10 min/)
		expect(nextBlock).toMatch(/- w1 [^\n]*finished[^\n]*"Доріжка"/)
		expect(nextBlock).toMatch(/- w2 [^\n]*"Присід"/)
		expect(nextBlock).not.toMatch(/- w2 [^\n]*Доріжка/)
		expect(await names(second)).toEqual(['Присід'])
	})

	it('Q2: a repeated cardio call (no ref, finish) lands in the NEW live session; no cross-session dedupe', async () => {
		const owner = await start()
		const first = await openLive(owner, [liveExercise()])
		fake.respond(createCompletion([cardioCall({ appendRef: 'w1' })]))
		await send(owner, 'ще 10 хв доріжки')
		await finish(owner, first)
		const second = await openLive(owner, [liveExercise({ name: 'Присід' })])
		fake.respond(createCompletion([cardioCall({ finish: true, reply: 'Додав і закрив.' })]))
		await send(owner, 'все')
		expect(await names(first)).toEqual(['Жим лежачи', 'Доріжка 10'])
		// documents current behaviour: nothing stops the duplicate
		expect(await names(second)).toEqual(['Присід', 'Доріжка 10'])
		const row = await prisma.workout.findUniqueOrThrow({ where: { id: second } })
		expect(row.finishedAt).not.toBeNull()
	})

	it('Q2: the same with an explicit appendRef to the new session (w2)', async () => {
		const owner = await start()
		const first = await openLive(owner, [liveExercise()])
		fake.respond(createCompletion([cardioCall({ appendRef: 'w1' })]))
		await send(owner, 'ще 10 хв доріжки')
		await finish(owner, first)
		const second = await openLive(owner, [liveExercise({ name: 'Присід' })])
		fake.respond(createCompletion([cardioCall({ appendRef: 'w2', finish: true })]))
		await send(owner, 'все')
		expect(await names(second)).toEqual(['Присід', 'Доріжка 10'])
	})

	it('Q2: cardio already in the SAME open session and the model sends it again: two «Доріжка»', async () => {
		const owner = await start()
		const id = await openLive(owner, [liveExercise()])
		fake.respond(createCompletion([cardioCall({ appendRef: 'w1' })]))
		await send(owner, 'ще 10 хв доріжки')
		fake.respond(createCompletion([cardioCall({ appendRef: 'w1' })]))
		await send(owner, 'все')
		expect(await names(id)).toEqual(['Жим лежачи', 'Доріжка 10', 'Доріжка 10'])
	})

	// No server-side dedupe of identical cardio: a model-behaviour issue seen in UI check S5. The author
	// decided not to handle it in 0.10.3 (see the 0.10.4 backlog in plan-0.10.3.md: eval case and a prompt
	// candidate). Kept skipped as evidence: it would fail until that is decided.
	it.skip('DEFECT-PROOF: the same cardio told twice in a row is not stored twice', async () => {
		const owner = await start()
		const id = await openLive(owner, [liveExercise()])
		fake.respond(createCompletion([cardioCall({ appendRef: 'w1' })]))
		await send(owner, 'ще 10 хв доріжки')
		fake.respond(createCompletion([cardioCall({ appendRef: 'w1' })]))
		await send(owner, 'все')
		expect(await names(id)).toEqual(['Жим лежачи', 'Доріжка 10'])
	})

	it('Q3: the card is EXERCISES (the added cardio) before finish and SUMMARY (whole session) after', async () => {
		const owner = await start()
		const id = await openLive(owner, [
			liveExercise({ sets: [liveSet(), liveSet(), liveSet({ doneAt: null })] }),
			liveExercise({ name: 'Тяга', sets: [liveSet({ doneAt: null })] }),
		])
		fake.respond(createCompletion([cardioCall({ appendRef: 'w1' })]))
		const sent = await send(owner, 'ще 10 хв доріжки')
		const before = sent.assistantMessage.workoutCards

		const done = await finish(owner, id)
		const feed = feedResponse.parse((await owner.agent.get(MESSAGES_URL).expect(200)).body).data
		const summary = feed.find((message) => message.id === done.messageId)

		// The counters («1 вправа · 2 підходи») are computed on the web from the card exercises: see the
		// web tests of getDoneWork / getWorkoutCounts. The API only guarantees these payloads.
		const cardio = done.workout.exercises.find(({ kind }) => kind === 'CARDIO')
		expect(cardio).toBeDefined()
		expect(before).toHaveLength(1)
		expect(before[0]).toMatchObject({ workoutId: id, variant: 'EXERCISES' })
		expect(before[0]?.exerciseIds).toEqual([cardio?.id])
		expect(summary?.workoutCards).toHaveLength(1)
		expect(summary?.workoutCards[0]).toMatchObject({ workoutId: id, variant: 'SUMMARY' })
		expect(summary?.workoutCards[0]?.exerciseIds).toEqual(
			done.workout.exercises.map((exercise) => exercise.id),
		)
		expect(countStrength(done.workout)).toEqual({ exercises: 1, sets: 2, cardioMin: 10 })
	})
})
