import { randomUUID } from 'node:crypto'

import { Logger } from '@nestjs/common'
import type { NestExpressApplication } from '@nestjs/platform-express'
import {
	apiErrorResponseSchema,
	createDataResponseSchema,
	liveWorkoutResponseSchema,
	workoutFinishedSchema,
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

const UNKNOWN_ID = '0199b3a4-0000-7000-8000-000000000001'
const HOUR_MIN = 60
const TOLERANCE_MS = 5000

const liveResponse = createDataResponseSchema(liveWorkoutResponseSchema)
const nullableLive = createDataResponseSchema(liveWorkoutResponseSchema.nullable())
const finishResponse = createDataResponseSchema(workoutFinishedSchema)

describe('live workouts: finish with a body (e2e, real DB)', () => {
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

	const finish = (who: TestUser, id: string, body?: Record<string, unknown>) => {
		const req = who.agent.post(`${LIVE_URL}/${id}/finish`)
		if (body === undefined) return req
		// the schema requires the stamp with a snapshot: a fresh session has none
		const isMissingStamp = body.exercises !== undefined && !('knownEditedAt' in body)
		return req.send(isMissingStamp ? { knownEditedAt: null, ...body } : body)
	}

	/** The raw request: exactly this body. */
	const finishRaw = (who: TestUser, id: string, body: Record<string, unknown>) =>
		who.agent.post(`${LIVE_URL}/${id}/finish`).send(body)

	const readSummaries = (userId: string) =>
		prisma.message.findMany({
			where: { userId, role: 'ASSISTANT', replyToId: null },
			orderBy: { createdAt: 'asc' },
		})

	const readSets = async (id: string) =>
		(
			await prisma.exerciseSet.findMany({
				where: { exerciseEntry: { workoutId: id } },
				orderBy: [{ exerciseEntry: { position: 'asc' } }, { position: 'asc' }],
			})
		).map((set) => Number(set.weightKg))

	const backdateStart = (id: string, minutes: number) =>
		prisma.workout.update({ where: { id }, data: { startedAt: minutesAgo(minutes) } })

	/** A fresh session started `startedMinutes` ago. */
	const startAged = async (who: TestUser, startedMinutes: number) => {
		const { workout } = await startLive(who)
		await backdateStart(workout.id, startedMinutes)
		return workout.id
	}

	/** One strength exercise whose sets were done at the given moments. */
	const strength = (doneAts: Date[], overrides: Record<string, unknown> = {}) =>
		liveExercise({
			sets: doneAts.map((doneAt, index) =>
				liveSet({ weightKg: 50 + index * 10, doneAt: doneAt.toISOString() }),
			),
			...overrides,
		})

	const finishedAtOf = async (id: string): Promise<Date> => {
		const row = await prisma.workout.findUniqueOrThrow({ where: { id } })
		if (row.finishedAt === null) throw new Error('not finished')
		return row.finishedAt
	}

	afterEach(async () => {
		vi.useRealTimers()
		await app.close()
	})

	it('no body: the old behaviour, finished answer and one summary', async () => {
		await start()
		const owner = await user('owner@kus.app')
		const id = await startAged(owner, 70)
		await owner.agent
			.put(`${LIVE_URL}/${id}`)
			.send({ knownEditedAt: null, exercises: [strength([minutesAgo(10)])] })
			.expect(200)

		const response = await finish(owner, id).expect(200)

		const done = finishResponse.parse(response.body).data
		expect(done.workout.finishedAt).not.toBeNull()
		expect(done.workout.durationMin).toBe(70)
		expect(await readSummaries(owner.userId)).toHaveLength(1)
	})

	it('body with exercises and no finishedAt: sets saved, finished at now, one summary', async () => {
		await start()
		const owner = await user('owner@kus.app')
		const id = await startAged(owner, 60)
		const before = Date.now()

		const response = await finish(owner, id, {
			knownEditedAt: null,
			exercises: [strength([minutesAgo(20), minutesAgo(5)])],
		}).expect(200)

		const done = finishResponse.parse(response.body).data
		expect(done.workout.exercises[0]?.sets.map((set) => set.weightKg)).toEqual([50, 60])
		expect(new Date(done.workout.finishedAt ?? 0).getTime()).toBeGreaterThanOrEqual(before)
		expect(done.workout.durationMin).toBe(60)
		expect(typeof done.hasNewRecord).toBe('boolean')
		expect(await readSets(id)).toEqual([50, 60])
		const summaries = await readSummaries(owner.userId)
		expect(summaries).toHaveLength(1)
		expect(summaries[0]?.id).toBe(done.messageId)
	})

	it('body with exercises, last set 2 h ago and no finishedAt: ends at the last set (30-min rule)', async () => {
		await start()
		const owner = await user('owner@kus.app')
		const id = await startAged(owner, 3 * HOUR_MIN)
		const lastSet = minutesAgo(2 * HOUR_MIN)

		const response = await finish(owner, id, {
			exercises: [strength([minutesAgo(150), lastSet])],
		}).expect(200)

		const done = finishResponse.parse(response.body).data
		expect(done.workout.finishedAt).toBe(lastSet.toISOString())
		expect(done.workout.durationMin).toBe(60)
		expect(await readSummaries(owner.userId)).toHaveLength(1)
	})

	it('the first-ever heavy set carries the record flag in the answer', async () => {
		await start()
		const owner = await user('owner@kus.app')
		const earlier = await startAged(owner, 30)
		await owner.agent
			.put(`${LIVE_URL}/${earlier}`)
			.send({ knownEditedAt: null, exercises: [liveExercise()] })
			.expect(200)
		await finish(owner, earlier).expect(200)
		const dayAgo = minutesAgo(48 * HOUR_MIN)
		await prisma.workout.update({
			where: { id: earlier },
			data: { startedAt: dayAgo, finishedAt: dayAgo },
		})
		await prisma.exerciseSet.updateMany({
			where: { exerciseEntry: { workoutId: earlier } },
			data: { doneAt: dayAgo },
		})
		await prisma.exerciseEntry.updateMany({
			where: { workoutId: earlier },
			data: { performedAt: dayAgo },
		})
		const id = await startAged(owner, 30)

		const response = await finish(owner, id, {
			exercises: [
				liveExercise({
					sets: [liveSet({ weightKg: 120, doneAt: minutesAgo(5).toISOString() })],
				}),
			],
		}).expect(200)

		const done = finishResponse.parse(response.body).data
		expect(done.hasNewRecord).toBe(true)
		expect(done.workout.exercises[0]?.record).toBe('WEIGHT')
	})

	describe('the tap time is clamped', () => {
		it('finishedAt in the future: finished now', async () => {
			await start()
			const owner = await user('owner@kus.app')
			const id = await startAged(owner, 60)
			const future = new Date(Date.now() + 2 * HOUR_MIN * 60_000)

			await finish(owner, id, {
				finishedAt: future.toISOString(),
				exercises: [strength([minutesAgo(5)])],
			}).expect(200)

			const finishedAt = await finishedAtOf(id)
			expect(Math.abs(finishedAt.getTime() - Date.now())).toBeLessThan(TOLERANCE_MS)
		})

		it('finishedAt before the start: clamped to the start', async () => {
			await start()
			const owner = await user('owner@kus.app')
			const id = await startAged(owner, 100)
			const startedAt = (await prisma.workout.findUniqueOrThrow({ where: { id } })).startedAt

			// the set is older than the start, so the phone's clock puts it at the start
			const response = await finish(owner, id, {
				finishedAt: minutesAgo(300).toISOString(),
				exercises: [strength([minutesAgo(200)])],
			}).expect(200)

			const done = finishResponse.parse(response.body).data
			expect(done.workout.finishedAt).toBe(startedAt?.toISOString())
			expect((await finishedAtOf(id)).getTime()).toBe(startedAt?.getTime())
		})

		it('finishedAt before the last done set: clamped to that set', async () => {
			await start()
			const owner = await user('owner@kus.app')
			const id = await startAged(owner, 100)
			const lastSet = minutesAgo(30)

			const response = await finish(owner, id, {
				finishedAt: minutesAgo(60).toISOString(),
				exercises: [strength([minutesAgo(50), lastSet])],
			}).expect(200)

			const done = finishResponse.parse(response.body).data
			expect(done.workout.finishedAt).toBe(lastSet.toISOString())
			expect(done.workout.durationMin).toBe(70)
		})

		it('a tap 40 min after the last set ends at the set (30-min rule)', async () => {
			await start()
			const owner = await user('owner@kus.app')
			const id = await startAged(owner, 120)
			const lastSet = minutesAgo(90)
			const tap = new Date(lastSet.getTime() + 40 * 60_000)

			const response = await finish(owner, id, {
				finishedAt: tap.toISOString(),
				exercises: [strength([lastSet])],
			}).expect(200)

			const done = finishResponse.parse(response.body).data
			expect(done.workout.finishedAt).toBe(lastSet.toISOString())
			// started 120 min ago, the set 90 min ago
			expect(done.workout.durationMin).toBe(30)
		})

		it('a tap 10 min after the last set is the finish exactly', async () => {
			await start()
			const owner = await user('owner@kus.app')
			const id = await startAged(owner, 120)
			const lastSet = minutesAgo(90)
			const tap = new Date(lastSet.getTime() + 10 * 60_000)

			const response = await finish(owner, id, {
				finishedAt: tap.toISOString(),
				exercises: [strength([lastSet])],
			}).expect(200)

			const done = finishResponse.parse(response.body).data
			expect(done.workout.finishedAt).toBe(tap.toISOString())
			expect(done.workout.durationMin).toBe(40)
		})

		const cardioAndStrength = (lastSet: Date) => [
			strength([new Date(lastSet.getTime() - 20 * 60_000), lastSet]),
			{ clientKey: randomUUID(), name: 'Доріжка', kind: 'CARDIO', durationMin: 10, sets: [] },
		]

		it('cardio without sets, a tap 40 min after the last set: ends at the set, cardio is not later', async () => {
			await start()
			const owner = await user('owner@kus.app')
			const id = await startAged(owner, 5 * HOUR_MIN)
			const lastSet = minutesAgo(3 * HOUR_MIN)
			const tap = new Date(lastSet.getTime() + 40 * 60_000)

			const response = await finish(owner, id, {
				finishedAt: tap.toISOString(),
				exercises: cardioAndStrength(lastSet),
			}).expect(200)

			const done = finishResponse.parse(response.body).data
			expect(done.workout.finishedAt).toBe(lastSet.toISOString())
			const finishedAt = await finishedAtOf(id)
			const rows = await prisma.exerciseEntry.findMany({ where: { workoutId: id } })
			expect(rows).toHaveLength(2)
			expect(finishedAt.toISOString()).toBe(lastSet.toISOString())
			for (const row of rows) {
				expect(row.performedAt.getTime()).toBeLessThanOrEqual(finishedAt.getTime())
			}
		})

		it('cardio without sets, a tap 10 min after the last set: finished at the tap', async () => {
			await start()
			const owner = await user('owner@kus.app')
			const id = await startAged(owner, 5 * HOUR_MIN)
			const lastSet = minutesAgo(3 * HOUR_MIN)
			const tap = new Date(lastSet.getTime() + 10 * 60_000)

			const response = await finish(owner, id, {
				finishedAt: tap.toISOString(),
				exercises: cardioAndStrength(lastSet),
			}).expect(200)

			expect(finishResponse.parse(response.body).data.workout.finishedAt).toBe(tap.toISOString())
			const cardio = await prisma.exerciseEntry.findFirstOrThrow({
				where: { workoutId: id, kind: 'CARDIO' },
			})
			expect(cardio.performedAt.getTime()).toBeLessThanOrEqual(tap.getTime())
		})

		it('a new cardio row without sets next to done sets and a past tap: finished at the tap', async () => {
			await start()
			const owner = await user('owner@kus.app')
			const id = await startAged(owner, 5 * HOUR_MIN)
			const lastSet = minutesAgo(4 * HOUR_MIN)
			const tap = new Date(lastSet.getTime() + 5 * 60_000)

			const response = await finish(owner, id, {
				finishedAt: tap.toISOString(),
				exercises: [
					strength([minutesAgo(4 * HOUR_MIN + 20), lastSet]),
					{ clientKey: randomUUID(), name: 'Доріжка', kind: 'CARDIO', durationMin: 10, sets: [] },
				],
			}).expect(200)

			const done = finishResponse.parse(response.body).data
			expect(done.workout.finishedAt).toBe(tap.toISOString())
			expect(done.workout.exercises).toHaveLength(2)
		})
	})

	it('a repeat answers the same and ignores a different body; one summary', async () => {
		await start()
		const owner = await user('owner@kus.app')
		const id = await startAged(owner, 60)
		const body = { exercises: [strength([minutesAgo(20), minutesAgo(5)])] }
		const first = await finish(owner, id, body).expect(200)
		const stored = await prisma.workout.findUniqueOrThrow({ where: { id } })

		const same = await finish(owner, id, body).expect(200)
		const other = await finish(owner, id, {
			finishedAt: minutesAgo(40).toISOString(),
			exercises: [strength([minutesAgo(30)], { name: 'Присід' })],
		}).expect(200)

		expect(same.body).toEqual(first.body)
		expect(other.body).toEqual(first.body)
		expect(await readSummaries(owner.userId)).toHaveLength(1)
		expect(await readSets(id)).toEqual([50, 60])
		const after = await prisma.workout.findUniqueOrThrow({ where: { id } })
		expect(after.finishedAt).toEqual(stored.finishedAt)
		expect(after.finishedMessageId).toBe(stored.finishedMessageId)
	})

	it('409 EDITED when knownEditedAt is stale: nothing written, the session stays open', async () => {
		await start()
		const owner = await user('owner@kus.app')
		const id = await startAged(owner, 60)
		await owner.agent
			.put(`${LIVE_URL}/${id}`)
			.send({ knownEditedAt: null, exercises: [strength([minutesAgo(30)])] })
			.expect(200)
		const editedAt = new Date()
		await prisma.workout.update({ where: { id }, data: { editedAt } })
		const setsBefore = await readSets(id)

		const response = await finish(owner, id, {
			knownEditedAt: new Date(editedAt.getTime() - 1000).toISOString(),
			exercises: [strength([minutesAgo(5), minutesAgo(2)], { name: 'Тяга' })],
		}).expect(409)

		expect(apiErrorResponseSchema.parse(response.body)).toMatchObject({
			errorCode: 'WORKOUT_LIVE_CONFLICT',
			details: { reason: 'EDITED' },
		})
		const row = await prisma.workout.findUniqueOrThrow({ where: { id } })
		expect(row.finishedAt).toBeNull()
		expect(row.deletedAt).toBeNull()
		expect(await readSets(id)).toEqual(setsBefore)
		expect(await readSummaries(owner.userId)).toHaveLength(0)
	})

	describe('isolation', () => {
		it("another user's session: 404 and it is untouched; an unknown id is 404", async () => {
			await start()
			const owner = await user('owner@kus.app')
			const stranger = await user('stranger@kus.app')
			const theirs = await startAged(stranger, 60)
			await stranger.agent
				.put(`${LIVE_URL}/${theirs}`)
				.send({ knownEditedAt: null, exercises: [strength([minutesAgo(10)])] })
				.expect(200)

			await finish(owner, theirs, {
				exercises: [strength([minutesAgo(5)], { name: 'Чужа' })],
			}).expect(404)
			await finish(owner, theirs).expect(404)
			await finish(owner, UNKNOWN_ID, { exercises: [strength([minutesAgo(5)])] }).expect(404)

			const row = await prisma.workout.findUniqueOrThrow({ where: { id: theirs } })
			expect(row.finishedAt).toBeNull()
			expect(row.deletedAt).toBeNull()
			expect(await readSets(theirs)).toEqual([50])
			expect(await readSummaries(stranger.userId)).toHaveLength(0)
			expect(await readSummaries(owner.userId)).toHaveLength(0)
		})
	})

	it('exercises without knownEditedAt: 422 and the open session is unchanged', async () => {
		await start()
		const owner = await user('owner@kus.app')
		const id = await startAged(owner, 60)
		await owner.agent
			.put(`${LIVE_URL}/${id}`)
			.send({ knownEditedAt: null, exercises: [strength([minutesAgo(30)])] })
			.expect(200)

		const response = await finishRaw(owner, id, {
			exercises: [strength([minutesAgo(5), minutesAgo(2)], { name: 'Тяга' })],
		}).expect(422)

		expect(response.body).toMatchObject({ errorCode: 'VALIDATION_ERROR' })
		const row = await prisma.workout.findUniqueOrThrow({ where: { id } })
		expect(row.finishedAt).toBeNull()
		expect(await readSets(id)).toEqual([50])
		expect(await readSummaries(owner.userId)).toHaveLength(0)
	})

	it('duplicate clientKeys: 422 and the open session is unchanged', async () => {
		await start()
		const owner = await user('owner@kus.app')
		const id = await startAged(owner, 60)
		await owner.agent
			.put(`${LIVE_URL}/${id}`)
			.send({ knownEditedAt: null, exercises: [strength([minutesAgo(30)])] })
			.expect(200)
		const clientKey = randomUUID()

		const response = await finish(owner, id, {
			exercises: [
				strength([minutesAgo(5)], { clientKey }),
				strength([minutesAgo(4)], { clientKey, name: 'Тяга' }),
			],
		}).expect(422)

		expect(response.body).toMatchObject({ details: { fields: { exercises: 'DUPLICATE' } } })
		const row = await prisma.workout.findUniqueOrThrow({ where: { id } })
		expect(row.finishedAt).toBeNull()
		expect(row.deletedAt).toBeNull()
		expect(await readSets(id)).toEqual([50])
		expect(await readSummaries(owner.userId)).toHaveLength(0)
	})

	it('nothing done in the snapshot: { discarded: true }, soft-deleted, no message', async () => {
		await start()
		const owner = await user('owner@kus.app')
		const id = await startAged(owner, 30)

		const response = await finish(owner, id, {
			exercises: [liveExercise({ sets: [liveSet({ doneAt: null }), liveSet({ doneAt: null })] })],
		}).expect(200)

		expect(response.body).toEqual({ data: { discarded: true } })
		const row = await prisma.workout.findUniqueOrThrow({ where: { id } })
		expect(row.deletedAt).not.toBeNull()
		expect(row.finishedAt).toBeNull()
		expect(await readSummaries(owner.userId)).toHaveLength(0)
	})

	it('a late finish: server idle 5 h, the phone brings old sets and its tap; not an auto close', async () => {
		await start()
		const owner = await user('owner@kus.app')
		const { workout } = await startLive(owner)
		const id = workout.id
		await owner.agent
			.put(`${LIVE_URL}/${id}`)
			.send({ knownEditedAt: null, exercises: [liveExercise()] })
			.expect(200)
		// the server last saw a set 5 h ago
		const seen = minutesAgo(5 * HOUR_MIN)
		await backdateStart(id, 6 * HOUR_MIN)
		await prisma.exerciseSet.updateMany({
			where: { exerciseEntry: { workoutId: id } },
			data: { doneAt: seen },
		})
		await prisma.exerciseEntry.updateMany({ where: { workoutId: id }, data: { performedAt: seen } })
		const lastSet = minutesAgo(3 * HOUR_MIN + 30)
		const tap = new Date(lastSet.getTime() + 5 * 60_000)
		const exercise = await prisma.exerciseEntry.findFirstOrThrow({ where: { workoutId: id } })

		const response = await finish(owner, id, {
			finishedAt: tap.toISOString(),
			exercises: [
				{
					clientKey: exercise.clientKey,
					name: exercise.name,
					kind: 'STRENGTH',
					sets: [
						liveSet({ weightKg: 70, doneAt: minutesAgo(4 * HOUR_MIN).toISOString() }),
						liveSet({ weightKg: 75, doneAt: lastSet.toISOString() }),
					],
				},
			],
		}).expect(200)

		const done = finishResponse.parse(response.body).data
		expect(done.workout.finishedAt).toBe(tap.toISOString())
		expect(await readSets(id)).toEqual([70, 75])
		const summaries = await readSummaries(owner.userId)
		expect(summaries).toHaveLength(1)
		expect(summaries[0]?.content).not.toContain('понад 3 години')
		const row = await prisma.workout.findUniqueOrThrow({ where: { id } })
		expect(row.deletedAt).toBeNull()
		const current = nullableLive.parse(
			(await owner.agent.get(`${LIVE_URL}/current`).expect(200)).body,
		).data
		expect(current).toBeNull()
	})
})
