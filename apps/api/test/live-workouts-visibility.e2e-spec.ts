import { Logger } from '@nestjs/common'
import type { NestExpressApplication } from '@nestjs/platform-express'
import {
	createDataResponseSchema,
	exerciseDictionaryResponseSchema,
	exerciseStatsResponseSchema,
	liveWorkoutResponseSchema,
	programResponseSchema,
	workoutResponseSchema,
	workoutStatsResponseSchema,
} from '@kus/shared'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { z } from 'zod'

import { WorkoutsService } from '../src/modules/workouts/workouts.service'
import type { PrismaService } from '../src/prisma'
import { createDbTestApp } from './create-db-test-app'
import {
	LIVE_URL,
	liveExercise,
	liveSet,
	registerUser,
	seedProgram,
	type TestUser,
} from './workout-logging-test-utils'

const WORKOUTS_URL = '/api/v1/workouts'
const PROGRAM_URL = '/api/v1/programs/active'

const liveResponse = createDataResponseSchema(liveWorkoutResponseSchema)
const listResponse = createDataResponseSchema(z.array(workoutResponseSchema))
const statsResponse = createDataResponseSchema(workoutStatsResponseSchema)
const dictionaryResponse = createDataResponseSchema(exerciseDictionaryResponseSchema)
const exerciseStats = createDataResponseSchema(exerciseStatsResponseSchema)
const programResponse = createDataResponseSchema(programResponseSchema)

