import { randomUUID } from 'node:crypto'

import { Logger } from '@nestjs/common'
import type { NestExpressApplication } from '@nestjs/platform-express'
import {
	apiErrorResponseSchema,
	createDataResponseSchema,
	liveWorkoutResponseSchema,
	sendMessageResponseSchema,
	workoutFinishedSchema,
	workoutStatsResponseSchema,
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
	type TestUser,
} from './workout-logging-test-utils'

const MESSAGES_URL = '/api/v1/messages'
const STATS_URL = '/api/v1/workouts/stats'
const BENCH = 'Жим лежачи'
const SET_STARTED_MIN_AGO = 5
const SESSION_STARTED_MIN_AGO = 20
const KCAL_TOLERANCE = 0.05

const sendResponse = createDataResponseSchema(sendMessageResponseSchema)
const liveResponse = createDataResponseSchema(liveWorkoutResponseSchema)
const nullableLive = createDataResponseSchema(liveWorkoutResponseSchema.nullable())
const finishResponse = createDataResponseSchema(workoutFinishedSchema)
const statsResponse = createDataResponseSchema(workoutStatsResponseSchema)
const fake = createFakeAiClient()

const benchCall = (args: Record<string, unknown> = {}): FakeToolCall => ({
	name: 'log_workout',
	args: {
		exercises: [{ name: BENCH, kind: 'STRENGTH', sets: [{ reps: 8, weightKg: 85, count: 2 }] }],
		reply: 'Виправив.',
		replaceRef: 'w2',
		...args,
	},
})

