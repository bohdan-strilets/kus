import { randomUUID } from 'node:crypto'

import { Logger } from '@nestjs/common'
import type { NestExpressApplication } from '@nestjs/platform-express'
import {
	apiErrorResponseSchema,
	createDataResponseSchema,
	LIVE_FINISH_IDLE_MIN,
	liveWorkoutResponseSchema,
	workoutDiscardedSchema,
	workoutFinishedSchema,
} from '@kus/shared'
import { afterEach, describe, expect, it, vi } from 'vitest'
import request from 'supertest'

import type { PrismaService } from '../src/prisma'
import { createDbTestApp } from './create-db-test-app'
import {
	LIVE_URL,
	liveExercise,
	liveSet,
	MINUTE_MS,
	minutesAgo,
	registerUser,
	type TestUser,
} from './workout-logging-test-utils'

const UNKNOWN_ID = '0199b3a4-0000-7000-8000-000000000001'
const AUTO_CLOSED_TEXT = 'Закрив тренування — після останнього підходу минуло понад 3 години.'

const liveResponse = createDataResponseSchema(liveWorkoutResponseSchema)
const nullableLive = createDataResponseSchema(liveWorkoutResponseSchema.nullable())
const finishResponse = createDataResponseSchema(workoutFinishedSchema)

