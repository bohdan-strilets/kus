import { randomUUID } from 'node:crypto'

import { Logger } from '@nestjs/common'
import type { NestExpressApplication } from '@nestjs/platform-express'
import {
	chatMessageSchema,
	createCursorPaginatedResponseSchema,
	createDataResponseSchema,
	liveWorkoutResponseSchema,
	sendMessageResponseSchema,
	workoutFinishedSchema,
} from '@kus/shared'
import { afterEach, describe, expect, it, vi } from 'vitest'

import {
	createCompletion,
	createFakeAiClient,
	type FakeToolCall,
} from '../src/modules/ai/ai.test-utils'
import { getLocalDateString } from '../src/common/time'
import type { PrismaService } from '../src/prisma'
import { createDbTestApp } from './create-db-test-app'
import {
	FORMS_URL,
	LIVE_URL,
	liveExercise,
	liveSet,
	minutesAgo,
	registerUser,
	seedProgram,
	type TestUser,
} from './workout-logging-test-utils'

const MESSAGES_URL = '/api/v1/messages'
const AUTO_CLOSED_TEXT = 'Закрив тренування — після останнього підходу минуло понад 3 години.'

const sendResponse = createDataResponseSchema(sendMessageResponseSchema)
const liveResponse = createDataResponseSchema(liveWorkoutResponseSchema)
const nullableLive = createDataResponseSchema(liveWorkoutResponseSchema.nullable())
const finishResponse = createDataResponseSchema(workoutFinishedSchema)
const feedResponse = createCursorPaginatedResponseSchema(chatMessageSchema)
const fake = createFakeAiClient()

const squat = {
	name: 'Присід',
	kind: 'STRENGTH',
	sets: [{ reps: 5, weightKg: 100, count: 3 }],
}

const workoutCall = (args: Record<string, unknown>): FakeToolCall => ({
	name: 'log_workout',
	args: { exercises: [squat], reply: 'Записав.', ...args },
})