describe('open live session visibility, template IDOR and kcal (e2e, real DB)', () => {
	let app: NestExpressApplication
	let prisma: PrismaService
	vi.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined)

	const start = async (): Promise<void> => {
		;({ app, prisma } = await createDbTestApp())
	}

	const user = (email: string): Promise<TestUser> => registerUser(app, email)

	const startLive = async (who: TestUser, templateId: string | null = null) =>
		liveResponse.parse((await who.agent.post(LIVE_URL).send({ templateId }).expect(201)).body).data

	const put = (who: TestUser, id: string, exercises: unknown[]) =>
		who.agent.put(`${LIVE_URL}/${id}`).send({ knownEditedAt: null, exercises })

	afterEach(async () => {
		await app.close()
	})

	it('hides an open session from the journal, the day, the stats, the history and the program queue, until it is finished', async () => {
		await start()
		const owner = await user('owner@kus.app')
		const program = await seedProgram(app, owner)
		const [templateA, templateB] = program.templates
		const benchTemplateExercise = templateA?.exercises[0]
		const { workout } = await startLive(owner, templateA?.id ?? null)
		const saved = await put(owner, workout.id, [
			liveExercise({ templateExerciseId: benchTemplateExercise?.id }),
		]).expect(200)
		const exerciseId = (
			await prisma.exerciseEntry.findFirstOrThrow({ where: { workoutId: workout.id } })
		).exerciseId
		expect(saved.status).toBe(200)
		const day = workout.localDate

		// while it is going on: nowhere
		const range = await owner.agent.get(`${WORKOUTS_URL}?from=${day}&to=${day}`).expect(200)
		expect(listResponse.parse(range.body).data).toEqual([])
		const ofDay = await owner.agent.get(`${WORKOUTS_URL}/day/${day}`).expect(200)
		expect(listResponse.parse(ofDay.body).data).toEqual([])
		const stats = await owner.agent.get(`${WORKOUTS_URL}/stats?period=week`).expect(200)
		expect(statsResponse.parse(stats.body).data.overview.workoutCount).toBe(0)
		const dictionary = await owner.agent.get(`${WORKOUTS_URL}/exercises`).expect(200)
		const bench = dictionaryResponse
			.parse(dictionary.body)
			.data.find((item) => item.id === exerciseId)
		expect(bench?.lastSets ?? null).toBeNull()
		const history = await owner.agent
			.get(`${WORKOUTS_URL}/exercises/${exerciseId}?period=week`)
			.expect(200)
		expect(exerciseStats.parse(history.body).data.best.topSet).toBeNull()
		expect(exerciseStats.parse(history.body).data.points).toEqual([])
		const queue = programResponse.parse((await owner.agent.get(PROGRAM_URL).expect(200)).body).data
		expect(queue.next?.templateId).toBe(templateA?.id)
		expect(queue.templates[0]?.exercises[0]?.lastSets).toBeNull()
		// its own screen still has it
		const current = await owner.agent.get(`${LIVE_URL}/current`).expect(200)
		expect(liveResponse.parse(current.body).data.workout.id).toBe(workout.id)

		await owner.agent.post(`${LIVE_URL}/${workout.id}/finish`).expect(200)

		// finished: everywhere
		const rangeAfter = await owner.agent.get(`${WORKOUTS_URL}?from=${day}&to=${day}`).expect(200)
		expect(listResponse.parse(rangeAfter.body).data.map(({ id }) => id)).toEqual([workout.id])
		const dayAfter = await owner.agent.get(`${WORKOUTS_URL}/day/${day}`).expect(200)
		expect(listResponse.parse(dayAfter.body).data).toHaveLength(1)
		const statsAfter = await owner.agent.get(`${WORKOUTS_URL}/stats?period=week`).expect(200)
		expect(statsResponse.parse(statsAfter.body).data.overview.workoutCount).toBe(1)
		const dictionaryAfter = await owner.agent.get(`${WORKOUTS_URL}/exercises`).expect(200)
		const benchAfter = dictionaryResponse
			.parse(dictionaryAfter.body)
			.data.find((item) => item.id === exerciseId)
		expect(benchAfter?.lastSets).not.toBeNull()
		const historyAfter = await owner.agent
			.get(`${WORKOUTS_URL}/exercises/${exerciseId}?period=week`)
			.expect(200)
		expect(exerciseStats.parse(historyAfter.body).data.points).toHaveLength(1)
		const queueAfter = programResponse.parse(
			(await owner.agent.get(PROGRAM_URL).expect(200)).body,
		).data
		expect(queueAfter.next?.templateId).toBe(templateB?.id)
	})

	it('restore does not bring a discarded open session back (it would be a second open one)', async () => {
		await start()
		const owner = await user('owner@kus.app')
		const { workout } = await startLive(owner)
		await put(owner, workout.id, [liveExercise()]).expect(200)
		await owner.agent.delete(`${LIVE_URL}/${workout.id}`).expect(204)
		const second = await startLive(owner)

		// restore is idempotent: it answers the workout as it is, still deleted
		const restored = await owner.agent.post(`${WORKOUTS_URL}/${workout.id}/restore`).expect(200)
		expect(workoutResponseSchema.parse((restored.body as { data: unknown }).data).isDeleted).toBe(
			true,
		)

		const current = await owner.agent.get(`${LIVE_URL}/current`).expect(200)
		expect(liveResponse.parse(current.body).data.workout.id).toBe(second.workout.id)
		const row = await prisma.workout.findUniqueOrThrow({ where: { id: workout.id } })
		expect(row.deletedAt).not.toBeNull()
	})

	it('an open live session is not counted as a workout (onboarding «the first workout»); a finished one is', async () => {
		await start()
		const owner = await user('owner@kus.app')
		const workouts = app.get(WorkoutsService)
		const { workout } = await startLive(owner)
		await put(owner, workout.id, [liveExercise()]).expect(200)

		expect(await workouts.hasOnlyOneWorkout(owner.userId)).toBe(false)

		await owner.agent.post(`${LIVE_URL}/${workout.id}/finish`).expect(200)
		expect(await workouts.hasOnlyOneWorkout(owner.userId)).toBe(true)

		// a second, still open session next to one finished workout changes nothing
		const second = await startLive(owner)
		await put(owner, second.workout.id, [liveExercise()]).expect(200)
		expect(await workouts.hasOnlyOneWorkout(owner.userId)).toBe(true)
		await owner.agent.post(`${LIVE_URL}/${second.workout.id}/finish`).expect(200)
		expect(await workouts.hasOnlyOneWorkout(owner.userId)).toBe(false)
	})

	describe('templates (IDOR)', () => {
		it("refuses to start by another user's template and by an unknown one (404)", async () => {
			await start()
			const owner = await user('owner@kus.app')
			const stranger = await user('stranger@kus.app')
			const theirs = await seedProgram(app, stranger)

			const foreign = await owner.agent
				.post(LIVE_URL)
				.send({ templateId: theirs.templates[0]?.id })
				.expect(404)

			expect(foreign.body).toMatchObject({ errorCode: 'PROGRAM_TEMPLATE_NOT_FOUND' })
			await owner.agent
				.post(LIVE_URL)
				.send({ templateId: '0199b3a4-0000-7000-8000-000000000001' })
				.expect(404)
			expect(await prisma.workout.count({ where: { userId: owner.userId } })).toBe(0)
		})

		it("a template exercise of another template or another user's is 404 and writes nothing", async () => {
			await start()
			const owner = await user('owner@kus.app')
			const stranger = await user('stranger@kus.app')
			const mine = await seedProgram(app, owner)
			const theirs = await seedProgram(app, stranger)
			const [templateA, templateB] = mine.templates
			const { workout } = await startLive(owner, templateA?.id ?? null)

			const otherTemplate = await put(owner, workout.id, [
				liveExercise({ templateExerciseId: templateB?.exercises[0]?.id }),
			]).expect(404)
			const otherUser = await put(owner, workout.id, [
				liveExercise({ templateExerciseId: theirs.templates[0]?.exercises[0]?.id }),
			]).expect(404)

			expect(otherTemplate.body).toMatchObject({ errorCode: 'PROGRAM_TEMPLATE_NOT_FOUND' })
			expect(otherUser.body).toMatchObject({ errorCode: 'PROGRAM_TEMPLATE_NOT_FOUND' })
			expect(await prisma.exerciseEntry.count({ where: { workoutId: workout.id } })).toBe(0)
		})

		it('a session without a template accepts no template exercise at all', async () => {
			await start()
			const owner = await user('owner@kus.app')
			const mine = await seedProgram(app, owner)
			const { workout } = await startLive(owner)

			await put(owner, workout.id, [
				liveExercise({ templateExerciseId: mine.templates[0]?.exercises[0]?.id }),
			]).expect(404)
		})

		it('a template exercise of the session template is stored on the entry', async () => {
			await start()
			const owner = await user('owner@kus.app')
			const mine = await seedProgram(app, owner)
			const template = mine.templates[0]
			const { workout, plan, templateName } = await startLive(owner, template?.id ?? null)

			const response = await put(owner, workout.id, [
				liveExercise({ templateExerciseId: template?.exercises[1]?.id }),
			]).expect(200)

			expect(templateName).toBe('Верх A')
			expect(plan.map((exercise) => exercise.templateExerciseId)).toEqual(
				template?.exercises.map(({ id }) => id),
			)
			expect(liveResponse.parse(response.body).data.workout.exercises[0]?.templateExerciseId).toBe(
				template?.exercises[1]?.id,
			)
		})

		it("current never returns another user's session or plan", async () => {
			await start()
			const owner = await user('owner@kus.app')
			const stranger = await user('stranger@kus.app')
			const theirs = await seedProgram(app, stranger)
			await startLive(stranger, theirs.templates[0]?.id ?? null)

			const response = await owner.agent.get(`${LIVE_URL}/current`).expect(200)

			expect(response.body).toEqual({ data: null })
		})
	})

	describe('kcal estimate', () => {
		it('is filled when the user has a body weight and null otherwise', async () => {
			await start()
			const owner = await user('owner@kus.app')
			const { workout } = await startLive(owner)
			const withoutWeight = await put(owner, workout.id, [liveExercise()]).expect(200)
			expect(liveResponse.parse(withoutWeight.body).data.workout.kcal).toBeNull()
			await prisma.measurement.create({
				data: {
					userId: owner.userId,
					kind: 'WEIGHT',
					value: 80,
					localDate: new Date(`${workout.localDate}T00:00:00Z`),
					measuredAt: new Date(),
					source: 'PROFILE',
				},
			})

			const response = await put(owner, workout.id, [liveExercise()]).expect(200)

			const { kcal } = liveResponse.parse(response.body).data.workout
			expect(kcal?.source).toBe('ESTIMATE')
			expect(kcal?.value).toBeGreaterThan(0)
		})

		it("never uses another user's body weight", async () => {
			await start()
			const owner = await user('owner@kus.app')
			const stranger = await user('stranger@kus.app')
			const { workout } = await startLive(owner)
			await prisma.measurement.create({
				data: {
					userId: stranger.userId,
					kind: 'WEIGHT',
					value: 80,
					localDate: new Date(`${workout.localDate}T00:00:00Z`),
					measuredAt: new Date(),
					source: 'PROFILE',
				},
			})

			const response = await put(owner, workout.id, [liveExercise()]).expect(200)

			expect(liveResponse.parse(response.body).data.workout.kcal).toBeNull()
		})

		it('is not stored in the workout row (the model never sees it)', async () => {
			await start()
			const owner = await user('owner@kus.app')
			const { workout } = await startLive(owner)
			await prisma.measurement.create({
				data: {
					userId: owner.userId,
					kind: 'WEIGHT',
					value: 80,
					localDate: new Date(`${workout.localDate}T00:00:00Z`),
					measuredAt: new Date(),
					source: 'PROFILE',
				},
			})
			await put(owner, workout.id, [liveExercise({ sets: [liveSet()] })]).expect(200)
			await owner.agent.post(`${LIVE_URL}/${workout.id}/finish`).expect(200)

			const row = await prisma.workout.findUniqueOrThrow({ where: { id: workout.id } })
			expect(row.kcalBurned).toBeNull()
			expect(row.kcalSource).toBeNull()
		})
	})
})
