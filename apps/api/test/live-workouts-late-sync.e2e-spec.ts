import { randomUUID } from 'node:crypto'

import { Logger } from '@nestjs/common'
import type { NestExpressApplication } from '@nestjs/platform-express'
import {
	apiErrorResponseSchema,
	createDataResponseSchema,
	liveWorkoutResponseSchema,
	workoutFinishedSchema,
	workoutResponseSchema,
} from '@kus/shared'
import { afterEach, describe, expect, it, vi } from 'vitest'

import type { PrismaService } from '../src/prisma'
import { createDbTestApp } from './create-db-test-app'
import {
	LIVE_URL,
	liveExercise,
	liveSet,
	minutesAgo,
	registerUser,
	type TestUser,
} from './workout-logging-test-utils'

const HOUR_MIN = 60
const AUTO_CLOSED_TEXT = 'Закрив тренування — після останнього підходу минуло понад 3 години.'
const UNKNOWN_ID = '0199b3a4-0000-7000-8000-000000000001'

const liveResponse = createDataResponseSchema(liveWorkoutResponseSchema)
const nullableLive = createDataResponseSchema(liveWorkoutResponseSchema.nullable())
const finishResponse = createDataResponseSchema(workoutFinishedSchema)
const workoutDetail = createDataResponseSchema(workoutResponseSchema)

