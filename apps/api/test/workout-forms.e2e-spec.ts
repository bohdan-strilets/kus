import { randomUUID } from 'node:crypto'

import { Logger } from '@nestjs/common'
import type { NestExpressApplication } from '@nestjs/platform-express'
import {
	apiErrorResponseSchema,
	chatMessageSchema,
	createCursorPaginatedResponseSchema,
	createDataResponseSchema,
	shiftDate,
	workoutFinishedSchema,
} from '@kus/shared'
import request from 'supertest'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { formatLocalClock, getLocalDateString } from '../src/common/time'
import type { PrismaService } from '../src/prisma'
import { createDbTestApp } from './create-db-test-app'
import {
	FORMS_URL,
	MINUTE_MS,
	registerUser,
	seedProgram,
	type TestUser,
} from './workout-logging-test-utils'

const TIMEZONE = 'Europe/Warsaw'
const FORM_FUTURE_BUFFER_MIN = 30

const formResponse = createDataResponseSchema(workoutFinishedSchema)
const feedResponse = createCursorPaginatedResponseSchema(chatMessageSchema)

const bench = (overrides: Record<string, unknown> = {}) => ({
	name: 'Жим лежачи',
	kind: 'STRENGTH',
	sets: [{ reps: 8, weightKg: 80 }],
	...overrides,
})

