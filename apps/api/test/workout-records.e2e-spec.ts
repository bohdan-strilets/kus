import { randomUUID } from 'node:crypto'

import { Logger } from '@nestjs/common'
import type { NestExpressApplication } from '@nestjs/platform-express'
import {
	createDataResponseSchema,
	sendMessageResponseSchema,
	shiftDate,
	workoutFinishedSchema,
	workoutResponseSchema,
} from '@kus/shared'
import { afterAll, afterEach, describe, expect, it, vi } from 'vitest'

import { getLocalDateString } from '../src/common/time'
import {
	createCompletion,
	createFakeAiClient,
	type FakeToolCall,
} from '../src/modules/ai/ai.test-utils'
import type { PrismaService } from '../src/prisma'
import { createDbTestApp } from './create-db-test-app'
import { FORMS_URL, registerUser, type TestUser } from './workout-logging-test-utils'

const TIMEZONE = 'Europe/Warsaw'
const WORKOUTS_URL = '/api/v1/workouts'
const MESSAGES_URL = '/api/v1/messages'
const BENCH = 'Жим лежачи'
const OPEN_LIVE_KG = 200

const formResponse = createDataResponseSchema(workoutFinishedSchema)
const oneResponse = createDataResponseSchema(workoutResponseSchema)
const sendResponse = createDataResponseSchema(sendMessageResponseSchema)
const fake = createFakeAiClient()

const benchCall = (weightKg: number, overrides: Record<string, unknown> = {}): FakeToolCall => ({
	name: 'log_workout',
	args: {
		exercises: [{ name: BENCH, kind: 'STRENGTH', sets: [{ reps: 8, weightKg, count: 3 }] }],
		reply: 'Записав тренування.',
		...overrides,
	},
})

const reply = (text: string): FakeToolCall => ({ name: 'reply', args: { text } })