describe('chat with an open live session (e2e, real DB, fake model)', () => {
	let app: NestExpressApplication
	let prisma: PrismaService
	vi.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined)
	vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined)

	const start = async (): Promise<void> => {
		fake.reset()
		;({ app, prisma } = await createDbTestApp({ aiClient: fake.client }))
	}

	const user = (email: string): Promise<TestUser> => registerUser(app, email)

	const send = async (who: TestUser, text: string) => {
		const response = await who.agent
			.post(MESSAGES_URL)
			.send({ clientMessageId: randomUUID(), text })
			.expect(201)
		return sendResponse.parse(response.body).data
	}

	/** An open live session with one bench set done `setMinutesAgo` ago, started `startedMinutesAgo` ago. */
	const seedLive = async (
		who: TestUser,
		{ setMinutesAgo, startedMinutesAgo }: { setMinutesAgo: number; startedMinutesAgo: number },
	) => {
		const created = await who.agent.post(LIVE_URL).send({ templateId: null }).expect(201)
		const { workout } = liveResponse.parse(created.body).data
		await who.agent
			.put(`${LIVE_URL}/${workout.id}`)
			.send({ knownEditedAt: null, exercises: [liveExercise()] })
			.expect(200)
		// the snapshot clamps and the idle check refuse the past: move the rows themselves
		const lastSet = minutesAgo(setMinutesAgo)
		await prisma.workout.update({
			where: { id: workout.id },
			data: { startedAt: minutesAgo(startedMinutesAgo) },
		})
		await prisma.exerciseSet.updateMany({
			where: { exerciseEntry: { workoutId: workout.id } },
			data: { doneAt: lastSet },
		})
		await prisma.exerciseEntry.updateMany({
			where: { workoutId: workout.id },
			data: { performedAt: lastSet },
		})
		return workout.id
	}

	const getFeed = async (who: TestUser) =>
		feedResponse.parse((await who.agent.get(MESSAGES_URL).expect(200)).body).data

	afterEach(async () => {
		vi.useRealTimers()
		await app.close()
	})

	it("lists the open session in «Today's workouts» and appends to it by appendRef", async () => {
		await start()
		const owner = await user('owner@kus.app')
		const id = await seedLive(owner, { setMinutesAgo: 5, startedMinutesAgo: 30 })
		fake.respond(createCompletion([workoutCall({ appendRef: 'w1' })]))

		const sent = await send(owner, 'ще присід 100 3×5')

		const context = JSON.stringify(fake.bodies[0])
		expect(context).toContain("Today's workouts (refs")
		expect(context).toMatch(/w1 /)
		expect(context).toContain('\\"Жим лежачи\\"')
		expect(await prisma.workout.count({ where: { userId: owner.userId } })).toBe(1)
		const row = await prisma.workout.findUniqueOrThrow({
			where: { id: id },
			include: { exercises: { orderBy: { position: 'asc' } } },
		})
		expect(row.finishedAt).toBeNull()
		expect(row.source).toBe('LIVE')
		expect(row.exercises.map((entry) => entry.name)).toEqual(['Жим лежачи', 'Присід'])
		expect(row.exercises[1]?.sourceMessageId).toBe(sent.userMessage.id)
		expect(sent.assistantMessage.workoutCards).toMatchObject([{ variant: 'EXERCISES' }])
	})

	it('a log_workout without a ref joins the open session when the last action is within 3 h', async () => {
		await start()
		const owner = await user('owner@kus.app')
		const id = await seedLive(owner, { setMinutesAgo: 2 * 60 + 59, startedMinutesAgo: 3 * 60 + 20 })
		fake.respond(createCompletion([workoutCall({})]))

		await send(owner, 'присід 100 3×5')

		expect(await prisma.workout.count({ where: { userId: owner.userId } })).toBe(1)
		const entries = await prisma.exerciseEntry.findMany({ where: { workoutId: id } })
		expect(entries.map(({ name }) => name).sort()).toEqual(['Жим лежачи', 'Присід'])
		const row = await prisma.workout.findUniqueOrThrow({ where: { id } })
		expect(row.finishedAt).toBeNull()
	})

	it('a log_workout without a ref, the last action more than 3 h ago: the old session is auto-closed first, a new one starts', async () => {
		await start()
		const owner = await user('owner@kus.app')
		const lastSet = minutesAgo(3 * 60 + 1)
		const id = await seedLive(owner, { setMinutesAgo: 3 * 60 + 1, startedMinutesAgo: 3 * 60 + 40 })
		fake.respond(createCompletion([workoutCall({})]))

		const sent = await send(owner, 'присід 100 3×5')

		const old = await prisma.workout.findUniqueOrThrow({ where: { id } })
		expect(Math.abs((old.finishedAt?.getTime() ?? 0) - lastSet.getTime())).toBeLessThan(1000)
		expect(old.deletedAt).toBeNull()
		const sessions = await prisma.workout.findMany({ where: { userId: owner.userId } })
		expect(sessions).toHaveLength(2)
		const fresh = sessions.find((workout) => workout.id !== id)
		expect(fresh?.source).toBe('CHAT')
		expect(fresh?.finishedAt).toBeNull()
		// the auto-close summary is Kusik's own message and comes back among the changed ones
		const summary = sent.updatedMessages.find(
			({ id: messageId }) => messageId === old.finishedMessageId,
		)
		expect(summary).toMatchObject({ role: 'ASSISTANT', content: AUTO_CLOSED_TEXT, replyToId: null })
		expect(summary?.workoutCards).toMatchObject([{ workoutId: id, variant: 'SUMMARY' }])
	})

	it('an empty idle session is removed silently before the turn: no message', async () => {
		await start()
		const owner = await user('owner@kus.app')
		const created = await owner.agent.post(LIVE_URL).send({ templateId: null }).expect(201)
		const { workout } = liveResponse.parse(created.body).data
		await prisma.workout.update({
			where: { id: workout.id },
			data: { startedAt: minutesAgo(4 * 60) },
		})
		fake.respond(createCompletion([workoutCall({})]))

		const sent = await send(owner, 'присід 100 3×5')

		const old = await prisma.workout.findUniqueOrThrow({ where: { id: workout.id } })
		expect(old.deletedAt).not.toBeNull()
		expect(
			await prisma.message.count({
				where: { userId: owner.userId, role: 'ASSISTANT', replyToId: null },
			}),
		).toBe(0)
		expect(sent.updatedMessages.filter(({ replyToId }) => replyToId === null)).toEqual([])
	})

	it('crosses midnight: the last set 23:30 local, a message at 00:10 joins the session of the day before', async () => {
		await start()
		// Europe/Warsaw (UTC+1): 23:30 local on 10 Nov = 22:30Z, 00:10 local on 11 Nov = 23:10Z
		vi.useFakeTimers({ toFake: ['Date'], now: new Date('2026-11-10T22:30:00Z') })
		const owner = await user('owner@kus.app')
		const created = await owner.agent.post(LIVE_URL).send({ templateId: null }).expect(201)
		const { workout } = liveResponse.parse(created.body).data
		await owner.agent
			.put(`${LIVE_URL}/${workout.id}`)
			.send({ knownEditedAt: null, exercises: [liveExercise()] })
			.expect(200)
		vi.setSystemTime(new Date('2026-11-10T23:10:00Z'))
		await owner.agent
			.post('/api/v1/auth/login')
			.send({ email: 'owner@kus.app', password: 'correct-horse-battery' })
			.expect(200)
		fake.respond(createCompletion([workoutCall({})]))

		await send(owner, 'присід 100 3×5')

		expect(await prisma.workout.count({ where: { userId: owner.userId } })).toBe(1)
		const row = await prisma.workout.findUniqueOrThrow({
			where: { id: workout.id },
			include: { exercises: true },
		})
		expect(row.finishedAt).toBeNull()
		expect(row.localDate.toISOString().slice(0, 10)).toBe('2026-11-10')
		expect(row.exercises.map(({ name }) => name).sort()).toEqual(['Жим лежачи', 'Присід'])
		expect(
			await prisma.message.count({
				where: { userId: owner.userId, role: 'ASSISTANT', replyToId: null },
			}),
		).toBe(0)
	})

	it('across midnight the open session is in the context, so appendRef works there too', async () => {
		await start()
		vi.useFakeTimers({ toFake: ['Date'], now: new Date('2026-11-10T22:30:00Z') })
		const owner = await user('owner@kus.app')
		const created = await owner.agent.post(LIVE_URL).send({ templateId: null }).expect(201)
		const { workout } = liveResponse.parse(created.body).data
		await owner.agent
			.put(`${LIVE_URL}/${workout.id}`)
			.send({ knownEditedAt: null, exercises: [liveExercise()] })
			.expect(200)
		vi.setSystemTime(new Date('2026-11-10T23:10:00Z'))
		await owner.agent
			.post('/api/v1/auth/login')
			.send({ email: 'owner@kus.app', password: 'correct-horse-battery' })
			.expect(200)
		fake.respond(createCompletion([workoutCall({ appendRef: 'w1' })]))

		await send(owner, 'ще присід 100 3×5')

		expect(JSON.stringify(fake.bodies[0])).toContain("Today's workouts (refs")
		const entries = await prisma.exerciseEntry.findMany({ where: { workoutId: workout.id } })
		expect(entries.map(({ name }) => name).sort()).toEqual(['Жим лежачи', 'Присід'])
		expect(await prisma.workout.count({ where: { userId: owner.userId } })).toBe(1)
	})

	it('an exercise rewritten by the chat (no clientKey) survives a later snapshot that omits it, and counts as work', async () => {
		await start()
		const owner = await user('owner@kus.app')
		const first = await seedLive(owner, { setMinutesAgo: 5, startedMinutesAgo: 20 })
		await owner.agent.post(`${LIVE_URL}/${first}/finish`).expect(200)
		const id = await seedLive(owner, { setMinutesAgo: 5, startedMinutesAgo: 20 })
		await prisma.measurement.create({
			data: {
				userId: owner.userId,
				kind: 'WEIGHT',
				value: 80,
				localDate: (await prisma.workout.findUniqueOrThrow({ where: { id } })).localDate,
				measuredAt: new Date(),
				source: 'PROFILE',
			},
		})
		fake.respond(
			createCompletion([
				workoutCall({
					replaceRef: 'w2',
					exercises: [{ name: 'Жим лежачи', kind: 'STRENGTH', sets: [{ reps: 8, weightKg: 85 }] }],
				}),
			]),
		)
		await send(owner, 'ні, жим був 85')
		const current = nullableLive.parse(
			(await owner.agent.get(`${LIVE_URL}/current`).expect(200)).body,
		).data
		expect(current?.workout.exercises.map(({ name, clientKey }) => [name, clientKey])).toEqual([
			['Жим лежачи', null],
		])

		await owner.agent
			.put(`${LIVE_URL}/${id}`)
			.send({ knownEditedAt: current?.editedAt, exercises: [] })
			.expect(200)

		const rows = await prisma.exerciseEntry.findMany({ where: { workoutId: id } })
		expect(rows.map(({ name }) => name)).toEqual(['Жим лежачи'])
		const finished = finishResponse.parse(
			(await owner.agent.post(`${LIVE_URL}/${id}/finish`).expect(200)).body,
		).data
		// the rewritten set has no doneAt but is not cleaned; it is a record and kcal is estimated
		expect(finished.workout.exercises[0]?.sets).toHaveLength(1)
		// the chat edit already awarded the record (hasNewRecord only tells one new at the finish)
		expect(finished.workout.exercises[0]?.record).toBe('WEIGHT')
		expect(finished.workout.kcal?.source).toBe('ESTIMATE')
		const message = await prisma.message.findUniqueOrThrow({ where: { id: finished.messageId } })
		expect(message.content).toBe('Записав тренування. Рекорд — Жим лежачи.')
	})

	it('a log_workout with a templateRef does not change the template of an open session that has one', async () => {
		await start()
		const owner = await user('owner@kus.app')
		const program = await seedProgram(app, owner)
		const [templateA] = program.templates
		const created = await owner.agent.post(LIVE_URL).send({ templateId: templateA?.id }).expect(201)
		const { workout } = liveResponse.parse(created.body).data
		fake.respond(createCompletion([workoutCall({ templateRef: 't2' })]))

		await send(owner, 'присід 100 3×5')

		const row = await prisma.workout.findUniqueOrThrow({ where: { id: workout.id } })
		expect(row.templateId).toBe(templateA?.id)
		expect(await prisma.exerciseEntry.count({ where: { workoutId: workout.id } })).toBe(1)
	})

	describe('exercises told in the chat inside an open live session', () => {
		const cardioCall = (args: Record<string, unknown> = {}): FakeToolCall =>
			workoutCall({
				exercises: [{ name: 'Бігова доріжка', kind: 'CARDIO', durationMin: 10 }],
				...args,
			})

		const addBodyWeight = async (userId: string, workoutId: string) => {
			const { localDate } = await prisma.workout.findUniqueOrThrow({ where: { id: workoutId } })
			await prisma.measurement.create({
				data: {
					userId,
					kind: 'WEIGHT',
					value: 80,
					localDate,
					measuredAt: new Date(),
					source: 'PROFILE',
				},
			})
		}

		const getCurrentKcal = async (who: TestUser): Promise<number> => {
			const current = nullableLive.parse(
				(await who.agent.get(`${LIVE_URL}/current`).expect(200)).body,
			).data
			return current?.workout.kcal?.value ?? 0
		}

		it('«ще 10 хв доріжки» then POST finish: the chat cardio stays, is in the card and is counted in kcal', async () => {
			await start()
			const owner = await user('owner@kus.app')
			const id = await seedLive(owner, { setMinutesAgo: 5, startedMinutesAgo: 20 })
			await addBodyWeight(owner.userId, id)
			const kcalBefore = await getCurrentKcal(owner)
			fake.respond(createCompletion([cardioCall({ appendRef: 'w1' })]))
			await send(owner, 'ще 10 хв доріжки')

			const response = await owner.agent.post(`${LIVE_URL}/${id}/finish`).expect(200)

			const done = finishResponse.parse(response.body).data
			expect(done.workout.exercises.map(({ name }) => name)).toEqual([
				'Жим лежачи',
				'Бігова доріжка',
			])
			expect(done.workout.exercises[1]?.durationMin).toBe(10)
			expect(done.workout.kcal?.source).toBe('ESTIMATE')
			expect(done.workout.kcal?.value).toBeGreaterThan(kcalBefore)
			const summary = (await getFeed(owner)).find((message) => message.id === done.messageId)
			expect(summary?.workoutCards).toMatchObject([{ workoutId: id, variant: 'SUMMARY' }])
			expect(summary?.workoutCards[0]?.exerciseIds).toHaveLength(2)
		})

		it('the same with «все» in the chat: the session is closed, not deleted, the cardio is in place', async () => {
			await start()
			const owner = await user('owner@kus.app')
			const id = await seedLive(owner, { setMinutesAgo: 5, startedMinutesAgo: 20 })
			fake.respond(createCompletion([cardioCall({ appendRef: 'w1', finish: true })]))

			const sent = await send(owner, 'ще 10 хв доріжки, все')

			const row = await prisma.workout.findUniqueOrThrow({
				where: { id },
				include: { exercises: { orderBy: { position: 'asc' } } },
			})
			expect(row.deletedAt).toBeNull()
			expect(row.finishedAt).not.toBeNull()
			expect(row.exercises.map(({ name, durationMin }) => [name, durationMin])).toEqual([
				['Жим лежачи', null],
				['Бігова доріжка', 10],
			])
			expect(sent.assistantMessage.workoutCards).toMatchObject([
				{ workoutId: id, variant: 'SUMMARY' },
			])
		})

		it('a session with only chat exercises (no live sets): finish closes it with a summary, never deletes it', async () => {
			await start()
			const owner = await user('owner@kus.app')
			const created = await owner.agent.post(LIVE_URL).send({ templateId: null }).expect(201)
			const { workout } = liveResponse.parse(created.body).data
			await addBodyWeight(owner.userId, workout.id)
			fake.respond(createCompletion([cardioCall({ appendRef: 'w1' })]))
			await send(owner, 'доріжка 10 хв')

			const response = await owner.agent.post(`${LIVE_URL}/${workout.id}/finish`).expect(200)

			expect((response.body as { data: { discarded?: boolean } }).data.discarded).toBeUndefined()
			const done = finishResponse.parse(response.body).data
			expect(done.workout.exercises.map(({ name }) => name)).toEqual(['Бігова доріжка'])
			expect(done.workout.kcal?.source).toBe('ESTIMATE')
			expect(
				await prisma.message.count({
					where: { userId: owner.userId, role: 'ASSISTANT', replyToId: null },
				}),
			).toBe(1)
		})

		it('a chat exercise without sets or numbers still counts as work (finish keeps the session)', async () => {
			await start()
			const owner = await user('owner@kus.app')
			const created = await owner.agent.post(LIVE_URL).send({ templateId: null }).expect(201)
			const { workout } = liveResponse.parse(created.body).data
			await prisma.exerciseEntry.create({
				data: {
					userId: owner.userId,
					workoutId: workout.id,
					name: 'Розтяжка',
					kind: 'OTHER',
					source: 'MANUAL',
					performedAt: new Date(),
					localDate: workout.localDate ? new Date(workout.localDate) : new Date(),
					sourceMessageId: (
						await prisma.message.create({
							data: {
								userId: owner.userId,
								role: 'USER',
								content: 'розтяжка',
								status: 'COMPLETED',
							},
						})
					).id,
				},
			})

			const response = await owner.agent.post(`${LIVE_URL}/${workout.id}/finish`).expect(200)

			expect((response.body as { data: { discarded?: boolean } }).data.discarded).toBeUndefined()
			expect(finishResponse.parse(response.body).data.workout.exercises).toHaveLength(1)
		})
	})

	describe('FORM and CHAT sessions are never touched by the live cleanup', () => {
		const closeAll = (): FakeToolCall =>
			workoutCall({ appendRef: 'w1', exercises: [], finish: true, reply: 'Готово.' })

		const countSets = (workoutIds: string[]) =>
			prisma.exerciseSet.count({ where: { exerciseEntry: { workoutId: { in: workoutIds } } } })

		/** A finished CHAT workout and a FORM one, their entries even dressed as live-mode rows. */
		const seedOtherSessions = async (who: TestUser): Promise<string[]> => {
			fake.respond(createCompletion([workoutCall({ finish: true })]))
			await send(who, 'присід 100 3×5, все')
			const formResponse = await who.agent
				.post(FORMS_URL)
				.send({
					clientRequestId: randomUUID(),
					templateId: null,
					localDate: getLocalDateString(new Date(), 'Europe/Warsaw'),
					startTime: '00:00',
					durationMin: 30,
					exercises: [{ name: 'Жим лежачи', kind: 'STRENGTH', sets: [{ reps: 8, weightKg: 60 }] }],
				})
				.expect(201)
			const ids = (
				await prisma.workout.findMany({ where: { userId: who.userId }, select: { id: true } })
			).map(({ id }) => id)
			expect(ids).toHaveLength(2)
			expect(
				(formResponse.body as { data: { workout: { source: string } } }).data.workout.source,
			).toBe('FORM')
			for (const workoutId of ids) {
				// the worst case: a non-live session with a clientKey and sets without doneAt
				await prisma.exerciseEntry.updateMany({
					where: { workoutId },
					data: { clientKey: randomUUID(), sourceMessageId: null },
				})
			}
			return ids
		}

		it('finish and the idle auto-close of a live session leave their sets (doneAt null) alone', async () => {
			await start()
			const owner = await user('owner@kus.app')
			const others = await seedOtherSessions(owner)
			const before = await countSets(others)
			expect(before).toBeGreaterThan(0)
			expect(
				await prisma.exerciseSet.count({
					where: { exerciseEntry: { workoutId: { in: others } }, doneAt: null },
				}),
			).toBe(before)

			const first = await seedLive(owner, { setMinutesAgo: 5, startedMinutesAgo: 20 })
			await owner.agent.post(`${LIVE_URL}/${first}/finish`).expect(200)
			const second = await seedLive(owner, { setMinutesAgo: 4 * 60, startedMinutesAgo: 5 * 60 })
			await owner.agent.get(`${LIVE_URL}/current`).expect(200)

			expect(
				(await prisma.workout.findUniqueOrThrow({ where: { id: second } })).finishedAt,
			).not.toBeNull()
			expect(await countSets(others)).toBe(before)
			expect(await prisma.exerciseEntry.count({ where: { workoutId: { in: others } } })).toBe(2)
		})

		it('«все» on a plain CHAT session keeps its sets and closes it', async () => {
			await start()
			const owner = await user('owner@kus.app')
			fake.respond(createCompletion([workoutCall({})]), createCompletion([closeAll()]))
			await send(owner, 'присід 100 3×5')
			const { id } = await prisma.workout.findFirstOrThrow({ where: { userId: owner.userId } })
			const before = await prisma.exerciseSet.count({ where: { exerciseEntry: { workoutId: id } } })

			await send(owner, 'все')

			const row = await prisma.workout.findUniqueOrThrow({ where: { id } })
			expect(row.source).toBe('CHAT')
			expect(row.finishedAt).not.toBeNull()
			expect(row.deletedAt).toBeNull()
			expect(await prisma.exerciseSet.count({ where: { exerciseEntry: { workoutId: id } } })).toBe(
				before,
			)
		})
	})

	describe('«все» and the auto-close without done work', () => {
		const seedPlannedOnly = async (who: TestUser) => {
			const created = await who.agent.post(LIVE_URL).send({ templateId: null }).expect(201)
			const { workout } = liveResponse.parse(created.body).data
			await who.agent
				.put(`${LIVE_URL}/${workout.id}`)
				.send({
					knownEditedAt: null,
					exercises: [liveExercise({ sets: [liveSet({ doneAt: null })] })],
				})
				.expect(200)
			return workout.id
		}

		const countKusikSummaries = (userId: string) =>
			prisma.message.count({ where: { userId, role: 'ASSISTANT', replyToId: null } })

		const closeCall = workoutCall({
			appendRef: 'w1',
			exercises: [],
			finish: true,
			reply: 'Готово.',
		})

		it('«все» with appendRef on a session with nothing done: it is deleted, no summary, the turn succeeds', async () => {
			await start()
			const owner = await user('owner@kus.app')
			const id = await seedPlannedOnly(owner)
			fake.respond(createCompletion([closeCall]))

			const sent = await send(owner, 'все')

			expect(sent.assistantMessage.workoutCards).toEqual([])
			const row = await prisma.workout.findUniqueOrThrow({ where: { id } })
			expect(row.deletedAt).not.toBeNull()
			expect(row.finishedAt).toBeNull()
			expect(await countKusikSummaries(owner.userId)).toBe(0)
		})

		it('only planned sets are dropped on «все»; the done ones stay and the session is finished', async () => {
			await start()
			const owner = await user('owner@kus.app')
			const created = await owner.agent.post(LIVE_URL).send({ templateId: null }).expect(201)
			const { workout } = liveResponse.parse(created.body).data
			await owner.agent
				.put(`${LIVE_URL}/${workout.id}`)
				.send({
					knownEditedAt: null,
					exercises: [
						liveExercise({
							sets: [liveSet(), liveSet({ doneAt: null }), liveSet({ doneAt: null })],
						}),
					],
				})
				.expect(200)
			fake.respond(createCompletion([closeCall]))

			await send(owner, 'все')

			const row = await prisma.workout.findUniqueOrThrow({
				where: { id: workout.id },
				include: { exercises: { include: { sets: true } } },
			})
			expect(row.finishedAt).not.toBeNull()
			expect(row.exercises.map(({ sets }) => sets.length)).toEqual([1])
		})

		it('exercises told in the chat are done work: «все» keeps such a session', async () => {
			await start()
			const owner = await user('owner@kus.app')
			const created = await owner.agent.post(LIVE_URL).send({ templateId: null }).expect(201)
			const { workout } = liveResponse.parse(created.body).data
			fake.respond(
				createCompletion([workoutCall({ appendRef: 'w1' })]),
				createCompletion([closeCall]),
			)
			await send(owner, 'присід 100 3×5')

			await send(owner, 'все')

			const row = await prisma.workout.findUniqueOrThrow({ where: { id: workout.id } })
			expect(row.deletedAt).toBeNull()
			expect(row.finishedAt).not.toBeNull()
			expect(await prisma.exerciseEntry.count({ where: { workoutId: workout.id } })).toBe(1)
		})

		it('the auto-close keeps a session with only chat exercises and posts the summary', async () => {
			await start()
			const owner = await user('owner@kus.app')
			const created = await owner.agent.post(LIVE_URL).send({ templateId: null }).expect(201)
			const { workout } = liveResponse.parse(created.body).data
			fake.respond(createCompletion([workoutCall({ appendRef: 'w1' })]))
			await send(owner, 'присід 100 3×5')
			await prisma.workout.update({
				where: { id: workout.id },
				data: { startedAt: minutesAgo(5 * 60) },
			})
			await prisma.exerciseEntry.updateMany({
				where: { workoutId: workout.id },
				data: { performedAt: minutesAgo(4 * 60) },
			})

			const current = await owner.agent.get(`${LIVE_URL}/current`).expect(200)

			expect(nullableLive.parse(current.body).data).toBeNull()
			const row = await prisma.workout.findUniqueOrThrow({ where: { id: workout.id } })
			expect(row.deletedAt).toBeNull()
			expect(row.finishedAt).not.toBeNull()
			expect(await countKusikSummaries(owner.userId)).toBe(1)
		})

		it('the auto-close of a session with only planned sets deletes it silently', async () => {
			await start()
			const owner = await user('owner@kus.app')
			const id = await seedPlannedOnly(owner)
			await prisma.workout.update({ where: { id }, data: { startedAt: minutesAgo(5 * 60) } })
			await prisma.exerciseEntry.updateMany({
				where: { workoutId: id },
				data: { performedAt: minutesAgo(4 * 60) },
			})

			await owner.agent.get(`${LIVE_URL}/current`).expect(200)

			const row = await prisma.workout.findUniqueOrThrow({ where: { id } })
			expect(row.deletedAt).not.toBeNull()
			expect(await countKusikSummaries(owner.userId)).toBe(0)
		})
	})

	describe('«все» in the chat', () => {
		it('closes the open session now when the last set was 10 min ago; the duration runs from the start', async () => {
			await start()
			const owner = await user('owner@kus.app')
			const id = await seedLive(owner, { setMinutesAgo: 10, startedMinutesAgo: 70 })
			fake.respond(
				createCompletion([
					workoutCall({ appendRef: 'w1', exercises: [], finish: true, reply: 'Готово.' }),
				]),
			)
			const before = Date.now()

			const sent = await send(owner, 'все')

			const row = await prisma.workout.findUniqueOrThrow({ where: { id } })
			expect(row.finishedMessageId).toBe(sent.userMessage.id)
			expect(row.finishedAt?.getTime()).toBeGreaterThanOrEqual(before)
			expect(row.durationMin).toBe(70)
			expect(sent.assistantMessage.workoutCards).toMatchObject([
				{ workoutId: id, variant: 'SUMMARY' },
			])
			expect(await prisma.workout.count({ where: { userId: owner.userId } })).toBe(1)
		})

		it('closes at the last set when it was more than 30 min ago', async () => {
			await start()
			const owner = await user('owner@kus.app')
			const lastSet = minutesAgo(50)
			const id = await seedLive(owner, { setMinutesAgo: 50, startedMinutesAgo: 80 })
			fake.respond(
				createCompletion([
					workoutCall({ appendRef: 'w1', exercises: [], finish: true, reply: 'Готово.' }),
				]),
			)

			await send(owner, 'все')

			const row = await prisma.workout.findUniqueOrThrow({ where: { id } })
			expect(Math.abs((row.finishedAt?.getTime() ?? 0) - lastSet.getTime())).toBeLessThan(1000)
			expect(row.durationMin).toBe(30)
		})

		it('an open session closed by «все» then shows everywhere and a live finish answers 200 with the chat reply', async () => {
			await start()
			const owner = await user('owner@kus.app')
			const id = await seedLive(owner, { setMinutesAgo: 5, startedMinutesAgo: 40 })
			fake.respond(
				createCompletion([
					workoutCall({ appendRef: 'w1', exercises: [], finish: true, reply: 'Готово.' }),
				]),
			)
			const sent = await send(owner, 'все')

			const second = await owner.agent.post(`${LIVE_URL}/${id}/finish`).expect(200)

			expect(finishResponse.parse(second.body).data.messageId).toBe(sent.assistantMessage.id)
			const day = (await prisma.workout.findUniqueOrThrow({ where: { id } })).localDate
				.toISOString()
				.slice(0, 10)
			const list = await owner.agent.get(`/api/v1/workouts/day/${day}`).expect(200)
			expect((list.body as { data: { id: string }[] }).data.map((workout) => workout.id)).toEqual([
				id,
			])
		})
	})

	describe('replace by the chat bumps editedAt', () => {
		it('a stale PUT is 409 EDITED, and the chat exercises survive the next snapshot', async () => {
			await start()
			const owner = await user('owner@kus.app')
			const id = await seedLive(owner, { setMinutesAgo: 5, startedMinutesAgo: 20 })
			fake.respond(createCompletion([workoutCall({ replaceRef: 'w1' })]))
			await send(owner, 'ні, лише присід 100 3×5')

			const stale = await owner.agent
				.put(`${LIVE_URL}/${id}`)
				.send({ knownEditedAt: null, exercises: [liveExercise()] })
				.expect(409)

			expect(stale.body).toMatchObject({
				errorCode: 'WORKOUT_LIVE_CONFLICT',
				details: { reason: 'EDITED' },
			})
			const current = nullableLive.parse(
				(await owner.agent.get(`${LIVE_URL}/current`).expect(200)).body,
			).data
			expect(current?.editedAt).not.toBeNull()
			expect(current?.workout.exercises.map(({ name }) => name)).toEqual(['Присід'])
			// the fresh editedAt is accepted; the chat's «Присід» is not the live mode's and stays
			await owner.agent
				.put(`${LIVE_URL}/${id}`)
				.send({ knownEditedAt: current?.editedAt, exercises: [] })
				.expect(200)
			const rows = await prisma.exerciseEntry.findMany({ where: { workoutId: id } })
			expect(rows.map(({ name }) => name)).toEqual(['Присід'])
		})
	})

	describe('the summary card in the chat feed', () => {
		it("appears on Kusik's own message after a live finish and turns into the «deleted» line after a delete", async () => {
			await start()
			const owner = await user('owner@kus.app')
			const id = await seedLive(owner, { setMinutesAgo: 5, startedMinutesAgo: 40 })
			const done = finishResponse.parse(
				(await owner.agent.post(`${LIVE_URL}/${id}/finish`).expect(200)).body,
			).data

			const summary = (await getFeed(owner)).find((message) => message.id === done.messageId)

			expect(summary).toMatchObject({ role: 'ASSISTANT', replyToId: null })
			expect(summary?.workoutCards).toMatchObject([{ workoutId: id, variant: 'SUMMARY' }])
			expect(summary?.workouts[0]).toMatchObject({ id, isDeleted: false, source: 'LIVE' })

			await owner.agent.delete(`/api/v1/workouts/${id}`).expect(204)

			const afterDelete = (await getFeed(owner)).find((message) => message.id === done.messageId)
			expect(afterDelete?.workouts[0]).toMatchObject({ id, isDeleted: true })
		})

		it("never shows another user's open session in the model context", async () => {
			await start()
			const owner = await user('owner@kus.app')
			const stranger = await user('stranger@kus.app')
			await seedLive(stranger, { setMinutesAgo: 5, startedMinutesAgo: 20 })
			fake.respond(createCompletion([workoutCall({})]))

			await send(owner, 'ще присід')

			expect(JSON.stringify(fake.bodies[0])).not.toContain("Today's workouts (refs")
			const strangerEntries = await prisma.exerciseEntry.findMany({
				where: { userId: stranger.userId },
			})
			expect(strangerEntries.map(({ name }) => name)).toEqual(['Жим лежачи'])
		})
	})
})