describe('workout forms (e2e, real DB)', () => {
	let app: NestExpressApplication
	let prisma: PrismaService
	vi.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined)

	const start = async (): Promise<void> => {
		;({ app, prisma } = await createDbTestApp())
	}

	const user = (email: string): Promise<TestUser> => registerUser(app, email)

	const today = (): string => getLocalDateString(new Date(), TIMEZONE)

	const body = (overrides: Record<string, unknown> = {}) => ({
		clientRequestId: randomUUID(),
		templateId: null,
		localDate: today(),
		startTime: '00:00',
		durationMin: 45,
		exercises: [bench()],
		...overrides,
	})

	const post = (who: TestUser, payload: Record<string, unknown>) =>
		who.agent.post(FORMS_URL).send(payload)

	afterEach(async () => {
		await app.close()
	})

	it('answers 401 without a session', async () => {
		await start()

		await request(app.getHttpServer()).post(FORMS_URL).send(body()).expect(401)
	})

	describe('a saved form', () => {
		it('is a finished FORM session with a Kusik summary message and a card in the chat', async () => {
			await start()
			const owner = await user('owner@kus.app')

			const response = await post(owner, body()).expect(201)

			const done = formResponse.parse(response.body).data
			expect(done.workout).toMatchObject({ source: 'FORM', durationMin: 45 })
			expect(done.workout.finishedAt).not.toBeNull()
			expect(done.workout.exercises[0]?.sets[0]?.doneAt).toBeNull()
			const message = await prisma.message.findUniqueOrThrow({ where: { id: done.messageId } })
			expect(message).toMatchObject({
				role: 'ASSISTANT',
				replyToId: null,
				content: 'Записав тренування.',
			})
			const feed = feedResponse.parse((await owner.agent.get('/api/v1/messages').expect(200)).body)
			const summary = feed.data.find(({ id }) => id === done.messageId)
			expect(summary?.workoutCards).toMatchObject([
				{ workoutId: done.workout.id, variant: 'SUMMARY' },
			])
			expect(summary?.workouts.map(({ id }) => id)).toEqual([done.workout.id])
		})

		it('becomes the «deleted» workout in the chat feed after it is deleted', async () => {
			await start()
			const owner = await user('owner@kus.app')
			const done = formResponse.parse((await post(owner, body()).expect(201)).body).data

			await owner.agent.delete(`/api/v1/workouts/${done.workout.id}`).expect(204)

			const feed = feedResponse.parse((await owner.agent.get('/api/v1/messages').expect(200)).body)
			const summary = feed.data.find(({ id }) => id === done.messageId)
			expect(summary?.workouts[0]).toMatchObject({ id: done.workout.id, isDeleted: true })
		})

		it('is listed in the journal and the day like any finished workout', async () => {
			await start()
			const owner = await user('owner@kus.app')
			const done = formResponse.parse((await post(owner, body()).expect(201)).body).data

			const day = await owner.agent.get(`/api/v1/workouts/day/${today()}`).expect(200)

			expect((day.body as { data: { id: string }[] }).data.map(({ id }) => id)).toEqual([
				done.workout.id,
			])
		})

		it('names the template in the message and on the session', async () => {
			await start()
			const owner = await user('owner@kus.app')
			const program = await seedProgram(app, owner)
			const template = program.templates[0]

			const response = await post(
				owner,
				body({
					templateId: template?.id,
					exercises: [bench({ templateExerciseId: template?.exercises[0]?.id })],
				}),
			).expect(201)

			const done = formResponse.parse(response.body).data
			expect(done.workout.templateName).toBe('Верх A')
			const message = await prisma.message.findUniqueOrThrow({ where: { id: done.messageId } })
			expect(message.content).toBe('Записав Верх A.')
		})

		it('learns the «власна вага» flag and saves the group from the dictionary', async () => {
			await start()
			const owner = await user('owner@kus.app')

			await post(
				owner,
				body({
					exercises: [
						bench({
							name: 'Підтягування',
							isBodyweight: true,
							sets: [{ reps: 10, weightKg: null }],
						}),
					],
				}),
			).expect(201)

			const row = await prisma.exercise.findFirstOrThrow({
				where: { userId: owner.userId, name: 'Підтягування' },
			})
			expect(row.isBodyweight).toBe(true)
		})

		it('a cardio exercise with a time is done work', async () => {
			await start()
			const owner = await user('owner@kus.app')

			await post(
				owner,
				body({ exercises: [{ name: 'Біг', kind: 'CARDIO', durationMin: 20, sets: [] }] }),
			).expect(201)

			expect(await prisma.workout.count({ where: { userId: owner.userId } })).toBe(1)
		})
	})

	describe('idempotency by clientRequestId', () => {
		it('a repeat answers 200 with the same session, one workout and one message', async () => {
			await start()
			const owner = await user('owner@kus.app')
			const payload = body()

			const first = await post(owner, payload).expect(201)
			const repeat = await post(owner, payload).expect(200)

			const a = formResponse.parse(first.body).data
			const b = formResponse.parse(repeat.body).data
			expect(b.workout.id).toBe(a.workout.id)
			expect(b.messageId).toBe(a.messageId)
			expect(await prisma.workout.count({ where: { userId: owner.userId } })).toBe(1)
			expect(
				await prisma.message.count({ where: { userId: owner.userId, role: 'ASSISTANT' } }),
			).toBe(1)
		})

		it('two parallel twins leave one workout and one message (one 201, one 200)', async () => {
			await start()
			const owner = await user('owner@kus.app')
			const payload = body()

			const [a, b] = await Promise.all([post(owner, payload), post(owner, payload)])

			expect([a.status, b.status].sort()).toEqual([200, 201])
			expect(formResponse.parse(a.body).data.workout.id).toBe(
				formResponse.parse(b.body).data.workout.id,
			)
			expect(await prisma.workout.count({ where: { userId: owner.userId } })).toBe(1)
			expect(
				await prisma.message.count({ where: { userId: owner.userId, role: 'ASSISTANT' } }),
			).toBe(1)
		})

		it("another user's request with the same id makes their own session, never the owner's", async () => {
			await start()
			const owner = await user('owner@kus.app')
			const stranger = await user('stranger@kus.app')
			const payload = body()
			const mine = formResponse.parse((await post(owner, payload).expect(201)).body).data

			const theirs = await post(stranger, payload).expect(201)

			const other = formResponse.parse(theirs.body).data
			expect(other.workout.id).not.toBe(mine.workout.id)
			expect(await prisma.workout.count({ where: { userId: stranger.userId } })).toBe(1)
		})

		describe('an id that belongs to a chat message', () => {
			const seedMessage = (
				userId: string,
				clientMessageId: string,
				role: 'USER' | 'ASSISTANT',
			): Promise<unknown> =>
				prisma.message.create({
					data: { userId, role, status: 'COMPLETED', clientMessageId, content: '3 яйця' },
				})

			const errorCodeOf = (response: { body: unknown }): string =>
				apiErrorResponseSchema.parse(response.body).errorCode

			it("a user chat message's id is 409 CLIENT_MESSAGE_ID_REUSED, no workout is made", async () => {
				await start()
				const owner = await user('owner@kus.app')
				const clientRequestId = randomUUID()
				await seedMessage(owner.userId, clientRequestId, 'USER')

				const response = await post(owner, body({ clientRequestId })).expect(409)

				expect(errorCodeOf(response)).toBe('CLIENT_MESSAGE_ID_REUSED')
				expect(await prisma.workout.count({ where: { userId: owner.userId } })).toBe(0)
				expect(
					await prisma.message.count({
						where: { userId: owner.userId, clientMessageId: { not: null } },
					}),
				).toBe(1)
			})

			it('an assistant message without a workout under that id is 409 as well', async () => {
				await start()
				const owner = await user('owner@kus.app')
				const clientRequestId = randomUUID()
				await seedMessage(owner.userId, clientRequestId, 'ASSISTANT')

				const response = await post(owner, body({ clientRequestId })).expect(409)

				expect(errorCodeOf(response)).toBe('CLIENT_MESSAGE_ID_REUSED')
				expect(await prisma.workout.count({ where: { userId: owner.userId } })).toBe(0)
			})

			it("the same id on another user's chat message does not block this user", async () => {
				await start()
				const owner = await user('owner@kus.app')
				const stranger = await user('stranger@kus.app')
				const clientRequestId = randomUUID()
				await seedMessage(stranger.userId, clientRequestId, 'USER')

				const response = await post(owner, body({ clientRequestId })).expect(201)

				expect(formResponse.parse(response.body).data.workout.source).toBe('FORM')
				expect(await prisma.workout.count({ where: { userId: owner.userId } })).toBe(1)
				expect(await prisma.workout.count({ where: { userId: stranger.userId } })).toBe(0)
			})

			it('a real repeat of the form stays idempotent (200, not 409), even after the workout is deleted', async () => {
				await start()
				const owner = await user('owner@kus.app')
				const payload = body()
				const first = formResponse.parse((await post(owner, payload).expect(201)).body).data

				const repeat = await post(owner, payload).expect(200)
				await owner.agent.delete(`/api/v1/workouts/${first.workout.id}`).expect(204)
				const afterDelete = await post(owner, payload)

				expect(formResponse.parse(repeat.body).data.workout.id).toBe(first.workout.id)
				expect(afterDelete.status).toBe(200)
				expect(await prisma.workout.count({ where: { userId: owner.userId } })).toBe(1)
			})
		})

		it('a rejected form leaves no message and no workout, and the id can be used again', async () => {
			await start()
			const owner = await user('owner@kus.app')
			const clientRequestId = randomUUID()

			await post(owner, body({ clientRequestId, localDate: shiftDate(today(), -4) })).expect(422)
			expect(await prisma.workout.count()).toBe(0)
			expect(await prisma.message.count({ where: { role: 'ASSISTANT' } })).toBe(0)

			await post(owner, body({ clientRequestId })).expect(201)
		})
	})

	describe('validation', () => {
		const fieldsOf = (response: { body: unknown }) =>
			apiErrorResponseSchema.parse(response.body).details

		it('accepts today − 3 days', async () => {
			await start()
			const owner = await user('owner@kus.app')

			const response = await post(owner, body({ localDate: shiftDate(today(), -3) })).expect(201)

			expect(formResponse.parse(response.body).data.workout.localDate).toBe(shiftDate(today(), -3))
		})

		it('rejects today − 4 days with 422 TOO_OLD', async () => {
			await start()
			const owner = await user('owner@kus.app')

			const response = await post(owner, body({ localDate: shiftDate(today(), -4) })).expect(422)

			expect(fieldsOf(response)).toEqual({ fields: { localDate: 'TOO_OLD' } })
		})

		it('rejects tomorrow with 422 IN_FUTURE', async () => {
			await start()
			const owner = await user('owner@kus.app')

			const response = await post(owner, body({ localDate: shiftDate(today(), 1) })).expect(422)

			expect(fieldsOf(response)).toEqual({ fields: { localDate: 'IN_FUTURE' } })
		})

		it('rejects a start later today with 422 IN_FUTURE on startTime', async () => {
			await start()
			const owner = await user('owner@kus.app')
			const later = new Date(Date.now() + FORM_FUTURE_BUFFER_MIN * MINUTE_MS)
			const isSameDay = getLocalDateString(later, TIMEZONE) === today()
			const startTime = isSameDay ? formatLocalClock(later, TIMEZONE) : '23:59'

			const response = await post(owner, body({ startTime })).expect(422)

			expect(fieldsOf(response)).toEqual({ fields: { startTime: 'IN_FUTURE' } })
			expect(await prisma.workout.count()).toBe(0)
		})

		it('rejects a form where nothing was done (all «не робили» or empty) with 422 TOO_SMALL', async () => {
			await start()
			const owner = await user('owner@kus.app')

			const empty = await post(owner, body({ exercises: [] })).expect(422)
			const notDone = await post(
				owner,
				body({ exercises: [bench({ sets: [] }), bench({ name: 'Присід', sets: [] })] }),
			).expect(422)

			expect(fieldsOf(empty)).toEqual({ fields: { exercises: 'TOO_SMALL' } })
			expect(fieldsOf(notDone)).toEqual({ fields: { exercises: 'TOO_SMALL' } })
			expect(await prisma.workout.count()).toBe(0)
		})

		it('does not save an exercise without work next to one with work', async () => {
			await start()
			const owner = await user('owner@kus.app')

			const response = await post(
				owner,
				body({ exercises: [bench({ sets: [] }), bench({ name: 'Присід' })] }),
			).expect(201)

			const names = formResponse.parse(response.body).data.workout.exercises.map(({ name }) => name)
			expect(names).toEqual(['Присід'])
		})

		it('rejects a bodyweight exercise with a weight (422), a bad startTime and a duration over 600', async () => {
			await start()
			const owner = await user('owner@kus.app')

			await post(
				owner,
				body({ exercises: [bench({ isBodyweight: true, sets: [{ reps: 5, weightKg: 10 }] })] }),
			).expect(422)
			await post(owner, body({ startTime: '25:00' })).expect(422)
			await post(owner, body({ startTime: '9:00' })).expect(422)
			await post(owner, body({ durationMin: 601 })).expect(422)
			await post(owner, body({ durationMin: 0 })).expect(422)
			expect(await prisma.workout.count()).toBe(0)
		})

		it("refuses another user's template and a template exercise of another template (404)", async () => {
			await start()
			const owner = await user('owner@kus.app')
			const stranger = await user('stranger@kus.app')
			const mine = await seedProgram(app, owner)
			const theirs = await seedProgram(app, stranger)

			await post(owner, body({ templateId: theirs.templates[0]?.id })).expect(404)
			await post(
				owner,
				body({
					templateId: mine.templates[0]?.id,
					exercises: [bench({ templateExerciseId: mine.templates[1]?.exercises[0]?.id })],
				}),
			).expect(404)
			await post(
				owner,
				body({
					templateId: mine.templates[0]?.id,
					exercises: [bench({ templateExerciseId: theirs.templates[0]?.exercises[0]?.id })],
				}),
			).expect(404)

			expect(await prisma.workout.count({ where: { userId: owner.userId } })).toBe(0)
			expect(
				await prisma.message.count({ where: { userId: owner.userId, role: 'ASSISTANT' } }),
			).toBe(0)
		})
	})

	describe('time zone', () => {
		it('stores HH:mm of the user wall clock as the matching UTC start, and the finish after the duration', async () => {
			await start()
			const owner = await user('owner@kus.app')
			const localDate = shiftDate(today(), -1)

			const response = await post(
				owner,
				body({ localDate, startTime: '18:30', durationMin: 75 }),
			).expect(201)

			const { workout } = formResponse.parse(response.body).data
			const startedAt = new Date(workout.startedAt ?? 0)
			expect(getLocalDateString(startedAt, TIMEZONE)).toBe(localDate)
			expect(formatLocalClock(startedAt, TIMEZONE)).toBe('18:30')
			const finishedAt = new Date(workout.finishedAt ?? 0)
			expect(finishedAt.getTime() - startedAt.getTime()).toBe(75 * MINUTE_MS)
		})

		it('follows the time zone of the user, not the server', async () => {
			await start()
			const owner = await user('owner@kus.app')
			const zone = 'America/New_York'
			await prisma.user.update({ where: { id: owner.userId }, data: { timezone: zone } })
			const localDate = shiftDate(getLocalDateString(new Date(), zone), -1)

			const response = await post(owner, body({ localDate, startTime: '07:15' })).expect(201)

			const startedAt = new Date(formResponse.parse(response.body).data.workout.startedAt ?? 0)
			expect(formatLocalClock(startedAt, zone)).toBe('07:15')
			expect(getLocalDateString(startedAt, zone)).toBe(localDate)
		})
	})
})