describe('live workouts (e2e, real DB)', () => {
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

	const putSnapshot = (
		who: TestUser,
		id: string,
		exercises: unknown[],
		knownEditedAt: string | null = null,
	) => who.agent.put(`${LIVE_URL}/${id}`).send({ knownEditedAt, exercises })

	const getCurrent = async (who: TestUser) =>
		nullableLive.parse((await who.agent.get(`${LIVE_URL}/current`).expect(200)).body).data

	/** Moves the session's start (and, with `lastSet`, the time of all its sets) back in time. */
	const backdateStart = async (id: string, minutes: number, lastSet?: Date) => {
		await prisma.workout.update({ where: { id }, data: { startedAt: minutesAgo(minutes) } })
		if (!lastSet) return
		await prisma.exerciseSet.updateMany({
			where: { exerciseEntry: { workoutId: id } },
			data: { doneAt: lastSet },
		})
		await prisma.exerciseEntry.updateMany({
			where: { workoutId: id },
			data: { performedAt: lastSet },
		})
	}

	const readSummaries = (userId: string) =>
		prisma.message.findMany({
			where: { userId, role: 'ASSISTANT', replyToId: null },
			orderBy: { createdAt: 'asc' },
		})

	afterEach(async () => {
		vi.useRealTimers()
		await app.close()
	})

	it('answers 401 without a session', async () => {
		await start()
		const server = app.getHttpServer()

		await request(server).get(`${LIVE_URL}/current`).expect(401)
		await request(server).post(LIVE_URL).send({ templateId: null }).expect(401)
		await request(server).put(`${LIVE_URL}/${UNKNOWN_ID}`).send({}).expect(401)
		await request(server).post(`${LIVE_URL}/${UNKNOWN_ID}/finish`).expect(401)
		await request(server).delete(`${LIVE_URL}/${UNKNOWN_ID}`).expect(401)
	})

	describe('start and current', () => {
		it('starts once: 201, then 200 with the same session; current returns it', async () => {
			await start()
			const owner = await user('owner@kus.app')
			expect(await getCurrent(owner)).toBeNull()

			const first = await owner.agent.post(LIVE_URL).send({ templateId: null }).expect(201)
			const second = await owner.agent.post(LIVE_URL).send({ templateId: null }).expect(200)

			const created = liveResponse.parse(first.body).data
			expect(liveResponse.parse(second.body).data.workout.id).toBe(created.workout.id)
			expect(created.workout).toMatchObject({ source: 'LIVE', finishedAt: null, exercises: [] })
			expect((await getCurrent(owner))?.workout.id).toBe(created.workout.id)
		})

		it('two parallel starts make exactly one open session (one 201, one 200)', async () => {
			await start()
			const owner = await user('owner@kus.app')

			const [a, b] = await Promise.all([
				owner.agent.post(LIVE_URL).send({ templateId: null }),
				owner.agent.post(LIVE_URL).send({ templateId: null }),
			])

			expect([a.status, b.status].sort()).toEqual([200, 201])
			expect(liveResponse.parse(a.body).data.workout.id).toBe(
				liveResponse.parse(b.body).data.workout.id,
			)
			expect(
				await prisma.workout.count({
					where: { userId: owner.userId, source: 'LIVE', finishedAt: null, deletedAt: null },
				}),
			).toBe(1)
		})

		it("another user's start makes their own session; current never leaks across users", async () => {
			await start()
			const owner = await user('owner@kus.app')
			const stranger = await user('stranger@kus.app')
			const mine = await startLive(owner)
			expect(await getCurrent(stranger)).toBeNull()

			const theirs = await startLive(stranger)

			expect(theirs.workout.id).not.toBe(mine.workout.id)
			expect((await getCurrent(owner))?.workout.id).toBe(mine.workout.id)
			expect((await getCurrent(stranger))?.workout.id).toBe(theirs.workout.id)
		})

		it('a started session after a finished one is a new session', async () => {
			await start()
			const owner = await user('owner@kus.app')
			const first = await startLive(owner)
			await putSnapshot(owner, first.workout.id, [liveExercise()]).expect(200)
			await owner.agent.post(`${LIVE_URL}/${first.workout.id}/finish`).expect(200)

			const second = await startLive(owner)

			expect(second.workout.id).not.toBe(first.workout.id)
		})
	})

	describe('PUT snapshot', () => {
		it('writes exercises and sets, and an identical repeat changes nothing', async () => {
			await start()
			const owner = await user('owner@kus.app')
			const { workout } = await startLive(owner)
			const exercise = liveExercise({
				sets: [liveSet({ weightKg: 40, isWarmup: true }), liveSet(), liveSet({ doneAt: null })],
			})

			const first = await putSnapshot(owner, workout.id, [exercise]).expect(200)
			const repeat = await putSnapshot(owner, workout.id, [exercise]).expect(200)

			const [written] = liveResponse.parse(first.body).data.workout.exercises
			expect(written?.sets.map((set) => [set.weightKg, set.isWarmup, set.doneAt === null])).toEqual(
				[
					[40, true, false],
					[80, false, false],
					[80, false, true],
				],
			)
			expect(liveResponse.parse(repeat.body).data.workout.exercises[0]?.id).toBe(written?.id)
			expect(await prisma.exerciseEntry.count({ where: { workoutId: workout.id } })).toBe(1)
			expect(await prisma.exerciseSet.count({ where: { userId: owner.userId } })).toBe(3)
		})

		it('hard-deletes an exercise missing from the snapshot', async () => {
			await start()
			const owner = await user('owner@kus.app')
			const { workout } = await startLive(owner)
			const keep = liveExercise({ name: 'Присідання' })
			const drop = liveExercise({ name: 'Тяга' })
			await putSnapshot(owner, workout.id, [keep, drop]).expect(200)

			await putSnapshot(owner, workout.id, [keep]).expect(200)

			const rows = await prisma.exerciseEntry.findMany({ where: { workoutId: workout.id } })
			expect(rows.map((row) => row.name)).toEqual(['Присідання'])
		})

		it('touches only the live exercises: an exercise told in the chat stays', async () => {
			await start()
			const owner = await user('owner@kus.app')
			const { workout } = await startLive(owner)
			const message = await prisma.message.create({
				data: { userId: owner.userId, role: 'USER', content: 'ще присід', status: 'COMPLETED' },
			})
			const chatEntry = await prisma.exerciseEntry.create({
				data: {
					userId: owner.userId,
					workoutId: workout.id,
					name: 'Присід з чату',
					kind: 'STRENGTH',
					source: 'MANUAL',
					sourceMessageId: message.id,
					performedAt: new Date(),
					localDate: new Date(workout.localDate),
					position: 5,
				},
			})
			await putSnapshot(owner, workout.id, [liveExercise()]).expect(200)

			await putSnapshot(owner, workout.id, []).expect(200)

			const rows = await prisma.exerciseEntry.findMany({ where: { workoutId: workout.id } })
			expect(rows.map((row) => row.id)).toEqual([chatEntry.id])
		})

		it('rejects the same clientKey twice with 422 DUPLICATE', async () => {
			await start()
			const owner = await user('owner@kus.app')
			const { workout } = await startLive(owner)
			const clientKey = randomUUID()

			const response = await putSnapshot(owner, workout.id, [
				liveExercise({ clientKey }),
				liveExercise({ clientKey, name: 'Інша' }),
			]).expect(422)

			expect(apiErrorResponseSchema.parse(response.body)).toMatchObject({
				errorCode: 'VALIDATION_ERROR',
				details: { fields: { exercises: 'DUPLICATE' } },
			})
			expect(await prisma.exerciseEntry.count({ where: { workoutId: workout.id } })).toBe(0)
		})

		it('rejects a bodyweight exercise with a weight on a set (422)', async () => {
			await start()
			const owner = await user('owner@kus.app')
			const { workout } = await startLive(owner)

			await putSnapshot(owner, workout.id, [
				liveExercise({
					name: 'Підтягування',
					isBodyweight: true,
					sets: [liveSet({ weightKg: 10 })],
				}),
			]).expect(422)

			expect(await prisma.exerciseEntry.count({ where: { workoutId: workout.id } })).toBe(0)
		})

		it('learns an explicit «власна вага» into the exercise dictionary', async () => {
			await start()
			const owner = await user('owner@kus.app')
			const { workout } = await startLive(owner)

			await putSnapshot(owner, workout.id, [
				liveExercise({
					name: 'Віджимання',
					isBodyweight: true,
					sets: [liveSet({ weightKg: null, reps: 20 })],
				}),
			]).expect(200)

			const row = await prisma.exercise.findFirstOrThrow({
				where: { userId: owner.userId, name: 'Віджимання' },
			})
			expect(row.isBodyweight).toBe(true)
		})

		it('a set done in the future is clamped to now', async () => {
			await start()
			const owner = await user('owner@kus.app')
			const { workout } = await startLive(owner)
			const future = new Date(Date.now() + 60 * MINUTE_MS).toISOString()

			const response = await putSnapshot(owner, workout.id, [
				liveExercise({ sets: [liveSet({ doneAt: future })] }),
			]).expect(200)

			const doneAt = liveResponse.parse(response.body).data.workout.exercises[0]?.sets[0]?.doneAt
			expect(new Date(doneAt ?? 0).getTime()).toBeLessThanOrEqual(Date.now())
		})

		it("answers 404 for another user's, an unknown, a deleted session", async () => {
			await start()
			const owner = await user('owner@kus.app')
			const stranger = await user('stranger@kus.app')
			const mine = await startLive(owner)
			const exercises = [liveExercise({ name: 'Чужа спроба' })]

			await putSnapshot(stranger, mine.workout.id, exercises).expect(404)
			await putSnapshot(owner, UNKNOWN_ID, exercises).expect(404)
			await owner.agent.delete(`${LIVE_URL}/${mine.workout.id}`).expect(204)
			await putSnapshot(owner, mine.workout.id, exercises).expect(404)

			expect(await prisma.exerciseEntry.count()).toBe(0)
		})

		it("never attaches another user's dictionary exercise by exerciseId", async () => {
			await start()
			const owner = await user('owner@kus.app')
			const stranger = await user('stranger@kus.app')
			const foreign = await prisma.exercise.create({
				data: {
					userId: stranger.userId,
					name: 'Чужа вправа',
					nameNormalized: 'чужа вправа',
					kind: 'STRENGTH',
				},
			})
			const { workout } = await startLive(owner)

			await putSnapshot(owner, workout.id, [
				liveExercise({ name: 'Моя вправа', exerciseId: foreign.id }),
			]).expect(200)

			const entry = await prisma.exerciseEntry.findFirstOrThrow({
				where: { workoutId: workout.id },
			})
			expect(entry.exerciseId).not.toBe(foreign.id)
			const mine = await prisma.exercise.findFirstOrThrow({
				where: { id: entry.exerciseId ?? undefined },
			})
			expect(mine.userId).toBe(owner.userId)
		})
	})

	describe('conflicts (409 WORKOUT_LIVE_CONFLICT)', () => {
		it('EDITED when knownEditedAt differs from the workout editedAt', async () => {
			await start()
			const owner = await user('owner@kus.app')
			const { workout } = await startLive(owner)
			const editedAt = new Date()
			await prisma.workout.update({ where: { id: workout.id }, data: { editedAt } })

			const stale = await putSnapshot(owner, workout.id, [liveExercise()], null).expect(409)
			const wrong = await putSnapshot(
				owner,
				workout.id,
				[liveExercise()],
				new Date(editedAt.getTime() - 1000).toISOString(),
			).expect(409)
			const current = await putSnapshot(
				owner,
				workout.id,
				[liveExercise()],
				editedAt.toISOString(),
			).expect(200)

			for (const response of [stale, wrong]) {
				expect(apiErrorResponseSchema.parse(response.body)).toMatchObject({
					statusCode: 409,
					errorCode: 'WORKOUT_LIVE_CONFLICT',
					details: { reason: 'EDITED' },
				})
			}
			expect(liveResponse.parse(current.body).data.editedAt).toBe(editedAt.toISOString())
		})

		it('EDITED when the client knows an edit time but the workout was never edited', async () => {
			await start()
			const owner = await user('owner@kus.app')
			const { workout } = await startLive(owner)

			const response = await putSnapshot(
				owner,
				workout.id,
				[liveExercise()],
				new Date().toISOString(),
			).expect(409)

			expect(response.body).toMatchObject({ details: { reason: 'EDITED' } })
		})

		it('FINISHED after the session is finished', async () => {
			await start()
			const owner = await user('owner@kus.app')
			const { workout } = await startLive(owner)
			await putSnapshot(owner, workout.id, [liveExercise()]).expect(200)
			await owner.agent.post(`${LIVE_URL}/${workout.id}/finish`).expect(200)

			const response = await putSnapshot(owner, workout.id, [liveExercise()]).expect(409)

			expect(apiErrorResponseSchema.parse(response.body)).toMatchObject({
				errorCode: 'WORKOUT_LIVE_CONFLICT',
				details: { reason: 'FINISHED' },
			})
		})
	})

	describe('finish', () => {
		it('finishes with a Kusik summary message bound to the session', async () => {
			await start()
			const owner = await user('owner@kus.app')
			const { workout } = await startLive(owner)
			await putSnapshot(owner, workout.id, [liveExercise()]).expect(200)

			const response = await owner.agent.post(`${LIVE_URL}/${workout.id}/finish`).expect(200)

			const done = finishResponse.parse(response.body).data
			expect(done.workout.finishedAt).not.toBeNull()
			expect(done.workout.durationMin).toBeGreaterThanOrEqual(1)
			const summaries = await readSummaries(owner.userId)
			expect(summaries).toHaveLength(1)
			expect(summaries[0]).toMatchObject({
				id: done.messageId,
				content: 'Записав тренування.',
				replyToId: null,
			})
			const row = await prisma.workout.findUniqueOrThrow({ where: { id: workout.id } })
			expect(row.finishedMessageId).toBe(done.messageId)
		})

		it('is idempotent: a second finish answers 200 with the same result and one message', async () => {
			await start()
			const owner = await user('owner@kus.app')
			const { workout } = await startLive(owner)
			await putSnapshot(owner, workout.id, [liveExercise()]).expect(200)

			const first = await owner.agent.post(`${LIVE_URL}/${workout.id}/finish`).expect(200)
			const second = await owner.agent.post(`${LIVE_URL}/${workout.id}/finish`).expect(200)

			const a = finishResponse.parse(first.body).data
			const b = finishResponse.parse(second.body).data
			expect(b.messageId).toBe(a.messageId)
			expect(b.workout.finishedAt).toBe(a.workout.finishedAt)
			expect(await readSummaries(owner.userId)).toHaveLength(1)
		})

		it('two parallel finishes leave one summary message', async () => {
			await start()
			const owner = await user('owner@kus.app')
			const { workout } = await startLive(owner)
			await putSnapshot(owner, workout.id, [liveExercise()]).expect(200)

			const [a, b] = await Promise.all([
				owner.agent.post(`${LIVE_URL}/${workout.id}/finish`),
				owner.agent.post(`${LIVE_URL}/${workout.id}/finish`),
			])

			expect([a.status, b.status]).toEqual([200, 200])
			expect(finishResponse.parse(a.body).data.messageId).toBe(
				finishResponse.parse(b.body).data.messageId,
			)
			expect(await readSummaries(owner.userId)).toHaveLength(1)
		})

		it("answers 404 for another user's or an unknown session and leaves the owner's open", async () => {
			await start()
			const owner = await user('owner@kus.app')
			const stranger = await user('stranger@kus.app')
			const { workout } = await startLive(owner)

			await stranger.agent.post(`${LIVE_URL}/${workout.id}/finish`).expect(404)
			await owner.agent.post(`${LIVE_URL}/${UNKNOWN_ID}/finish`).expect(404)

			const row = await prisma.workout.findUniqueOrThrow({ where: { id: workout.id } })
			expect(row.finishedAt).toBeNull()
			expect(await readSummaries(owner.userId)).toHaveLength(0)
		})

		it('a record on the finish: the summary names the exercise, hasNewRecord is true', async () => {
			await start()
			const owner = await user('owner@kus.app')
			const first = await startLive(owner)
			await putSnapshot(owner, first.workout.id, [liveExercise()]).expect(200)
			await owner.agent.post(`${LIVE_URL}/${first.workout.id}/finish`).expect(200)
			const second = await startLive(owner)
			await putSnapshot(owner, second.workout.id, [
				liveExercise({ sets: [liveSet({ weightKg: 90 })] }),
			]).expect(200)

			const response = await owner.agent.post(`${LIVE_URL}/${second.workout.id}/finish`).expect(200)

			const done = finishResponse.parse(response.body).data
			expect(done.hasNewRecord).toBe(true)
			expect(done.workout.exercises[0]?.record).toBe('WEIGHT')
			const message = await prisma.message.findUniqueOrThrow({ where: { id: done.messageId } })
			expect(message.content).toBe('Записав тренування. Рекорд — Жим лежачи.')
		})

		describe('late finish', () => {
			it('ends at the last set when it was done more than LIVE_FINISH_IDLE_MIN ago', async () => {
				await start()
				const owner = await user('owner@kus.app')
				const { workout } = await startLive(owner)
				const lastSet = minutesAgo(LIVE_FINISH_IDLE_MIN + 30)
				await putSnapshot(owner, workout.id, [liveExercise()]).expect(200)
				await backdateStart(workout.id, 100, lastSet)

				const response = await owner.agent.post(`${LIVE_URL}/${workout.id}/finish`).expect(200)

				const done = finishResponse.parse(response.body).data.workout
				expect(done.finishedAt).toBe(lastSet.toISOString())
				// started 100 min ago, last set 60 min ago
				expect(done.durationMin).toBe(40)
			})

			it('ends now when the last set was 10 min ago', async () => {
				await start()
				const owner = await user('owner@kus.app')
				const { workout } = await startLive(owner)
				await putSnapshot(owner, workout.id, [liveExercise()]).expect(200)
				await backdateStart(workout.id, 70, minutesAgo(10))
				const before = Date.now()

				const response = await owner.agent.post(`${LIVE_URL}/${workout.id}/finish`).expect(200)

				const done = finishResponse.parse(response.body).data.workout
				const finishedAt = new Date(done.finishedAt ?? 0).getTime()
				expect(finishedAt).toBeGreaterThanOrEqual(before)
				expect(finishedAt).toBeLessThanOrEqual(Date.now())
				expect(done.durationMin).toBe(70)
			})

			it('clamps the duration to 1 minute at least and to 600 at most', async () => {
				await start()
				const owner = await user('owner@kus.app')
				const { workout } = await startLive(owner)
				await putSnapshot(owner, workout.id, [liveExercise()]).expect(200)
				// started 20 h ago, the last set just now: far over 600 min
				await backdateStart(workout.id, 20 * 60)

				const response = await owner.agent.post(`${LIVE_URL}/${workout.id}/finish`).expect(200)

				expect(finishResponse.parse(response.body).data.workout.durationMin).toBe(600)
			})
		})
	})

	describe('finish drops what was only planned', () => {
		const plannedBench = (weightKg: number) =>
			liveExercise({
				sets: [
					liveSet({ weightKg }),
					liveSet({ weightKg: 100, doneAt: null }),
					liveSet({ weightKg: 100, doneAt: null }),
				],
			})

		it('keeps the done sets only (3 planned, 1 done → 1 set) and awards no record for a planned weight', async () => {
			await start()
			const owner = await user('owner@kus.app')
			const first = await startLive(owner)
			await putSnapshot(owner, first.workout.id, [liveExercise()]).expect(200)
			await owner.agent.post(`${LIVE_URL}/${first.workout.id}/finish`).expect(200)
			const second = await startLive(owner)
			await putSnapshot(owner, second.workout.id, [plannedBench(70)]).expect(200)

			const response = await owner.agent.post(`${LIVE_URL}/${second.workout.id}/finish`).expect(200)

			const done = finishResponse.parse(response.body).data
			expect(done.workout.exercises[0]?.sets.map((set) => set.weightKg)).toEqual([70])
			expect(done.hasNewRecord).toBe(false)
			expect(done.workout.exercises[0]?.record).toBeNull()
			expect(
				await prisma.exerciseSet.count({
					where: { exerciseEntry: { workoutId: second.workout.id } },
				}),
			).toBe(1)
			const message = await prisma.message.findUniqueOrThrow({ where: { id: done.messageId } })
			expect(message.content).toBe('Записав тренування.')
		})

		it('drops a live exercise left with no done set and keeps the others', async () => {
			await start()
			const owner = await user('owner@kus.app')
			const { workout } = await startLive(owner)
			await putSnapshot(owner, workout.id, [
				liveExercise(),
				liveExercise({ name: 'Присідання', sets: [liveSet({ doneAt: null })] }),
			]).expect(200)

			const response = await owner.agent.post(`${LIVE_URL}/${workout.id}/finish`).expect(200)

			const names = finishResponse
				.parse(response.body)
				.data.workout.exercises.map(({ name }) => name)
			expect(names).toEqual(['Жим лежачи'])
		})

		it('keeps a cardio exercise with minutes even without sets', async () => {
			await start()
			const owner = await user('owner@kus.app')
			const { workout } = await startLive(owner)
			await putSnapshot(owner, workout.id, [
				liveExercise({ name: 'Біг', kind: 'CARDIO', durationMin: 20, sets: [] }),
			]).expect(200)

			const response = await owner.agent.post(`${LIVE_URL}/${workout.id}/finish`).expect(200)

			expect(finishResponse.parse(response.body).data.workout.exercises[0]?.durationMin).toBe(20)
		})

		it('never cleans what the chat told: no clientKey (or a message) keeps its sets without doneAt', async () => {
			await start()
			const owner = await user('owner@kus.app')
			const { workout } = await startLive(owner)
			await putSnapshot(owner, workout.id, [liveExercise()]).expect(200)
			const message = await prisma.message.create({
				data: { userId: owner.userId, role: 'USER', content: 'ще', status: 'COMPLETED' },
			})
			const common = {
				userId: owner.userId,
				workoutId: workout.id,
				kind: 'STRENGTH',
				source: 'MANUAL',
				performedAt: new Date(),
				localDate: new Date(workout.localDate),
			} as const
			const fromChat = await prisma.exerciseEntry.create({
				data: { ...common, name: 'З чату', position: 5, sourceMessageId: message.id },
			})
			const rewritten = await prisma.exerciseEntry.create({
				data: { ...common, name: 'Переписана', position: 6 },
			})
			await prisma.exerciseSet.createMany({
				data: [fromChat.id, rewritten.id].map((exerciseEntryId) => ({
					userId: owner.userId,
					exerciseEntryId,
					position: 0,
					reps: 5,
					weightKg: 50,
				})),
			})

			await owner.agent.post(`${LIVE_URL}/${workout.id}/finish`).expect(200)

			const sets = await prisma.exerciseSet.findMany({
				where: { exerciseEntryId: { in: [fromChat.id, rewritten.id] } },
			})
			expect(sets).toHaveLength(2)
		})

		it('finish with nothing done: 200 { discarded: true }, soft-deleted, no summary; a repeat answers the same', async () => {
			await start()
			const owner = await user('owner@kus.app')
			const { workout } = await startLive(owner)
			await putSnapshot(owner, workout.id, [
				liveExercise({ sets: [liveSet({ doneAt: null })] }),
			]).expect(200)

			const response = await owner.agent.post(`${LIVE_URL}/${workout.id}/finish`).expect(200)

			expect(response.body).toEqual({ data: { discarded: true } })
			expect(createDataResponseSchema(workoutDiscardedSchema).parse(response.body).data).toEqual({
				discarded: true,
			})
			const row = await prisma.workout.findUniqueOrThrow({ where: { id: workout.id } })
			expect(row.deletedAt).not.toBeNull()
			expect(row.finishedAt).toBeNull()
			expect(await readSummaries(owner.userId)).toHaveLength(0)
			expect(await getCurrent(owner)).toBeNull()
			const repeat = await owner.agent.post(`${LIVE_URL}/${workout.id}/finish`).expect(200)
			expect(repeat.body).toEqual({ data: { discarded: true } })
			expect(await readSummaries(owner.userId)).toHaveLength(0)
		})

		it('finish of an empty session: discarded, and a new one can start', async () => {
			await start()
			const owner = await user('owner@kus.app')
			const { workout } = await startLive(owner)

			const response = await owner.agent.post(`${LIVE_URL}/${workout.id}/finish`).expect(200)

			expect(response.body).toEqual({ data: { discarded: true } })
			expect(await readSummaries(owner.userId)).toHaveLength(0)
			await owner.agent.post(LIVE_URL).send({ templateId: null }).expect(201)
		})

		it('finish after «Вийти без збереження» (DELETE) is discarded as well', async () => {
			await start()
			const owner = await user('owner@kus.app')
			const { workout } = await startLive(owner)
			await putSnapshot(owner, workout.id, [liveExercise()]).expect(200)
			await owner.agent.delete(`${LIVE_URL}/${workout.id}`).expect(204)

			const response = await owner.agent.post(`${LIVE_URL}/${workout.id}/finish`).expect(200)

			expect(response.body).toEqual({ data: { discarded: true } })
			expect(await readSummaries(owner.userId)).toHaveLength(0)
		})

		it("finish of another user's or an unknown session is 404, never «discarded»", async () => {
			await start()
			const owner = await user('owner@kus.app')
			const stranger = await user('stranger@kus.app')
			const { workout } = await startLive(owner)
			await owner.agent.delete(`${LIVE_URL}/${workout.id}`).expect(204)

			await stranger.agent.post(`${LIVE_URL}/${workout.id}/finish`).expect(404)
			await owner.agent.post(`${LIVE_URL}/${UNKNOWN_ID}/finish`).expect(404)
		})

		it('a finished session that was deleted afterwards: finish is 404', async () => {
			await start()
			const owner = await user('owner@kus.app')
			const { workout } = await startLive(owner)
			await putSnapshot(owner, workout.id, [liveExercise()]).expect(200)
			await owner.agent.post(`${LIVE_URL}/${workout.id}/finish`).expect(200)
			await owner.agent.delete(`/api/v1/workouts/${workout.id}`).expect(204)

			await owner.agent.post(`${LIVE_URL}/${workout.id}/finish`).expect(404)
		})

		it('a normal finish parses as the finished shape, with discarded absent or false', async () => {
			await start()
			const owner = await user('owner@kus.app')
			const { workout } = await startLive(owner)
			await putSnapshot(owner, workout.id, [liveExercise()]).expect(200)

			const response = await owner.agent.post(`${LIVE_URL}/${workout.id}/finish`).expect(200)

			const data = finishResponse.parse(response.body).data
			expect(data.discarded ?? false).toBe(false)
			expect(data.messageId).toBeTruthy()
		})
	})

	describe('PUT details', () => {
		it('does not move an existing exercise time forward, only back when a set is earlier', async () => {
			await start()
			const owner = await user('owner@kus.app')
			const { workout } = await startLive(owner)
			await backdateStart(workout.id, 90)
			const key = randomUUID()
			const at = (minutes: number) => liveSet({ doneAt: minutesAgo(minutes).toISOString() })
			const readTime = async () =>
				(await prisma.exerciseEntry.findFirstOrThrow({ where: { workoutId: workout.id } }))
					.performedAt

			await putSnapshot(owner, workout.id, [
				liveExercise({ clientKey: key, sets: [at(30)] }),
			]).expect(200)
			const created = await readTime()
			expect(Math.abs(created.getTime() - minutesAgo(30).getTime())).toBeLessThan(5000)

			await putSnapshot(owner, workout.id, [
				liveExercise({ clientKey: key, sets: [at(30), at(5)] }),
			]).expect(200)
			expect((await readTime()).getTime()).toBe(created.getTime())

			await putSnapshot(owner, workout.id, [
				liveExercise({ clientKey: key, sets: [at(45), at(30)] }),
			]).expect(200)
			expect(Math.abs((await readTime()).getTime() - minutesAgo(45).getTime())).toBeLessThan(5000)
		})

		it('a PUT on a session idle for more than 24 h is 409 FINISHED and closes it (with work: a summary; empty: deleted)', async () => {
			await start()
			const owner = await user('owner@kus.app')
			const { workout } = await startLive(owner)
			await putSnapshot(owner, workout.id, [liveExercise()]).expect(200)
			await backdateStart(workout.id, 26 * 60, minutesAgo(25 * 60))

			const response = await putSnapshot(owner, workout.id, [liveExercise()]).expect(409)

			expect(response.body).toMatchObject({ details: { reason: 'FINISHED' } })
			const row = await prisma.workout.findUniqueOrThrow({ where: { id: workout.id } })
			expect(row.finishedAt).not.toBeNull()
			expect(await readSummaries(owner.userId)).toHaveLength(1)

			const empty = await startLive(owner)
			await backdateStart(empty.workout.id, 25 * 60)
			const emptyResponse = await putSnapshot(owner, empty.workout.id, [liveExercise()]).expect(409)
			expect(emptyResponse.body).toMatchObject({ details: { reason: 'FINISHED' } })
			const gone = await prisma.workout.findUniqueOrThrow({ where: { id: empty.workout.id } })
			expect(gone.deletedAt).not.toBeNull()
			expect(await readSummaries(owner.userId)).toHaveLength(1)
		})

		it('clamps a set done before the start to the start', async () => {
			await start()
			const owner = await user('owner@kus.app')
			const { workout } = await startLive(owner)
			const row = await prisma.workout.findUniqueOrThrow({ where: { id: workout.id } })

			const response = await putSnapshot(owner, workout.id, [
				liveExercise({ sets: [liveSet({ doneAt: minutesAgo(120).toISOString() })] }),
			]).expect(200)

			const doneAt = liveResponse.parse(response.body).data.workout.exercises[0]?.sets[0]?.doneAt
			expect(doneAt).toBe(row.startedAt?.toISOString())
		})

		it('a soft-deleted exercise with the same clientKey comes back with a PUT', async () => {
			await start()
			const owner = await user('owner@kus.app')
			const { workout } = await startLive(owner)
			const exercise = liveExercise()
			await putSnapshot(owner, workout.id, [exercise]).expect(200)
			await prisma.exerciseEntry.updateMany({
				where: { workoutId: workout.id },
				data: { deletedAt: new Date() },
			})

			const response = await putSnapshot(owner, workout.id, [exercise]).expect(200)

			expect(liveResponse.parse(response.body).data.workout.exercises).toHaveLength(1)
			const rows = await prisma.exerciseEntry.findMany({ where: { workoutId: workout.id } })
			expect(rows.map(({ deletedAt }) => deletedAt)).toEqual([null])
		})

		it('writes the bodyweight flag only when it changes (updatedAt of the dictionary row)', async () => {
			await start()
			const owner = await user('owner@kus.app')
			const { workout } = await startLive(owner)
			const exercise = liveExercise({
				name: 'Віджимання',
				isBodyweight: true,
				sets: [liveSet({ weightKg: null, reps: 20 })],
			})
			const readRow = () =>
				prisma.exercise.findFirstOrThrow({ where: { userId: owner.userId, name: 'Віджимання' } })
			await putSnapshot(owner, workout.id, [exercise]).expect(200)
			const first = await readRow()

			await putSnapshot(owner, workout.id, [exercise]).expect(200)
			const repeat = await readRow()
			await putSnapshot(owner, workout.id, [{ ...exercise, isBodyweight: false }]).expect(200)
			const changed = await readRow()

			expect(first.isBodyweight).toBe(true)
			expect(repeat.updatedAt.getTime()).toBe(first.updatedAt.getTime())
			expect(changed.isBodyweight).toBe(false)
			expect(changed.updatedAt.getTime()).toBeGreaterThan(first.updatedAt.getTime())
		})
	})

	describe('discard', () => {
		it('«Вийти без збереження» soft-deletes the open session; current is empty; no message', async () => {
			await start()
			const owner = await user('owner@kus.app')
			const { workout } = await startLive(owner)
			await putSnapshot(owner, workout.id, [liveExercise()]).expect(200)

			await owner.agent.delete(`${LIVE_URL}/${workout.id}`).expect(204)

			expect(await getCurrent(owner)).toBeNull()
			const row = await prisma.workout.findUniqueOrThrow({ where: { id: workout.id } })
			expect(row.deletedAt).not.toBeNull()
			expect(await readSummaries(owner.userId)).toHaveLength(0)
			// a new session can start at once
			await owner.agent.post(LIVE_URL).send({ templateId: null }).expect(201)
		})

		it("answers 404 for another user's, an unknown and a finished session", async () => {
			await start()
			const owner = await user('owner@kus.app')
			const stranger = await user('stranger@kus.app')
			const { workout } = await startLive(owner)

			await stranger.agent.delete(`${LIVE_URL}/${workout.id}`).expect(404)
			await owner.agent.delete(`${LIVE_URL}/${UNKNOWN_ID}`).expect(404)
			await putSnapshot(owner, workout.id, [liveExercise()]).expect(200)
			await owner.agent.post(`${LIVE_URL}/${workout.id}/finish`).expect(200)
			await owner.agent.delete(`${LIVE_URL}/${workout.id}`).expect(404)

			const row = await prisma.workout.findUniqueOrThrow({ where: { id: workout.id } })
			expect(row.deletedAt).toBeNull()
		})
	})

	describe('idle auto-close (never by the calendar day)', () => {
		const startWithLastSet = async (who: TestUser, lastSet: Date, startedMinutesAgo: number) => {
			const { workout } = await startLive(who)
			await putSnapshot(who, workout.id, [liveExercise()]).expect(200)
			await backdateStart(workout.id, startedMinutesAgo, lastSet)
			return workout.id
		}

		it('24 h 01 min since the last set: current closes it at that set with the summary message', async () => {
			await start()
			const owner = await user('owner@kus.app')
			const lastSet = minutesAgo(24 * 60 + 1)
			const id = await startWithLastSet(owner, lastSet, 24 * 60 + 21)

			expect(await getCurrent(owner)).toBeNull()

			const row = await prisma.workout.findUniqueOrThrow({ where: { id } })
			expect(row.finishedAt?.toISOString()).toBe(lastSet.toISOString())
			expect(row.durationMin).toBe(20)
			expect(row.deletedAt).toBeNull()
			const summaries = await readSummaries(owner.userId)
			expect(summaries.map((message) => message.content)).toEqual([AUTO_CLOSED_TEXT])
			expect(row.finishedMessageId).toBe(summaries[0]?.id)
			// the next look finds nothing and posts nothing more
			expect(await getCurrent(owner)).toBeNull()
			expect(await readSummaries(owner.userId)).toHaveLength(1)
		})

		it('4 h and 20 h since the last set: current keeps the session open (grace), nothing is posted', async () => {
			await start()
			const owner = await user('owner@kus.app')
			const id = await startWithLastSet(owner, minutesAgo(4 * 60), 4 * 60 + 20)

			const current = await getCurrent(owner)

			expect(current?.workout.id).toBe(id)
			expect(current?.workout.finishedAt).toBeNull()
			await backdateStart(id, 21 * 60, minutesAgo(20 * 60))
			expect((await getCurrent(owner))?.workout.id).toBe(id)
			expect(await readSummaries(owner.userId)).toHaveLength(0)
		})

		it('a start while the old one is idle closes it and starts a new one', async () => {
			await start()
			const owner = await user('owner@kus.app')
			const oldId = await startWithLastSet(owner, minutesAgo(4 * 60), 4 * 60 + 10)

			const created = await owner.agent.post(LIVE_URL).send({ templateId: null }).expect(201)

			expect(liveResponse.parse(created.body).data.workout.id).not.toBe(oldId)
			const old = await prisma.workout.findUniqueOrThrow({ where: { id: oldId } })
			expect(old.finishedAt).not.toBeNull()
			expect(await readSummaries(owner.userId)).toHaveLength(1)
		})

		it('without any done work the idle session is soft-deleted and no message is posted', async () => {
			await start()
			const owner = await user('owner@kus.app')
			const { workout } = await startLive(owner)
			await backdateStart(workout.id, 25 * 60)

			expect(await getCurrent(owner)).toBeNull()

			const row = await prisma.workout.findUniqueOrThrow({ where: { id: workout.id } })
			expect(row.deletedAt).not.toBeNull()
			expect(row.finishedAt).toBeNull()
			expect(await readSummaries(owner.userId)).toHaveLength(0)
		})

		it("one user's idle session is not closed by another user's look", async () => {
			await start()
			const owner = await user('owner@kus.app')
			const stranger = await user('stranger@kus.app')
			const id = await startWithLastSet(owner, minutesAgo(4 * 60), 4 * 60 + 10)

			expect(await getCurrent(stranger)).toBeNull()

			const row = await prisma.workout.findUniqueOrThrow({ where: { id } })
			expect(row.finishedAt).toBeNull()
			expect(row.deletedAt).toBeNull()
		})

		it('stays open through midnight: last set 23:30 local, a look at 00:10 next day', async () => {
			await start()
			// Europe/Warsaw (UTC+1): 23:30 local on 10 Nov = 22:30Z, 00:10 local on 11 Nov = 23:10Z
			vi.useFakeTimers({ toFake: ['Date'], now: new Date('2026-11-10T22:30:00Z') })
			const owner = await user('owner@kus.app')
			const { workout } = await startLive(owner)
			await putSnapshot(owner, workout.id, [liveExercise()]).expect(200)

			vi.setSystemTime(new Date('2026-11-10T23:10:00Z'))
			// the access token is short-lived: sign in again at the new time
			await owner.agent
				.post('/api/v1/auth/login')
				.send({ email: 'owner@kus.app', password: 'correct-horse-battery' })
				.expect(200)
			const current = await getCurrent(owner)

			expect(current?.workout.id).toBe(workout.id)
			expect(current?.workout.finishedAt).toBeNull()
			expect(current?.workout.localDate).toBe('2026-11-10')
			expect(await readSummaries(owner.userId)).toHaveLength(0)

			// 24 h 01 min after the last set (22:31Z next day) the day does not matter either way: now it closes
			vi.setSystemTime(new Date('2026-11-11T22:31:00Z'))
			await owner.agent
				.post('/api/v1/auth/login')
				.send({ email: 'owner@kus.app', password: 'correct-horse-battery' })
				.expect(200)
			expect(await getCurrent(owner)).toBeNull()
			const row = await prisma.workout.findUniqueOrThrow({ where: { id: workout.id } })
			expect(row.finishedAt).not.toBeNull()
		})
	})
})
