import { Logger } from '@nestjs/common'
import type { NestExpressApplication } from '@nestjs/platform-express'
import {
	apiErrorResponseSchema,
	authSessionResponseSchema,
	createDataResponseSchema,
	workoutResponseSchema,
} from '@kus/shared'
import request from 'supertest'
import type TestAgent from 'supertest/lib/agent'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { z } from 'zod'

import { createFakeAiClient } from '../src/modules/ai/ai.test-utils'
import type { PrismaService } from '../src/prisma'
import { createDbTestApp } from './create-db-test-app'

const WORKOUTS_URL = '/api/v1/workouts'
const DAY = '2026-10-27'
const OTHER_DAY = '2026-10-20'
const NOW = new Date('2026-10-27T17:30:00Z')
const UNKNOWN_ID = '0199b3a4-0000-7000-8000-000000000001'

const listResponse = createDataResponseSchema(z.array(workoutResponseSchema))
const oneResponse = createDataResponseSchema(workoutResponseSchema)
const fake = createFakeAiClient()

describe('workouts (e2e, real DB)', () => {
	let app: NestExpressApplication
	let prisma: PrismaService
	vi.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined)

	const start = async (): Promise<void> => {
		;({ app, prisma } = await createDbTestApp({ aiClient: fake.client }))
	}

	const registerUser = async (email: string): Promise<{ agent: TestAgent; userId: string }> => {
		const agent = request.agent(app.getHttpServer())
		const response = await agent
			.post('/api/v1/auth/register')
			.send({ email, password: 'correct-horse-battery', name: 'Bohdan', consent: true })
			.expect(201)
		const { user } = createDataResponseSchema(authSessionResponseSchema).parse(response.body).data
		return { agent, userId: user.id }
	}

	const seedWorkout = async (userId: string, localDate = DAY) => {
		const date = new Date(`${localDate}T00:00:00Z`)
		const workout = await prisma.workout.create({
			data: {
				userId,
				localDate: date,
				place: 'GYM',
				durationMin: 55,
				kcalBurned: 320,
				kcalSource: 'MANUAL',
			},
		})
		const common = { userId, workoutId: workout.id, source: 'MANUAL', performedAt: NOW } as const
		const bench = await prisma.exerciseEntry.create({
			data: { ...common, localDate: date, name: 'Жим лежачи', kind: 'STRENGTH', position: 0 },
		})
		await prisma.exerciseSet.createMany({
			data: [
				{ userId, exerciseEntryId: bench.id, position: 1, reps: 8, weightKg: 82.5 },
				{ userId, exerciseEntryId: bench.id, position: 0, reps: 8, weightKg: 80, isWarmup: true },
			],
		})
		await prisma.exerciseEntry.create({
			data: {
				...common,
				localDate: date,
				name: 'Біг',
				kind: 'CARDIO',
				position: 1,
				durationMin: 20,
				distanceM: 3000,
			},
		})
		await prisma.exerciseEntry.create({
			data: { ...common, localDate: date, name: 'Видалена вправа', position: 2, deletedAt: NOW },
		})
		return workout
	}

	const readDeletedAt = async (id: string): Promise<Date | null> =>
		(await prisma.workout.findUniqueOrThrow({ where: { id } })).deletedAt

	afterEach(async () => {
		await app.close()
	})

	it('returns a day with its exercises and sets in the order they were done', async () => {
		await start()
		const owner = await registerUser('owner@kus.app')
		await seedWorkout(owner.userId)

		const response = await owner.agent.get(`${WORKOUTS_URL}/day/${DAY}`).expect(200)

		const [workout] = listResponse.parse(response.body).data
		expect(workout).toMatchObject({
			localDate: DAY,
			place: 'GYM',
			durationMin: 55,
			kcalBurned: 320,
			kcalSource: 'MANUAL',
		})
		expect(workout?.exercises.map((exercise) => exercise.name)).toEqual(['Жим лежачи', 'Біг'])
		expect(workout?.exercises[0]?.sets.map((set) => [set.weightKg, set.isWarmup])).toEqual([
			[80, true],
			[82.5, false],
		])
		expect(workout?.exercises[1]).toMatchObject({ durationMin: 20, distanceM: 3000, sets: [] })
	})

	it('returns a period newest day first and only the days asked for', async () => {
		await start()
		const owner = await registerUser('owner@kus.app')
		await seedWorkout(owner.userId, OTHER_DAY)
		await seedWorkout(owner.userId, DAY)
		await seedWorkout(owner.userId, '2026-09-01')

		const response = await owner.agent
			.get(WORKOUTS_URL)
			.query({ from: '2026-10-01', to: DAY })
			.expect(200)

		expect(listResponse.parse(response.body).data.map((workout) => workout.localDate)).toEqual([
			DAY,
			OTHER_DAY,
		])
	})

	it('validates the period', async () => {
		await start()
		const owner = await registerUser('owner@kus.app')

		const reversed = await owner.agent
			.get(WORKOUTS_URL)
			.query({ from: DAY, to: OTHER_DAY })
			.expect(422)
		await owner.agent.get(WORKOUTS_URL).query({ from: '2026-01-01', to: DAY }).expect(422)
		await owner.agent.get(WORKOUTS_URL).expect(422)
		await owner.agent.get(`${WORKOUTS_URL}/day/not-a-date`).expect(422)

		expect(apiErrorResponseSchema.parse(reversed.body)).toMatchObject({
			errorCode: 'VALIDATION_ERROR',
			details: { fields: { to: 'BEFORE_FROM' } },
		})
	})

	it('deletes softly, hides the workout, and brings it back', async () => {
		await start()
		const owner = await registerUser('owner@kus.app')
		const workout = await seedWorkout(owner.userId)

		await owner.agent.delete(`${WORKOUTS_URL}/${workout.id}`).expect(204)
		const hidden = await owner.agent.get(`${WORKOUTS_URL}/day/${DAY}`).expect(200)
		expect(listResponse.parse(hidden.body).data).toEqual([])
		expect(await readDeletedAt(workout.id)).not.toBeNull()

		const restored = await owner.agent.post(`${WORKOUTS_URL}/${workout.id}/restore`).expect(200)
		expect(oneResponse.parse(restored.body).data.exercises).toHaveLength(2)
		const again = await owner.agent.post(`${WORKOUTS_URL}/${workout.id}/restore`).expect(200)
		expect(oneResponse.parse(again.body).data.id).toBe(workout.id)
		const shown = await owner.agent.get(`${WORKOUTS_URL}/day/${DAY}`).expect(200)
		expect(listResponse.parse(shown.body).data).toHaveLength(1)
	})

	it('answers 404 WORKOUT_NOT_FOUND for a repeated delete and an unknown id', async () => {
		await start()
		const owner = await registerUser('owner@kus.app')
		const workout = await seedWorkout(owner.userId)
		await owner.agent.delete(`${WORKOUTS_URL}/${workout.id}`).expect(204)

		const repeated = await owner.agent.delete(`${WORKOUTS_URL}/${workout.id}`).expect(404)
		const unknown = await owner.agent.post(`${WORKOUTS_URL}/${UNKNOWN_ID}/restore`).expect(404)

		expect(apiErrorResponseSchema.parse(repeated.body).errorCode).toBe('WORKOUT_NOT_FOUND')
		expect(apiErrorResponseSchema.parse(unknown.body).errorCode).toBe('WORKOUT_NOT_FOUND')
	})

	it('never shows, deletes or restores the workout of another user', async () => {
		await start()
		const owner = await registerUser('owner@kus.app')
		const stranger = await registerUser('stranger@kus.app')
		const workout = await seedWorkout(owner.userId)

		const day = await stranger.agent.get(`${WORKOUTS_URL}/day/${DAY}`).expect(200)
		const range = await stranger.agent
			.get(WORKOUTS_URL)
			.query({ from: '2026-10-01', to: DAY })
			.expect(200)
		const removed = await stranger.agent.delete(`${WORKOUTS_URL}/${workout.id}`).expect(404)
		expect(await readDeletedAt(workout.id)).toBeNull()
		await owner.agent.delete(`${WORKOUTS_URL}/${workout.id}`).expect(204)
		const restored = await stranger.agent.post(`${WORKOUTS_URL}/${workout.id}/restore`).expect(404)

		expect(listResponse.parse(day.body).data).toEqual([])
		expect(listResponse.parse(range.body).data).toEqual([])
		expect(apiErrorResponseSchema.parse(removed.body).errorCode).toBe('WORKOUT_NOT_FOUND')
		expect(apiErrorResponseSchema.parse(restored.body).errorCode).toBe('WORKOUT_NOT_FOUND')
		// the stranger's restore changed nothing
		expect(await readDeletedAt(workout.id)).not.toBeNull()
	})

	it('needs a session', async () => {
		await start()

		await request(app.getHttpServer()).get(`${WORKOUTS_URL}/day/${DAY}`).expect(401)
		await request(app.getHttpServer()).delete(`${WORKOUTS_URL}/${UNKNOWN_ID}`).expect(401)
	})
})