describe('a chat replaceRef edits a live exercise in place (e2e, real DB, fake model)', () => {
	let app: NestExpressApplication
	let prisma: PrismaService
	vi.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined)
	vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined)

	const start = async (): Promise<void> => {
		fake.reset()
		;({ app, prisma } = await createDbTestApp({ aiClient: fake.client }))
	}

	const send = async (who: TestUser, text: string) => {
		const response = await who.agent
			.post(MESSAGES_URL)
			.send({ clientMessageId: randomUUID(), text })
			.expect(201)
		return sendResponse.parse(response.body).data
	}

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

	/** Puts the session's start and the time of its sets/rows back, as a workout that has been going on. */
	const backdate = async (id: string) => {
		const lastSet = minutesAgo(SET_STARTED_MIN_AGO)
		await prisma.workout.update({
			where: { id },
			data: { startedAt: minutesAgo(SESSION_STARTED_MIN_AGO) },
		})
		await prisma.exerciseSet.updateMany({
			where: { exerciseEntry: { workoutId: id } },
			data: { doneAt: lastSet },
		})
		await prisma.exerciseEntry.updateMany({
			where: { workoutId: id },
			data: { performedAt: lastSet },
		})
		return lastSet
	}

	const startLive = async (who: TestUser, exercises: unknown[]) => {
		const created = await who.agent.post(LIVE_URL).send({ templateId: null }).expect(201)
		const { workout } = liveResponse.parse(created.body).data
		await who.agent
			.put(`${LIVE_URL}/${workout.id}`)
			.send({ knownEditedAt: null, exercises })
			.expect(200)
		return workout.id
	}

	/** A finished earlier session (bench 80), so the second one can set a record; then the open one is w2. */
	const seedWithEarlierSession = async (who: TestUser, exercises: unknown[]) => {
		const first = await startLive(who, [liveExercise()])
		await backdate(first)
		await who.agent.post(`${LIVE_URL}/${first}/finish`).expect(200)
		const id = await startLive(who, exercises)
		const lastSet = await backdate(id)
		await addBodyWeight(who.userId, id)
		return { id, lastSet }
	}

	const getCurrent = async (who: TestUser) =>
		nullableLive.parse((await who.agent.get(`${LIVE_URL}/current`).expect(200)).body).data

	const getStats = async (who: TestUser) =>
		statsResponse.parse((await who.agent.get(STATS_URL).query({ period: 'week' }).expect(200)).body)
			.data

	afterEach(async () => {
		await app.close()
	})

	it('«ні, жим був 85»: one exercise 85 with the same clientKey, sets done, numbers not doubled, the next PUT keeps it', async () => {
		await start()
		const owner = await registerUser(app, 'owner@kus.app')
		const baseline = await registerUser(app, 'baseline@kus.app')
		const key = randomUUID()
		const { id, lastSet } = await seedWithEarlierSession(owner, [
			liveExercise({ clientKey: key, sets: [liveSet({ weightKg: 80 })] }),
		])
		// the same session told straight as 85 x 2 is what the chat edit must come to
		const baselineId = (
			await seedWithEarlierSession(baseline, [
				liveExercise({ sets: [liveSet({ weightKg: 85 }), liveSet({ weightKg: 85 })] }),
			])
		).id
		const startedAt = (await prisma.workout.findUniqueOrThrow({ where: { id } })).startedAt
		expect((await getCurrent(owner))?.editedAt).toBeNull()
		fake.respond(createCompletion([benchCall()]))

		const before = Date.now()
		const sent = await send(owner, 'ні, жим був 85')
		const after = Date.now()

		const current = await getCurrent(owner)
		expect(sent.assistantMessage.id).toBeTruthy()
		expect(current?.workout.exercises).toHaveLength(1)
		const [bench] = current?.workout.exercises ?? []
		expect(bench).toMatchObject({ name: BENCH, clientKey: key })
		expect(bench?.sets.map(({ weightKg }) => Number(weightKg))).toEqual([85, 85])
		const [first, second] = bench?.sets ?? []
		// the set at the same place keeps its time, the new one is done at the time of the edit
		expect(first?.doneAt).toBe(lastSet.toISOString())
		const secondAt = new Date(second?.doneAt ?? 0).getTime()
		expect(secondAt).toBeGreaterThanOrEqual(before - 1000)
		expect(secondAt).toBeLessThanOrEqual(after + 1000)
		expect(secondAt).toBeGreaterThanOrEqual(startedAt?.getTime() ?? 0)
		expect(current?.editedAt).not.toBeNull()
		expect(await prisma.exerciseEntry.count({ where: { workoutId: id } })).toBe(1)

		// a PUT of the client that took the server's values: no erase, no duplicate
		const serverExercise = liveExercise({
			clientKey: key,
			sets: (bench?.sets ?? []).map((set) => liveSet({ ...set })),
		})
		const stale = await owner.agent
			.put(`${LIVE_URL}/${id}`)
			.send({ knownEditedAt: null, exercises: [serverExercise] })
			.expect(409)
		expect(apiErrorResponseSchema.parse(stale.body)).toMatchObject({
			errorCode: 'WORKOUT_LIVE_CONFLICT',
			details: { reason: 'EDITED' },
		})
		const put = await owner.agent
			.put(`${LIVE_URL}/${id}`)
			.send({ knownEditedAt: current?.editedAt, exercises: [serverExercise] })
			.expect(200)
		const putExercises = liveResponse.parse(put.body).data.workout.exercises
		expect(putExercises).toHaveLength(1)
		expect(putExercises[0]?.sets.map(({ weightKg }) => Number(weightKg))).toEqual([85, 85])
		expect(await prisma.exerciseEntry.count({ where: { workoutId: id } })).toBe(1)

		const finished = finishResponse.parse(
			(await owner.agent.post(`${LIVE_URL}/${id}/finish`).expect(200)).body,
		).data
		const baselineFinished = finishResponse.parse(
			(await baseline.agent.post(`${LIVE_URL}/${baselineId}/finish`).expect(200)).body,
		).data
		expect(finished.workout.exercises).toHaveLength(1)
		expect(finished.workout.exercises[0]?.sets).toHaveLength(2)
		expect(finished.workout.exercises[0]?.record).toBe(
			baselineFinished.workout.exercises[0]?.record,
		)
		expect(finished.workout.exercises[0]?.record).toBe('WEIGHT')
		const kcal = finished.workout.kcal?.value ?? 0
		const baselineKcal = baselineFinished.workout.kcal?.value ?? 0
		expect(baselineKcal).toBeGreaterThan(0)
		expect(Math.abs(kcal - baselineKcal)).toBeLessThanOrEqual(baselineKcal * KCAL_TOLERANCE)
		const stats = await getStats(owner)
		const baselineStats = await getStats(baseline)
		expect(stats.overview.setCount).toBe(baselineStats.overview.setCount)
		expect(stats.overview.exerciseCount).toBe(baselineStats.overview.exerciseCount)
		expect(
			stats.exercises.map(({ setCount, sessionCount, best }) => [
				setCount,
				sessionCount,
				best?.weightKg,
			]),
		).toEqual(
			baselineStats.exercises.map(({ setCount, sessionCount, best }) => [
				setCount,
				sessionCount,
				best?.weightKg,
			]),
		)
		expect(stats.exercises[0]?.best?.weightKg).toBe(85)
	})

	it('a rewrite that keeps the set count carries the original doneAt of each set', async () => {
		await start()
		const owner = await registerUser(app, 'owner@kus.app')
		const key = randomUUID()
		const earlier = minutesAgo(SET_STARTED_MIN_AGO + 3)
		const later = minutesAgo(SET_STARTED_MIN_AGO)
		const { id } = await seedWithEarlierSession(owner, [
			liveExercise({
				clientKey: key,
				sets: [liveSet({ weightKg: 80 }), liveSet({ weightKg: 80 })],
			}),
		])
		const rows = await prisma.exerciseSet.findMany({
			where: { exerciseEntry: { workoutId: id } },
			orderBy: { position: 'asc' },
		})
		await prisma.exerciseSet.update({ where: { id: rows[0]?.id }, data: { doneAt: earlier } })
		await prisma.exerciseSet.update({ where: { id: rows[1]?.id }, data: { doneAt: later } })
		fake.respond(createCompletion([benchCall()]))

		await send(owner, 'ні, жим був 85')

		const sets = await prisma.exerciseSet.findMany({
			where: { exerciseEntry: { workoutId: id } },
			orderBy: { position: 'asc' },
		})
		expect(sets.map(({ weightKg }) => Number(weightKg))).toEqual([85, 85])
		expect(sets.map(({ doneAt }) => doneAt?.getTime())).toEqual([
			earlier.getTime(),
			later.getTime(),
		])
	})

	it('a new exercise told by the chat in a live session stays without a key and without doneAt, read-only', async () => {
		await start()
		const owner = await registerUser(app, 'owner@kus.app')
		const key = randomUUID()
		const { id } = await seedWithEarlierSession(owner, [liveExercise({ clientKey: key })])
		fake.respond(
			createCompletion([
				benchCall({
					exercises: [
						{ name: BENCH, kind: 'STRENGTH', sets: [{ reps: 8, weightKg: 85 }] },
						{ name: 'Присід', kind: 'STRENGTH', sets: [{ reps: 5, weightKg: 100, count: 3 }] },
					],
				}),
			]),
		)

		const sent = await send(owner, 'жим 85, ще присід 100 3×5')

		const rows = await prisma.exerciseEntry.findMany({
			where: { workoutId: id },
			orderBy: { position: 'asc' },
			include: { sets: true },
		})
		const [bench, squat] = rows
		expect(bench).toMatchObject({ name: BENCH, clientKey: key })
		expect(squat).toMatchObject({
			name: 'Присід',
			clientKey: null,
			sourceMessageId: sent.userMessage.id,
		})
		expect(squat?.sets).toHaveLength(3)
		expect(squat?.sets.every(({ doneAt }) => doneAt === null)).toBe(true)

		// the live cleanup at the finish does not touch what the chat told
		const finished = finishResponse.parse(
			(await owner.agent.post(`${LIVE_URL}/${id}/finish`).expect(200)).body,
		).data
		expect(finished.workout.exercises.map(({ name }) => name)).toEqual([BENCH, 'Присід'])
		expect(finished.workout.exercises[1]?.sets).toHaveLength(3)
		expect(finished.workout.exercises[1]?.clientKey).toBeNull()
	})

	it('an exercise renamed by the chat is another one: no key, no invented doneAt', async () => {
		await start()
		const owner = await registerUser(app, 'owner@kus.app')
		const { id } = await seedWithEarlierSession(owner, [liveExercise()])
		fake.respond(
			createCompletion([
				benchCall({
					exercises: [{ name: 'Присід', kind: 'STRENGTH', sets: [{ reps: 5, weightKg: 100 }] }],
				}),
			]),
		)

		await send(owner, 'ні, це був присід 100')

		const rows = await prisma.exerciseEntry.findMany({
			where: { workoutId: id },
			include: { sets: true },
		})
		expect(rows.map(({ name, clientKey }) => [name, clientKey])).toEqual([['Присід', null]])
		expect(rows[0]?.sets.map(({ doneAt }) => doneAt)).toEqual([null])
	})

	it('a chat-born exercise (no clientKey) rewritten by the chat gets neither a key nor doneAt', async () => {
		await start()
		const owner = await registerUser(app, 'owner@kus.app')
		const { id } = await seedWithEarlierSession(owner, [liveExercise()])
		await prisma.exerciseEntry.updateMany({ where: { workoutId: id }, data: { clientKey: null } })
		fake.respond(createCompletion([benchCall()]))

		await send(owner, 'ні, жим був 85')

		const rows = await prisma.exerciseEntry.findMany({
			where: { workoutId: id },
			include: { sets: true },
		})
		expect(rows).toHaveLength(1)
		expect(rows[0]?.clientKey).toBeNull()
		expect(rows[0]?.sets.map(({ doneAt }) => doneAt)).toEqual([null, null])
	})

	it('a CHAT session rewritten by replaceRef behaves as before', async () => {
		await start()
		const owner = await registerUser(app, 'owner@kus.app')
		fake.respond(
			createCompletion([benchCall({ replaceRef: undefined })]),
			createCompletion([benchCall({ replaceRef: 'w1' })]),
		)
		await send(owner, 'жим 80')

		await send(owner, 'ні, жим був 85')

		const workout = await prisma.workout.findFirstOrThrow({ where: { userId: owner.userId } })
		expect(workout.source).toBe('CHAT')
		const rows = await prisma.exerciseEntry.findMany({
			where: { workoutId: workout.id },
			include: { sets: true },
		})
		expect(rows).toHaveLength(1)
		expect(rows[0]?.clientKey).toBeNull()
		expect(rows[0]?.sets.map(({ weightKg, doneAt }) => [Number(weightKg), doneAt])).toEqual([
			[85, null],
			[85, null],
		])
	})

	it('a FORM session rewritten by replaceRef behaves as before', async () => {
		await start()
		const owner = await registerUser(app, 'owner@kus.app')
		await owner.agent
			.post(FORMS_URL)
			.send({
				clientRequestId: randomUUID(),
				templateId: null,
				localDate: getLocalDateString(new Date(), 'Europe/Warsaw'),
				startTime: '00:00',
				durationMin: 30,
				exercises: [{ name: BENCH, kind: 'STRENGTH', sets: [{ reps: 8, weightKg: 80 }] }],
			})
			.expect(201)
		fake.respond(createCompletion([benchCall({ replaceRef: 'w1' })]))

		await send(owner, 'ні, жим був 85')

		const workout = await prisma.workout.findFirstOrThrow({ where: { userId: owner.userId } })
		expect(workout.source).toBe('FORM')
		const rows = await prisma.exerciseEntry.findMany({
			where: { workoutId: workout.id },
			include: { sets: true },
		})
		expect(rows).toHaveLength(1)
		expect(rows[0]?.clientKey).toBeNull()
		expect(rows[0]?.sets.map(({ weightKg, doneAt }) => [Number(weightKg), doneAt])).toEqual([
			[85, null],
			[85, null],
		])
	})

	it("another user's session is not rewritten: the ref only sees one's own workouts", async () => {
		await start()
		const owner = await registerUser(app, 'owner@kus.app')
		const stranger = await registerUser(app, 'stranger@kus.app')
		const key = randomUUID()
		const { id } = await seedWithEarlierSession(owner, [liveExercise({ clientKey: key })])
		fake.respond(createCompletion([benchCall()]))

		// an unknown ref is the model's mistake, whatever the answer is, the owner's rows stay
		await stranger.agent
			.post(MESSAGES_URL)
			.send({ clientMessageId: randomUUID(), text: 'ні, жим був 85' })

		const rows = await prisma.exerciseEntry.findMany({
			where: { workoutId: id },
			include: { sets: true },
		})
		expect(rows.map(({ clientKey }) => clientKey)).toEqual([key])
		expect(rows[0]?.sets.map(({ weightKg }) => Number(weightKg))).toEqual([80])
	})
})
