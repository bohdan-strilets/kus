import type { NestExpressApplication } from '@nestjs/platform-express'
import {
	apiErrorResponseSchema,
	authSessionResponseSchema,
	createDataResponseSchema,
	exerciseStatsResponseSchema,
	workoutStatsResponseSchema,
} from '@kus/shared'
import request from 'supertest'
import type TestAgent from 'supertest/lib/agent'
import { afterEach, describe, expect, it } from 'vitest'

import { getLocalDateString } from '../src/common/time'
import type { PrismaService } from '../src/prisma'
import { createDbTestApp } from './create-db-test-app'

const STATS_URL = '/api/v1/workouts/stats'
const EXERCISES_URL = '/api/v1/workouts/exercises'
// the User.timezone default
const TIMEZONE = 'Europe/Warsaw'
const UNKNOWN_ID = '0199b3a4-0000-7000-8000-000000000001'

const statsResponse = createDataResponseSchema(workoutStatsResponseSchema)
const exerciseResponse = createDataResponseSchema(exerciseStatsResponseSchema)

describe('workout stats (e2e, real DB)', () => {
	let app: NestExpressApplication
	let prisma: PrismaService
	const today = getLocalDateString(new Date(), TIMEZONE)
	const todayDate = new Date(`${today}T00:00:00Z`)

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

	const seedExercises = async (userId: string) => {
		const bench = await prisma.exercise.create({
			data: {
				userId,
				name: 'Жим лежачи',
				nameNormalized: 'жим лежачи',
				kind: 'STRENGTH',
				muscleGroup: 'CHEST',
			},
		})
		const run = await prisma.exercise.create({
			data: { userId, name: 'Біг', nameNormalized: 'біг', kind: 'CARDIO' },
		})
		return { bench, run }
	}

	/** A workout today: a bench with a warm-up and two working sets, and a run. */
	const seedWorkout = async (
		userId: string,
		exercises: Awaited<ReturnType<typeof seedExercises>>,
		{ isDeleted = false }: { isDeleted?: boolean } = {},
	) => {
		const workout = await prisma.workout.create({
			data: {
				userId,
				localDate: todayDate,
				durationMin: 60,
				deletedAt: isDeleted ? new Date() : null,
			},
		})
		const common = {
			userId,
			workoutId: workout.id,
			source: 'MANUAL',
			performedAt: new Date(),
			localDate: todayDate,
		} as const
		const bench = await prisma.exerciseEntry.create({
			data: {
				...common,
				exerciseId: exercises.bench.id,
				name: 'жим',
				kind: 'STRENGTH',
				muscleGroup: 'CHEST',
				position: 0,
			},
		})
		await prisma.exerciseSet.createMany({
			data: [
				{ userId, exerciseEntryId: bench.id, position: 0, reps: 10, weightKg: 40, isWarmup: true },
				{ userId, exerciseEntryId: bench.id, position: 1, reps: 8, weightKg: 80 },
				{ userId, exerciseEntryId: bench.id, position: 2, reps: 6, weightKg: 85 },
			],
		})
		await prisma.exerciseEntry.create({
			data: {
				...common,
				exerciseId: exercises.run.id,
				name: 'Біг',
				kind: 'CARDIO',
				position: 1,
				durationMin: 20,
				distanceM: 3000,
			},
		})
		return workout
	}

	afterEach(async () => {
		await app.close()
	})

	it('answers stats (not read as a workout id) with strength, cardio and no warm-up in the sets', async () => {
		await start()
		const owner = await registerUser('owner@kus.app')
		const exercises = await seedExercises(owner.userId)
		await seedWorkout(owner.userId, exercises)

		const response = await owner.agent.get(STATS_URL).query({ period: 'month' }).expect(200)

		const { data } = statsResponse.parse(response.body)
		expect(data.overview).toMatchObject({ workoutCount: 1, exerciseCount: 1, setCount: 2 })
		expect(data.exercises).toHaveLength(1)
		expect(data.exercises[0]).toMatchObject({
			exerciseId: exercises.bench.id,
			name: 'Жим лежачи',
			setCount: 2,
			best: { weightKg: 85, reps: 6, localDate: today },
		})
		expect(data.cardio).toMatchObject({ sessionCount: 1, durationMin: 20, distanceM: 3000 })
		expect(data.cardio.byExercise.map((item) => item.exerciseId)).toEqual([exercises.run.id])
	})

	it('does not count a deleted workout although its entries are live', async () => {
		await start()
		const owner = await registerUser('owner@kus.app')
		const exercises = await seedExercises(owner.userId)
		await seedWorkout(owner.userId, exercises, { isDeleted: true })

		const response = await owner.agent.get(STATS_URL).query({ period: 'month' }).expect(200)

		const { data } = statsResponse.parse(response.body)
		expect(data.overview).toMatchObject({ workoutCount: 0, setCount: 0, exerciseCount: 0 })
		expect(data.exercises).toEqual([])
		expect(data.cardio.sessionCount).toBe(0)
	})

	it('returns zeros and empty lists for a period without workouts', async () => {
		await start()
		const owner = await registerUser('owner@kus.app')

		const response = await owner.agent.get(STATS_URL).query({ period: 'week' }).expect(200)

		const { data } = statsResponse.parse(response.body)
		expect(data.overview).toMatchObject({
			workoutCount: 0,
			workoutCountPrev: 0,
			setCount: 0,
			durationMin: 0,
			avgDurationMin: null,
			groups: [],
		})
		expect(data.overview.kcal.total).toBeNull()
		expect(data.exercises).toEqual([])
		expect(data.cardio).toMatchObject({ sessionCount: 0, durationMin: 0, byExercise: [] })
	})

	it('rejects an unknown period with VALIDATION_ERROR', async () => {
		await start()
		const owner = await registerUser('owner@kus.app')

		const response = await owner.agent.get(STATS_URL).query({ period: 'year' }).expect(422)

		expect(apiErrorResponseSchema.parse(response.body).errorCode).toBe('VALIDATION_ERROR')
	})

	it('returns the best, the points and the history of an own exercise', async () => {
		await start()
		const owner = await registerUser('owner@kus.app')
		const exercises = await seedExercises(owner.userId)
		const workout = await seedWorkout(owner.userId, exercises)

		const response = await owner.agent
			.get(`${EXERCISES_URL}/${exercises.bench.id}`)
			.query({ period: 'month' })
			.expect(200)

		const { data } = exerciseResponse.parse(response.body)
		expect(data.exercise).toMatchObject({
			id: exercises.bench.id,
			name: 'Жим лежачи',
			kind: 'STRENGTH',
			isBodyweight: false,
		})
		expect(data.best.topSet).toEqual({ weightKg: 85, reps: 6, localDate: today })
		expect(data.best.maxSessionReps).toBeNull()
		expect(data.points).toEqual([
			{ localDate: today, workoutId: workout.id, topWeightKg: 85, maxReps: 6 },
		])
		expect(data.history).toHaveLength(1)
		// the warm-up is shown in the history, and only there
		expect(data.history[0]?.sets.map((set) => set.isWarmup)).toEqual([true, false, false])
	})

	it("answers 404 EXERCISE_NOT_FOUND for another user's exercise", async () => {
		await start()
		const owner = await registerUser('owner@kus.app')
		const stranger = await registerUser('stranger@kus.app')
		const exercises = await seedExercises(owner.userId)
		await seedWorkout(owner.userId, exercises)

		const response = await stranger.agent
			.get(`${EXERCISES_URL}/${exercises.bench.id}`)
			.query({ period: 'month' })
			.expect(404)

		expect(apiErrorResponseSchema.parse(response.body).errorCode).toBe('EXERCISE_NOT_FOUND')
	})

	it('answers 404 for an unknown or deleted exercise', async () => {
		await start()
		const owner = await registerUser('owner@kus.app')
		const { bench } = await seedExercises(owner.userId)
		await prisma.exercise.update({ where: { id: bench.id }, data: { deletedAt: new Date() } })

		await owner.agent.get(`${EXERCISES_URL}/${UNKNOWN_ID}`).query({ period: 'month' }).expect(404)
		await owner.agent.get(`${EXERCISES_URL}/${bench.id}`).query({ period: 'month' }).expect(404)
	})

	it('rejects an exercise id that is not a uuid with VALIDATION_ERROR', async () => {
		await start()
		const owner = await registerUser('owner@kus.app')

		const response = await owner.agent
			.get(`${EXERCISES_URL}/not-a-uuid`)
			.query({ period: 'month' })
			.expect(422)

		expect(apiErrorResponseSchema.parse(response.body).errorCode).toBe('VALIDATION_ERROR')
	})

	it('answers 401 without a session', async () => {
		await start()

		await request(app.getHttpServer()).get(STATS_URL).query({ period: 'month' }).expect(401)
		await request(app.getHttpServer())
			.get(`${EXERCISES_URL}/${UNKNOWN_ID}`)
			.query({ period: 'month' })
			.expect(401)
	})
})
