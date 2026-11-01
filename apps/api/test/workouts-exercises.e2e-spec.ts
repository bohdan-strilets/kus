import type { NestExpressApplication } from '@nestjs/platform-express'
import {
	apiErrorResponseSchema,
	authSessionResponseSchema,
	createDataResponseSchema,
	exerciseDictionaryResponseSchema,
} from '@kus/shared'
import request from 'supertest'
import type TestAgent from 'supertest/lib/agent'
import { afterEach, describe, expect, it } from 'vitest'

import type { PrismaService } from '../src/prisma'
import { createDbTestApp } from './create-db-test-app'

const EXERCISES_URL = '/api/v1/workouts/exercises'

const listResponse = createDataResponseSchema(exerciseDictionaryResponseSchema)

describe('exercise dictionary (e2e, real DB)', () => {
	let app: NestExpressApplication
	let prisma: PrismaService

	const start = async (): Promise<void> => {
		;({ app, prisma } = await createDbTestApp())
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

	const seedExercise = (
		userId: string,
		name: string,
		extra: { kind?: 'STRENGTH' | 'CARDIO'; muscleGroup?: 'CHEST' | 'BACK' | 'ARMS' } = {},
	) =>
		prisma.exercise.create({
			data: {
				userId,
				name,
				nameNormalized: name.toLowerCase(),
				kind: extra.kind ?? 'STRENGTH',
				muscleGroup: extra.muscleGroup ?? null,
			},
		})

	/** One logged result: two working sets of the exercise, today. */
	const seedResult = async (userId: string, exerciseId: string, name: string): Promise<void> => {
		const workout = await prisma.workout.create({
			data: { userId, localDate: new Date('2026-10-30T00:00:00Z') },
		})
		const entry = await prisma.exerciseEntry.create({
			data: {
				userId,
				workoutId: workout.id,
				exerciseId,
				name,
				kind: 'STRENGTH',
				source: 'MANUAL',
				performedAt: new Date('2026-10-30T10:00:00Z'),
				localDate: new Date('2026-10-30T00:00:00Z'),
				position: 0,
			},
		})
		await prisma.exerciseSet.createMany({
			data: [
				{ userId, exerciseEntryId: entry.id, position: 0, reps: 12, weightKg: 50 },
				{ userId, exerciseEntryId: entry.id, position: 1, reps: 10, weightKg: 50 },
			],
		})
	}

	afterEach(async () => {
		await app.close()
	})

	it('lists the own exercises with the last result, and null where there is none', async () => {
		await start()
		const owner = await registerUser('owner@kus.app')
		const row = await seedExercise(owner.userId, 'Тяга блока', { muscleGroup: 'BACK' })
		await seedExercise(owner.userId, 'Гіперекстензія', { muscleGroup: 'BACK' })
		await seedResult(owner.userId, row.id, 'Тяга блока')

		const response = await owner.agent.get(EXERCISES_URL).expect(200)
		const { data } = listResponse.parse(response.body)

		expect(data.map((item) => item.name)).toEqual(['Гіперекстензія', 'Тяга блока'])
		expect(data[0]?.lastSets).toBeNull()
		expect(data[1]?.lastSets).toEqual([
			{ reps: 12, weightKg: 50, isWarmup: false },
			{ reps: 10, weightKg: 50, isWarmup: false },
		])
	})

	it('filters by a part of the name and by group, cardio by kind', async () => {
		await start()
		const owner = await registerUser('owner@kus.app')
		await seedExercise(owner.userId, 'Тяга блока', { muscleGroup: 'BACK' })
		await seedExercise(owner.userId, 'Жим лежачи', { muscleGroup: 'CHEST' })
		await seedExercise(owner.userId, 'Біг', { kind: 'CARDIO' })

		const byName = await owner.agent.get(EXERCISES_URL).query({ query: ' ТЯГА ' }).expect(200)
		const byGroup = await owner.agent.get(EXERCISES_URL).query({ group: 'CHEST' }).expect(200)
		const byCardio = await owner.agent.get(EXERCISES_URL).query({ group: 'CARDIO' }).expect(200)

		expect(listResponse.parse(byName.body).data.map((item) => item.name)).toEqual(['Тяга блока'])
		expect(listResponse.parse(byGroup.body).data.map((item) => item.name)).toEqual(['Жим лежачи'])
		expect(listResponse.parse(byCardio.body).data.map((item) => item.name)).toEqual(['Біг'])
	})

	it("never shows another user's or a deleted exercise, nor its results", async () => {
		await start()
		const owner = await registerUser('owner@kus.app')
		const stranger = await registerUser('stranger@kus.app')
		const mine = await seedExercise(owner.userId, 'Тяга блока', { muscleGroup: 'BACK' })
		await seedResult(owner.userId, mine.id, 'Тяга блока')
		const deleted = await seedExercise(owner.userId, 'Старе', { muscleGroup: 'ARMS' })
		await prisma.exercise.update({ where: { id: deleted.id }, data: { deletedAt: new Date() } })

		const strangerList = await stranger.agent.get(EXERCISES_URL).expect(200)
		const ownerList = await owner.agent.get(EXERCISES_URL).expect(200)

		expect(listResponse.parse(strangerList.body).data).toEqual([])
		expect(listResponse.parse(ownerList.body).data.map((item) => item.name)).toEqual(['Тяга блока'])
	})

	it('rejects an unknown group with VALIDATION_ERROR', async () => {
		await start()
		const owner = await registerUser('owner@kus.app')

		const response = await owner.agent.get(EXERCISES_URL).query({ group: 'NECK' }).expect(422)

		expect(apiErrorResponseSchema.parse(response.body).errorCode).toBe('VALIDATION_ERROR')
	})

	it('answers 401 without a session', async () => {
		await start()

		await request(app.getHttpServer()).get(EXERCISES_URL).expect(401)
	})
})