describe('chronological workout records (e2e, real DB)', () => {
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

	const today = (): string => getLocalDateString(new Date(), TIMEZONE)

	/** Saves a finished session of the form: `daysAgo` 0…3, one bench set of `weightKg`. */
	const saveForm = async (who: TestUser, daysAgo: number, weightKg: number): Promise<string> => {
		const response = await who.agent
			.post(FORMS_URL)
			.send({
				clientRequestId: randomUUID(),
				templateId: null,
				localDate: shiftDate(today(), -daysAgo),
				startTime: '00:00',
				durationMin: 45,
				exercises: [{ name: BENCH, kind: 'STRENGTH', sets: [{ reps: 8, weightKg }] }],
			})
			.expect(201)
		return formResponse.parse(response.body).data.workout.id
	}

	const send = async (who: TestUser, text: string) => {
		const response = await who.agent
			.post(MESSAGES_URL)
			.send({ clientMessageId: randomUUID(), text })
			.expect(201)
		return sendResponse.parse(response.body).data
	}

	const sendWorkout = async (who: TestUser, weightKg: number): Promise<string> => {
		fake.respond(createCompletion([benchCall(weightKg)]))
		const sent = await send(who, `жим ${weightKg}`)
		return sent.assistantMessage.workouts[0]?.id ?? ''
	}

	/** The trophy types the session stores, straight from the database. */
	const stored = async (id: string): Promise<string[]> => {
		const { records } = await prisma.workout.findUniqueOrThrow({ where: { id } })
		return (records as { type: string }[] | null)?.map(({ type }) => type) ?? []
	}

	const storedAll = (ids: string[]): Promise<string[][]> => Promise.all(ids.map(stored))

	afterEach(async () => {
		await app.close()
	})

	afterAll(() => {
		for (const spy of logSpies) spy.mockRestore()
	})

	describe('form saves', () => {
		it('gives the trophy to a step up only; the response shows it on the exercise', async () => {
			await start()
			const owner = await registerUser(app, 'owner@kus.app')

			const a = await saveForm(owner, 3, 80)
			const b = await saveForm(owner, 2, 85)
			const equal = await saveForm(owner, 1, 85)

			expect(await storedAll([a, b, equal])).toEqual([[], ['WEIGHT'], []])
			const one = oneResponse.parse((await owner.agent.get(`${WORKOUTS_URL}/${b}`)).body).data
			expect(one.exercises[0]?.record).toBe('WEIGHT')
		})

		it('a backdated stronger session takes the trophy from the later one', async () => {
			await start()
			const owner = await registerUser(app, 'owner@kus.app')
			const first = await saveForm(owner, 3, 80)
			const late = await saveForm(owner, 1, 90)
			expect(await storedAll([first, late])).toEqual([[], ['WEIGHT']])

			const backdated = await saveForm(owner, 2, 100)

			expect(await storedAll([first, backdated, late])).toEqual([[], ['WEIGHT'], []])
		})

		it('an open live session does not take part in the trophies of the others', async () => {
			await start()
			const owner = await registerUser(app, 'owner@kus.app')
			const first = await saveForm(owner, 2, 80)
			const exercise = await prisma.exercise.findFirstOrThrow({ where: { userId: owner.userId } })
			const longAgo = new Date(`${shiftDate(today(), -3)}T08:00:00Z`)
			const open = await prisma.workout.create({
				data: {
					userId: owner.userId,
					localDate: new Date(`${shiftDate(today(), -3)}T00:00:00Z`),
					source: 'LIVE',
					startedAt: longAgo,
				},
			})
			const entry = await prisma.exerciseEntry.create({
				data: {
					userId: owner.userId,
					workoutId: open.id,
					exerciseId: exercise.id,
					localDate: open.localDate,
					name: BENCH,
					kind: 'STRENGTH',
					source: 'MANUAL',
					position: 0,
					performedAt: longAgo,
				},
			})
			await prisma.exerciseSet.create({
				data: {
					userId: owner.userId,
					exerciseEntryId: entry.id,
					position: 0,
					reps: 5,
					weightKg: OPEN_LIVE_KG,
				},
			})

			const second = await saveForm(owner, 1, 85)

			// were the open 200 kg counted, 85 would not beat it
			expect(await storedAll([first, second])).toEqual([[], ['WEIGHT']])
			expect(await stored(open.id)).toEqual([])
		})
	})

	describe('delete and restore', () => {
		it('deleting the record session moves the trophy to the next one that now beats the earlier', async () => {
			await start()
			const owner = await registerUser(app, 'owner@kus.app')
			const a = await saveForm(owner, 3, 80)
			const b = await saveForm(owner, 2, 90)
			const c = await saveForm(owner, 1, 85)
			expect(await storedAll([a, b, c])).toEqual([[], ['WEIGHT'], []])

			await owner.agent.delete(`${WORKOUTS_URL}/${b}`).expect(204)

			expect(await storedAll([a, c])).toEqual([[], ['WEIGHT']])
		})

		it('deleting a session without a record changes nothing', async () => {
			await start()
			const owner = await registerUser(app, 'owner@kus.app')
			const a = await saveForm(owner, 3, 80)
			const b = await saveForm(owner, 2, 90)
			const c = await saveForm(owner, 1, 85)

			await owner.agent.delete(`${WORKOUTS_URL}/${c}`).expect(204)

			expect(await storedAll([a, b])).toEqual([[], ['WEIGHT']])
		})

		it('restoring brings the trophies back as before', async () => {
			await start()
			const owner = await registerUser(app, 'owner@kus.app')
			const a = await saveForm(owner, 3, 80)
			const b = await saveForm(owner, 2, 90)
			const c = await saveForm(owner, 1, 85)
			await owner.agent.delete(`${WORKOUTS_URL}/${b}`).expect(204)

			await owner.agent.post(`${WORKOUTS_URL}/${b}/restore`).expect(200)

			expect(await storedAll([a, b, c])).toEqual([[], ['WEIGHT'], []])
		})
	})

	describe('chat', () => {
		it('lowering a record by replaceRef removes its trophy and the later session gets its own', async () => {
			await start()
			const owner = await registerUser(app, 'owner@kus.app')
			const a = await sendWorkout(owner, 80)
			const b = await sendWorkout(owner, 82.5)
			const c = await sendWorkout(owner, 82.5)
			expect(await storedAll([a, b, c])).toEqual([[], ['WEIGHT'], []])

			fake.respond(createCompletion([benchCall(70, { replaceRef: 'w2' })]))
			await send(owner, 'ні, жим був 70')

			expect(await storedAll([a, b, c])).toEqual([[], [], ['WEIGHT']])
		})

		it('raising a session by replaceRef gives it the trophy and takes it from the later one', async () => {
			await start()
			const owner = await registerUser(app, 'owner@kus.app')
			const a = await sendWorkout(owner, 80)
			const b = await sendWorkout(owner, 82.5)
			const c = await sendWorkout(owner, 85)
			expect(await storedAll([a, b, c])).toEqual([[], ['WEIGHT'], ['WEIGHT']])

			fake.respond(createCompletion([benchCall(90, { replaceRef: 'w2' })]))
			await send(owner, 'ні, жим був 90')

			expect(await storedAll([a, b, c])).toEqual([[], ['WEIGHT'], []])
		})

		it('deleting and restoring a session by its ref moves the trophies and brings them back', async () => {
			await start()
			const owner = await registerUser(app, 'owner@kus.app')
			const a = await sendWorkout(owner, 80)
			const b = await sendWorkout(owner, 90)
			const c = await sendWorkout(owner, 85)
			expect(await storedAll([a, b, c])).toEqual([[], ['WEIGHT'], []])

			fake.respond(
				createCompletion([{ name: 'delete_entry', args: { refs: ['w2'] } }, reply('Прибрав.')]),
			)
			await send(owner, 'видали другий жим')
			expect(await storedAll([a, c])).toEqual([[], ['WEIGHT']])

			// after the delete: w1, w2 active, the deleted one is w3
			fake.respond(
				createCompletion([{ name: 'restore_entry', args: { refs: ['w3'] } }, reply('Повернув.')]),
			)
			await send(owner, 'поверни')
			expect(await storedAll([a, b, c])).toEqual([[], ['WEIGHT'], []])
		})
	})

	describe('isolation', () => {
		it('never reads or touches the sessions of another user', async () => {
			await start()
			const owner = await registerUser(app, 'owner@kus.app')
			const stranger = await registerUser(app, 'stranger@kus.app')
			const strangerFirst = await saveForm(stranger, 3, 200)
			const strangerSecond = await saveForm(stranger, 2, 210)
			const strangerBefore = await storedAll([strangerFirst, strangerSecond])
			expect(strangerBefore).toEqual([[], ['WEIGHT']])

			// the stranger's 200 / 210 kg must not be a baseline for the owner's 85
			const a = await saveForm(owner, 3, 80)
			const b = await saveForm(owner, 2, 85)
			expect(await storedAll([a, b])).toEqual([[], ['WEIGHT']])
			await owner.agent.delete(`${WORKOUTS_URL}/${b}`).expect(204)
			await owner.agent.post(`${WORKOUTS_URL}/${b}/restore`).expect(200)
			await saveForm(owner, 1, 90)

			expect(await storedAll([strangerFirst, strangerSecond])).toEqual(strangerBefore)
			// and the owner cannot delete the stranger's session
			await owner.agent.delete(`${WORKOUTS_URL}/${strangerSecond}`).expect(404)
			expect(await stored(strangerSecond)).toEqual(['WEIGHT'])
			const workout = await prisma.workout.findUniqueOrThrow({ where: { id: strangerSecond } })
			expect(workout.deletedAt).toBeNull()
		})
	})
})