describe('live workouts: a late sync of an offline phone (e2e, real DB)', () => {
	let app: NestExpressApplication
	let prisma: PrismaService
	vi.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined)

	const start = async (): Promise<void> => {
		;({ app, prisma } = await createDbTestApp())
	}

	const user = (email: string): Promise<TestUser> => registerUser(app, email)

	const startLive = async (who: TestUser) =>
		liveResponse.parse((await who.agent.post(LIVE_URL).send({ templateId: null }).expect(201)).body)
			.data

	const putSnapshot = (who: TestUser, id: string, exercises: unknown[]) =>
		who.agent.put(`${LIVE_URL}/${id}`).send({ knownEditedAt: null, exercises })

	const getCurrent = async (who: TestUser) =>
		nullableLive.parse((await who.agent.get(`${LIVE_URL}/current`).expect(200)).body).data

	const readSummaries = (userId: string) =>
		prisma.message.findMany({
			where: { userId, role: 'ASSISTANT', replyToId: null },
			orderBy: { createdAt: 'asc' },
		})

	/** Ages a session as the server saw it: its start and (when written) its one set. */
	const ageSession = async (id: string, startedMinutes: number, lastSetMinutes: number | null) => {
		await prisma.workout.update({ where: { id }, data: { startedAt: minutesAgo(startedMinutes) } })
		if (lastSetMinutes === null) return
		const at = minutesAgo(lastSetMinutes)
		await prisma.exerciseSet.updateMany({
			where: { exerciseEntry: { workoutId: id } },
			data: { doneAt: at },
		})
		await prisma.exerciseEntry.updateMany({ where: { workoutId: id }, data: { performedAt: at } })
	}

	/** A session with one stored set done `lastSetMinutes` ago; returns its id and the exercise. */
	const startAged = async (who: TestUser, startedMinutes: number, lastSetMinutes: number) => {
		const { workout } = await startLive(who)
		const exercise = liveExercise()
		await putSnapshot(who, workout.id, [exercise]).expect(200)
		await ageSession(workout.id, startedMinutes, lastSetMinutes)
		return { id: workout.id, exercise }
	}

	afterEach(async () => {
		vi.useRealTimers()
		await app.close()
	})

	describe.each([4, 20])('server idle for %i h, the phone sends the sets done offline', (hours) => {
		const idleMin = hours * HOUR_MIN
		// the sets of the snapshot: older than 3 h, the last one is the end of the session
		const firstSetAgo = idleMin + 30
		const lastSetAgo = idleMin - 30

		it('current keeps it open; the PUT saves the sets and closes the session at the last done set', async () => {
			await start()
			const owner = await user('owner@kus.app')
			const { id, exercise } = await startAged(owner, idleMin + 90, idleMin)
			expect((await getCurrent(owner))?.workout.id).toBe(id)
			const lastSet = minutesAgo(lastSetAgo)

			const response = await putSnapshot(owner, id, [
				{
					...exercise,
					sets: [
						liveSet({ weightKg: 70, doneAt: minutesAgo(firstSetAgo).toISOString() }),
						liveSet({ weightKg: 75, doneAt: lastSet.toISOString() }),
						liveSet({ weightKg: 80, doneAt: null }),
					],
				},
			]).expect(200)

			const { workout } = liveResponse.parse(response.body).data
			// the planned set is only a plan: it is dropped when the session closes
			expect(workout.exercises[0]?.sets.map((set) => set.weightKg)).toEqual([70, 75])
			expect(workout.finishedAt).toBe(lastSet.toISOString())
			// started idleMin + 90 ago, the last set idleMin - 30 ago: 120 min
			expect(workout.durationMin).toBe(120)
			const row = await prisma.workout.findUniqueOrThrow({ where: { id } })
			expect(row.finishedAt?.toISOString()).toBe(lastSet.toISOString())
			expect(row.deletedAt).toBeNull()
			const sets = await prisma.exerciseSet.findMany({
				where: { exerciseEntry: { workoutId: id } },
				orderBy: { position: 'asc' },
			})
			expect(sets.map((set) => Number(set.weightKg))).toEqual([70, 75])
			const summaries = await readSummaries(owner.userId)
			expect(summaries.map((message) => message.content)).toEqual([AUTO_CLOSED_TEXT])
			expect(row.finishedMessageId).toBe(summaries[0]?.id)
			expect(await getCurrent(owner)).toBeNull()
			const detail = workoutDetail.parse(
				(await owner.agent.get(`/api/v1/workouts/${id}`).expect(200)).body,
			).data
			expect(detail.finishedAt).toBe(lastSet.toISOString())
			// a repeat of the same PUT neither reopens the session nor posts a second summary
			const repeat = await putSnapshot(owner, id, [exercise]).expect(409)
			expect(apiErrorResponseSchema.parse(repeat.body)).toMatchObject({
				errorCode: 'WORKOUT_LIVE_CONFLICT',
				details: { reason: 'FINISHED' },
			})
			expect(await readSummaries(owner.userId)).toHaveLength(1)
		})
	})

	it('recomputes the records: a set heavier than an earlier session gets the trophy', async () => {
		await start()
		const owner = await user('owner@kus.app')
		const earlier = await startLive(owner)
		await putSnapshot(owner, earlier.workout.id, [liveExercise()]).expect(200)
		await owner.agent.post(`${LIVE_URL}/${earlier.workout.id}/finish`).expect(200)
		// that session was two days ago
		const dayAgo = minutesAgo(48 * HOUR_MIN)
		await prisma.workout.update({
			where: { id: earlier.workout.id },
			data: { startedAt: dayAgo, finishedAt: dayAgo },
		})
		await prisma.exerciseSet.updateMany({
			where: { exerciseEntry: { workoutId: earlier.workout.id } },
			data: { doneAt: dayAgo },
		})
		await prisma.exerciseEntry.updateMany({
			where: { workoutId: earlier.workout.id },
			data: { performedAt: dayAgo },
		})
		const { id, exercise } = await startAged(owner, 6 * HOUR_MIN, 5 * HOUR_MIN)

		const response = await putSnapshot(owner, id, [
			{
				...exercise,
				sets: [liveSet({ weightKg: 95, doneAt: minutesAgo(4 * HOUR_MIN).toISOString() })],
			},
		]).expect(200)

		const { workout } = liveResponse.parse(response.body).data
		expect(workout.finishedAt).not.toBeNull()
		expect(workout.exercises[0]?.record).toBe('WEIGHT')
	})

	it('current keeps the answer for the finish route: the closed session is a finished workout', async () => {
		await start()
		const owner = await user('owner@kus.app')
		const { id, exercise } = await startAged(owner, 5 * HOUR_MIN, 4 * HOUR_MIN)
		await putSnapshot(owner, id, [exercise]).expect(200)

		// closed by the PUT; a «finish» tap afterwards answers with the same finished workout
		const response = await owner.agent.post(`${LIVE_URL}/${id}/finish`).expect(200)

		const done = finishResponse.parse(response.body).data
		expect(done.workout.finishedAt).not.toBeNull()
		expect(await readSummaries(owner.userId)).toHaveLength(1)
	})

	it('a new cardio row without sets does not stretch the finish: it ends at the last done set', async () => {
		await start()
		const owner = await user('owner@kus.app')
		const { id, exercise } = await startAged(owner, 5 * HOUR_MIN, 4 * HOUR_MIN)
		const lastSet = minutesAgo(3 * HOUR_MIN + 30)

		const response = await putSnapshot(owner, id, [
			{
				...exercise,
				sets: [
					liveSet({ doneAt: minutesAgo(4 * HOUR_MIN).toISOString() }),
					liveSet({ doneAt: lastSet.toISOString() }),
				],
			},
			{ clientKey: randomUUID(), name: 'Доріжка', kind: 'CARDIO', durationMin: 10, sets: [] },
		]).expect(200)

		const { workout } = liveResponse.parse(response.body).data
		expect(workout.finishedAt).toBe(lastSet.toISOString())
		// started 5 h ago, the last set 3 h 30 min ago: 90 min
		expect(workout.durationMin).toBe(90)
		const row = await prisma.workout.findUniqueOrThrow({ where: { id } })
		expect(row.finishedAt?.toISOString()).toBe(lastSet.toISOString())
	})

	it('server idle 4 h but the snapshot has fresh sets: 200, the session stays open', async () => {
		await start()
		const owner = await user('owner@kus.app')
		const { id, exercise } = await startAged(owner, 5 * HOUR_MIN, 4 * HOUR_MIN)

		const response = await putSnapshot(owner, id, [
			{
				...exercise,
				sets: [
					liveSet({ doneAt: minutesAgo(4 * HOUR_MIN).toISOString() }),
					liveSet({ doneAt: minutesAgo(20).toISOString() }),
				],
			},
		]).expect(200)

		const { workout } = liveResponse.parse(response.body).data
		expect(workout.finishedAt).toBeNull()
		expect(workout.exercises[0]?.sets).toHaveLength(2)
		expect((await getCurrent(owner))?.workout.id).toBe(id)
		expect(await readSummaries(owner.userId)).toHaveLength(0)
	})

	describe('server idle for 25 h', () => {
		it('with work: current closes it with the summary, the PUT is 409 FINISHED', async () => {
			await start()
			const owner = await user('owner@kus.app')
			const lastSet = minutesAgo(25 * HOUR_MIN)
			const { id, exercise } = await startAged(owner, 26 * HOUR_MIN, 25 * HOUR_MIN)

			expect(await getCurrent(owner)).toBeNull()

			const row = await prisma.workout.findUniqueOrThrow({ where: { id } })
			// the set was aged a moment after lastSet was read: compare with a tolerance
			expect(Math.abs((row.finishedAt?.getTime() ?? 0) - lastSet.getTime())).toBeLessThan(5000)
			expect(await readSummaries(owner.userId)).toHaveLength(1)
			const response = await putSnapshot(owner, id, [exercise]).expect(409)
			expect(apiErrorResponseSchema.parse(response.body)).toMatchObject({
				errorCode: 'WORKOUT_LIVE_CONFLICT',
				details: { reason: 'FINISHED' },
			})
			expect(await readSummaries(owner.userId)).toHaveLength(1)
		})

		it('with no done work: the PUT deletes it with 409 FINISHED, no message', async () => {
			await start()
			const owner = await user('owner@kus.app')
			const { workout } = await startLive(owner)
			await ageSession(workout.id, 25 * HOUR_MIN, null)

			const response = await putSnapshot(owner, workout.id, [liveExercise()]).expect(409)

			expect(response.body).toMatchObject({ details: { reason: 'FINISHED' } })
			const row = await prisma.workout.findUniqueOrThrow({ where: { id: workout.id } })
			expect(row.deletedAt).not.toBeNull()
			expect(await readSummaries(owner.userId)).toHaveLength(0)
		})
	})

	it('a late PUT with only planned sets removes the session: 409 FINISHED, no message', async () => {
		await start()
		const owner = await user('owner@kus.app')
		const { workout } = await startLive(owner)
		await ageSession(workout.id, 4 * HOUR_MIN, null)

		const response = await putSnapshot(owner, workout.id, [
			liveExercise({ sets: [liveSet({ doneAt: null }), liveSet({ doneAt: null })] }),
		]).expect(409)

		expect(response.body).toMatchObject({
			errorCode: 'WORKOUT_LIVE_CONFLICT',
			details: { reason: 'FINISHED' },
		})
		const row = await prisma.workout.findUniqueOrThrow({ where: { id: workout.id } })
		expect(row.deletedAt).not.toBeNull()
		expect(row.finishedAt).toBeNull()
		expect(await readSummaries(owner.userId)).toHaveLength(0)
		expect(await getCurrent(owner)).toBeNull()
	})

	describe('isolation', () => {
		it("another user's idle session is untouched by my GET and PUT; their id is 404", async () => {
			await start()
			const owner = await user('owner@kus.app')
			const stranger = await user('stranger@kus.app')
			const theirs = await startAged(stranger, 6 * HOUR_MIN, 5 * HOUR_MIN)
			const mine = await startAged(owner, 6 * HOUR_MIN, 5 * HOUR_MIN)

			await putSnapshot(owner, mine.id, [
				{
					...mine.exercise,
					sets: [liveSet({ doneAt: minutesAgo(4 * HOUR_MIN).toISOString() })],
				},
			]).expect(200)
			const foreign = await putSnapshot(owner, theirs.id, [liveExercise()])

			expect(foreign.status).toBe(404)
			const row = await prisma.workout.findUniqueOrThrow({ where: { id: theirs.id } })
			expect(row.finishedAt).toBeNull()
			expect(row.deletedAt).toBeNull()
			expect(
				await prisma.exerciseSet.count({ where: { exerciseEntry: { workoutId: theirs.id } } }),
			).toBe(1)
			expect(await readSummaries(stranger.userId)).toHaveLength(0)
			expect((await getCurrent(stranger))?.workout.id).toBe(theirs.id)
			expect(await readSummaries(owner.userId)).toHaveLength(1)
			await owner.agent
				.put(`${LIVE_URL}/${UNKNOWN_ID}`)
				.send({ knownEditedAt: null, exercises: [] })
				.expect(404)
		})
	})

	it('exercises with the same position come back by position, then by createdAt', async () => {
		await start()
		const owner = await user('owner@kus.app')
		const { workout } = await startLive(owner)
		await putSnapshot(owner, workout.id, [liveExercise({ name: 'Жим' })]).expect(200)
		const message = await prisma.message.create({
			data: { userId: owner.userId, role: 'USER', content: 'ще присід', status: 'COMPLETED' },
		})
		// added by the chat before the live row was written, at the same position 0
		await prisma.exerciseEntry.create({
			data: {
				userId: owner.userId,
				workoutId: workout.id,
				name: 'Присід з чату',
				kind: 'STRENGTH',
				source: 'MANUAL',
				sourceMessageId: message.id,
				performedAt: new Date(),
				localDate: new Date(workout.localDate),
				position: 0,
				createdAt: minutesAgo(HOUR_MIN),
			},
		})

		const current = await getCurrent(owner)
		const detail = workoutDetail.parse(
			(await owner.agent.get(`/api/v1/workouts/${workout.id}`).expect(200)).body,
		).data

		expect(current?.workout.exercises.map(({ name }) => name)).toEqual(['Присід з чату', 'Жим'])
		expect(detail.exercises.map(({ name }) => name)).toEqual(['Присід з чату', 'Жим'])
	})
})
