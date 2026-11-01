import { randomUUID } from 'node:crypto'

import { Logger } from '@nestjs/common'
import type { NestExpressApplication } from '@nestjs/platform-express'
import {
	apiErrorResponseSchema,
	authSessionResponseSchema,
	createDataResponseSchema,
	type ProgramDraft,
	programResponseSchema,
	programVersionListResponseSchema,
	type TemplateExerciseDraft,
	type TemplateExerciseTarget,
} from '@kus/shared'
import request from 'supertest'
import type TestAgent from 'supertest/lib/agent'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { addDays } from '../src/common/time'
import { AccountPurgeService } from '../src/modules/account/account-purge.service'
import { ProgramsService } from '../src/modules/programs/programs.service'
import type { PrismaService } from '../src/prisma'
import { createDbTestApp } from './create-db-test-app'

const PROGRAMS_URL = '/api/v1/programs/active'
const UNKNOWN_ID = '0199b3a4-0000-7000-8000-000000000001'
const NOW = new Date('2026-10-27T17:30:00Z')

const oneResponse = createDataResponseSchema(programResponseSchema)
const nullableResponse = createDataResponseSchema(programResponseSchema.nullable())
const versionsResponse = createDataResponseSchema(programVersionListResponseSchema)
const errorResponse = apiErrorResponseSchema

const target = (partial: Partial<TemplateExerciseTarget> = {}): TemplateExerciseTarget => ({
	sets: 3,
	repsMin: 8,
	repsMax: 12,
	weightKg: 60,
	progressStepKg: null,
	restSec: null,
	durationMin: null,
	distanceM: null,
	...partial,
})

const bench: TemplateExerciseDraft = {
	name: 'Жим лежачи',
	exerciseId: null,
	kind: 'STRENGTH',
	muscleGroup: 'CHEST',
	target: target(),
}
const pullUps: TemplateExerciseDraft = {
	name: 'Підтягування',
	exerciseId: null,
	kind: 'STRENGTH',
	muscleGroup: 'BACK',
	target: target({ weightKg: null }),
}
const squat: TemplateExerciseDraft = {
	name: 'Присідання',
	exerciseId: null,
	kind: 'STRENGTH',
	muscleGroup: 'LEGS',
	target: target({ weightKg: 80 }),
}
const run: TemplateExerciseDraft = {
	name: 'Біг',
	exerciseId: null,
	kind: 'CARDIO',
	muscleGroup: null,
	target: target({ sets: null, repsMin: null, repsMax: null, weightKg: null, durationMin: 20 }),
}

const KEY_A = randomUUID()
const KEY_B = randomUUID()

const makeDraft = (): ProgramDraft => ({
	title: 'Все тіло',
	mode: 'ROTATE',
	perWeek: 3,
	templates: [
		{
			key: KEY_A,
			name: 'Тренування А',
			weekdays: [1],
			exercises: [bench, pullUps],
			estimatedMin: 0,
		},
		{ key: KEY_B, name: 'Тренування Б', weekdays: [], exercises: [squat, run], estimatedMin: 0 },
	],
})

describe('programs (e2e, real DB)', () => {
	let app: NestExpressApplication
	let prisma: PrismaService
	vi.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined)

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

	const seedProgram = (userId: string, draft = makeDraft()) =>
		app
			.get(ProgramsService)
			.createVersion(userId, { draft, baseVersionId: null, sourceMessageId: null })

	const getProgram = async (agent: TestAgent) =>
		oneResponse.parse((await agent.get(PROGRAMS_URL).expect(200)).body).data

	/** The template editor's body for a template of the program as it is now. */
	const saveBody = (
		program: Awaited<ReturnType<typeof getProgram>>,
		templateIndex: number,
		exercises: TemplateExerciseDraft[],
	) => ({
		baseVersionId: program.version.id,
		templateId: program.templates[templateIndex]?.id,
		exercises,
	})

	afterEach(async () => {
		await app.close()
	})

	it('answers 401 without a session', async () => {
		await start()

		await request(app.getHttpServer()).get(PROGRAMS_URL).expect(401)
		await request(app.getHttpServer()).get(`${PROGRAMS_URL}/versions`).expect(401)
		await request(app.getHttpServer()).patch(PROGRAMS_URL).send({ mode: 'SINGLE' }).expect(401)
		await request(app.getHttpServer()).delete(PROGRAMS_URL).expect(401)
	})

	it('returns data null while the user has no program, and 404 for its versions', async () => {
		await start()
		const owner = await registerUser('owner@kus.app')

		const response = await owner.agent.get(PROGRAMS_URL).expect(200)

		expect(nullableResponse.parse(response.body).data).toBeNull()
		const missing = await owner.agent.get(`${PROGRAMS_URL}/versions`).expect(404)
		expect(errorResponse.parse(missing.body).errorCode).toBe('PROGRAM_NOT_FOUND')
	})

	it('returns the program with defaults, estimates, groups, «next» and one initial version', async () => {
		await start()
		const owner = await registerUser('owner@kus.app')
		await seedProgram(owner.userId)

		const program = await getProgram(owner.agent)

		expect(program).toMatchObject({ title: 'Все тіло', mode: 'ROTATE', perWeek: 3 })
		const [first, second] = program.templates
		expect(first?.name).toBe('Тренування А')
		expect(first?.muscleGroups).toEqual(['CHEST', 'BACK'])
		expect(first?.hasCardio).toBe(false)
		expect(first?.estimatedMin).toBeGreaterThan(0)
		// barbell exercise: step and rest defaults; bodyweight: no step
		expect(first?.exercises[0]?.target).toMatchObject({ progressStepKg: 2.5, restSec: 90 })
		expect(first?.exercises[1]?.target).toMatchObject({ progressStepKg: null, restSec: 90 })
		expect(first?.exercises[0]?.exerciseId).not.toBeNull()
		expect(second?.hasCardio).toBe(true)
		expect(second?.muscleGroups).toEqual(['LEGS'])
		expect(second?.exercises[1]?.target).toMatchObject({ progressStepKg: null, restSec: null })
		expect(program.next).toEqual({
			templateId: first?.id,
			weekday: null,
			date: null,
			isToday: false,
		})
		const versions = versionsResponse.parse(
			(await owner.agent.get(`${PROGRAMS_URL}/versions`).expect(200)).body,
		).data
		expect(versions).toHaveLength(1)
		expect(versions[0]).toMatchObject({ isCurrent: true, changes: { initial: true } })
	})

	it('shows the sets of the last time and moves «next» after a workout by a template', async () => {
		await start()
		const owner = await registerUser('owner@kus.app')
		await seedProgram(owner.userId)
		const before = await getProgram(owner.agent)
		const [first, second] = before.templates
		const benchId = first?.exercises[0]?.exerciseId
		expect(benchId).toBeTruthy()
		const workout = await prisma.workout.create({
			data: {
				userId: owner.userId,
				localDate: new Date('2026-10-27T00:00:00Z'),
				templateId: first?.id,
			},
		})
		const entry = await prisma.exerciseEntry.create({
			data: {
				userId: owner.userId,
				workoutId: workout.id,
				exerciseId: benchId,
				name: 'Жим лежачи',
				kind: 'STRENGTH',
				source: 'MANUAL',
				performedAt: NOW,
				localDate: new Date('2026-10-27T00:00:00Z'),
			},
		})
		await prisma.exerciseSet.createMany({
			data: [
				{ userId: owner.userId, exerciseEntryId: entry.id, position: 0, reps: 10, weightKg: 57.5 },
				{ userId: owner.userId, exerciseEntryId: entry.id, position: 1, reps: 8, weightKg: 60 },
			],
		})

		const program = await getProgram(owner.agent)

		expect(program.templates[0]?.exercises[0]?.lastSets).toEqual([
			{ reps: 10, weightKg: 57.5, isWarmup: false },
			{ reps: 8, weightKg: 60, isWarmup: false },
		])
		expect(program.templates[0]?.exercises[0]?.lastPerformedAt).toBe(NOW.toISOString())
		expect(program.templates[0]?.exercises[1]?.lastSets).toBeNull()
		expect(program.next?.templateId).toBe(second?.id)
	})

	describe('PATCH settings', () => {
		it('changes mode and perWeek in place without a new version', async () => {
			await start()
			const owner = await registerUser('owner@kus.app')
			await seedProgram(owner.userId)
			const before = await getProgram(owner.agent)

			const response = await owner.agent
				.patch(PROGRAMS_URL)
				.send({ mode: 'WEEKDAYS', perWeek: 4 })
				.expect(200)

			const program = oneResponse.parse(response.body).data
			expect(program).toMatchObject({ mode: 'WEEKDAYS', perWeek: 4 })
			expect(program.version.id).toBe(before.version.id)
			expect(await prisma.programVersion.count()).toBe(1)
			// WEEKDAYS: A is planned on Mondays
			expect(program.next?.templateId).toBe(program.templates[0]?.id)
			expect(program.next?.weekday).toBe(1)
		})

		it('pins the current «next» when the mode becomes SINGLE without a pin', async () => {
			await start()
			const owner = await registerUser('owner@kus.app')
			await seedProgram(owner.userId)

			const response = await owner.agent.patch(PROGRAMS_URL).send({ mode: 'SINGLE' }).expect(200)

			const program = oneResponse.parse(response.body).data
			expect(program.pinnedTemplateId).toBe(program.templates[0]?.id)
			expect(program.next?.templateId).toBe(program.templates[0]?.id)
		})

		it('pins the template asked for and clears the pin with null', async () => {
			await start()
			const owner = await registerUser('owner@kus.app')
			await seedProgram(owner.userId)
			const before = await getProgram(owner.agent)
			const second = before.templates[1]

			const pinned = await owner.agent
				.patch(PROGRAMS_URL)
				.send({ mode: 'SINGLE', pinnedTemplateId: second?.id })
				.expect(200)
			expect(oneResponse.parse(pinned.body).data.next?.templateId).toBe(second?.id)

			const cleared = await owner.agent
				.patch(PROGRAMS_URL)
				.send({ mode: 'ROTATE', pinnedTemplateId: null })
				.expect(200)
			expect(oneResponse.parse(cleared.body).data.pinnedTemplateId).toBeNull()
		})

		it('rejects a template of another user or version (404) and an empty body (422)', async () => {
			await start()
			const owner = await registerUser('owner@kus.app')
			const stranger = await registerUser('stranger@kus.app')
			await seedProgram(owner.userId)
			await seedProgram(stranger.userId)
			const foreign = (await getProgram(stranger.agent)).templates[0]

			const response = await owner.agent
				.patch(PROGRAMS_URL)
				.send({ pinnedTemplateId: foreign?.id })
				.expect(404)
			expect(errorResponse.parse(response.body).errorCode).toBe('PROGRAM_TEMPLATE_NOT_FOUND')
			await owner.agent.patch(PROGRAMS_URL).send({}).expect(422)
			await owner.agent.patch(PROGRAMS_URL).send({ mode: 'DAILY' }).expect(422)
		})

		it('answers 404 when the user has no program', async () => {
			await start()
			const owner = await registerUser('owner@kus.app')

			const response = await owner.agent.patch(PROGRAMS_URL).send({ mode: 'SINGLE' }).expect(404)

			expect(errorResponse.parse(response.body).errorCode).toBe('PROGRAM_NOT_FOUND')
		})
	})

	describe('PATCH template weekdays', () => {
		it('sets the weekdays in place without a new version', async () => {
			await start()
			const owner = await registerUser('owner@kus.app')
			await seedProgram(owner.userId)
			const before = await getProgram(owner.agent)
			const second = before.templates[1]

			const response = await owner.agent
				.patch(`${PROGRAMS_URL}/templates/${second?.id}`)
				.send({ weekdays: [5, 3] })
				.expect(200)

			const program = oneResponse.parse(response.body).data
			expect(program.templates[1]?.weekdays).toEqual([3, 5])
			expect(program.version.id).toBe(before.version.id)
			expect(await prisma.programVersion.count()).toBe(1)
		})

		it('answers 404 for a template of another user and 422 for a wrong weekday', async () => {
			await start()
			const owner = await registerUser('owner@kus.app')
			const stranger = await registerUser('stranger@kus.app')
			await seedProgram(owner.userId)
			await seedProgram(stranger.userId)
			const foreign = (await getProgram(stranger.agent)).templates[0]
			const own = (await getProgram(owner.agent)).templates[0]

			const response = await owner.agent
				.patch(`${PROGRAMS_URL}/templates/${foreign?.id}`)
				.send({ weekdays: [2] })
				.expect(404)
			expect(errorResponse.parse(response.body).errorCode).toBe('PROGRAM_TEMPLATE_NOT_FOUND')
			await owner.agent
				.patch(`${PROGRAMS_URL}/templates/${own?.id}`)
				.send({ weekdays: [8] })
				.expect(422)
			await owner.agent
				.patch(`${PROGRAMS_URL}/templates/${UNKNOWN_ID}`)
				.send({ weekdays: [2] })
				.expect(404)
			expect((await getProgram(stranger.agent)).templates[0]?.weekdays).toEqual([1])
		})
	})

	describe('POST versions («Готово»)', () => {
		it('makes a new version with the template replaced, keeps the others and re-binds the pin', async () => {
			await start()
			const owner = await registerUser('owner@kus.app')
			await seedProgram(owner.userId)
			const initial = await getProgram(owner.agent)
			const pinResponse = await owner.agent
				.patch(PROGRAMS_URL)
				.send({ mode: 'SINGLE', pinnedTemplateId: initial.templates[0]?.id })
				.expect(200)
			const before = oneResponse.parse(pinResponse.body).data
			const [first] = before.templates
			const reordered = [
				{ ...pullUps, exerciseId: first?.exercises[1]?.exerciseId ?? null },
				{
					...bench,
					exerciseId: first?.exercises[0]?.exerciseId ?? null,
					target: target({ sets: 4, weightKg: 62.5 }),
				},
			]

			const response = await owner.agent
				.post(`${PROGRAMS_URL}/versions`)
				.send(saveBody(before, 0, reordered))
				.expect(201)

			const program = oneResponse.parse(response.body).data
			expect(program.version.id).not.toBe(before.version.id)
			expect(program.templates.map((template) => template.key)).toEqual(
				before.templates.map((template) => template.key),
			)
			expect(program.templates[0]?.id).not.toBe(first?.id)
			expect(program.templates[0]?.exercises.map((exercise) => exercise.name)).toEqual([
				'Підтягування',
				'Жим лежачи',
			])
			expect(program.templates[0]?.exercises[1]?.target).toMatchObject({
				sets: 4,
				weightKg: 62.5,
				progressStepKg: 2.5,
			})
			expect(program.templates[1]?.exercises.map((exercise) => exercise.name)).toEqual([
				'Присідання',
				'Біг',
			])
			// the pin follows the template by key
			expect(program.pinnedTemplateId).toBe(program.templates[0]?.id)
			expect(program.mode).toBe('SINGLE')

			const versions = versionsResponse.parse(
				(await owner.agent.get(`${PROGRAMS_URL}/versions`).expect(200)).body,
			).data
			expect(versions.map((version) => [version.id, version.isCurrent])).toEqual([
				[program.version.id, true],
				[before.version.id, false],
			])
			const lines = versions[0]?.changes.lines ?? []
			expect(lines.map((line) => line.op)).toEqual(expect.arrayContaining(['CHANGE', 'REORDER']))
			expect(versions[0]?.changes).toMatchObject({ initial: false, unchangedTemplates: 1 })
		})

		it('does not duplicate dictionary exercises and adds a new one by name', async () => {
			await start()
			const owner = await registerUser('owner@kus.app')
			await seedProgram(owner.userId)
			const before = await getProgram(owner.agent)
			const withNew = [bench, { ...squat, name: 'Жим гантелей' }]

			await owner.agent
				.post(`${PROGRAMS_URL}/versions`)
				.send(saveBody(before, 0, withNew))
				.expect(201)

			const names = (await prisma.exercise.findMany({ where: { userId: owner.userId } })).map(
				(exercise) => exercise.name,
			)
			expect(names.filter((name) => name === 'Жим лежачи')).toHaveLength(1)
			expect(names).toContain('Жим гантелей')
		})

		it('answers 409 with the active version when the base is stale', async () => {
			await start()
			const owner = await registerUser('owner@kus.app')
			await seedProgram(owner.userId)
			const stale = await getProgram(owner.agent)
			await owner.agent
				.post(`${PROGRAMS_URL}/versions`)
				.send(saveBody(stale, 0, [bench]))
				.expect(201)
			const current = await getProgram(owner.agent)

			const response = await owner.agent
				.post(`${PROGRAMS_URL}/versions`)
				.send(saveBody(stale, 0, [pullUps]))
				.expect(409)

			const body = errorResponse.parse(response.body)
			expect(body.errorCode).toBe('PROGRAM_VERSION_CONFLICT')
			expect(body.details).toEqual({ activeVersionId: current.version.id })
			expect(await prisma.programVersion.count()).toBe(2)
		})

		it('lets one of two saves from the same base win and rolls the other back', async () => {
			await start()
			const owner = await registerUser('owner@kus.app')
			await seedProgram(owner.userId)
			const base = await getProgram(owner.agent)

			const responses = await Promise.all([
				owner.agent.post(`${PROGRAMS_URL}/versions`).send(saveBody(base, 0, [bench])),
				owner.agent.post(`${PROGRAMS_URL}/versions`).send(saveBody(base, 1, [squat])),
			])

			expect(responses.map((response) => response.status).sort()).toEqual([201, 409])
			expect(await prisma.programVersion.count()).toBe(2)
			expect(await prisma.workoutTemplate.count()).toBe(4)
			const versions = versionsResponse.parse(
				(await owner.agent.get(`${PROGRAMS_URL}/versions`).expect(200)).body,
			).data
			expect(versions.filter((version) => version.isCurrent)).toHaveLength(1)
		})

		it('answers 404 for a template that is not in the active version, 422 for a bad body', async () => {
			await start()
			const owner = await registerUser('owner@kus.app')
			const stranger = await registerUser('stranger@kus.app')
			await seedProgram(owner.userId)
			await seedProgram(stranger.userId)
			const own = await getProgram(owner.agent)
			const foreign = (await getProgram(stranger.agent)).templates[0]

			const response = await owner.agent
				.post(`${PROGRAMS_URL}/versions`)
				.send({ ...saveBody(own, 0, [bench]), templateId: foreign?.id })
				.expect(404)
			expect(errorResponse.parse(response.body).errorCode).toBe('PROGRAM_TEMPLATE_NOT_FOUND')
			await owner.agent
				.post(`${PROGRAMS_URL}/versions`)
				.send({ ...saveBody(own, 0, [bench]), baseVersionId: 'nope' })
				.expect(422)
			await owner.agent
				.post(`${PROGRAMS_URL}/versions`)
				.send(
					saveBody(
						own,
						0,
						Array.from({ length: 16 }, () => bench),
					),
				)
				.expect(422)
			expect(await prisma.programVersion.count()).toBe(2)
		})

		it('does not let a foreign dictionary exercise id in', async () => {
			await start()
			const owner = await registerUser('owner@kus.app')
			const stranger = await registerUser('stranger@kus.app')
			await seedProgram(owner.userId)
			const foreignExercise = await prisma.exercise.create({
				data: {
					userId: stranger.userId,
					name: 'Чужа вправа',
					nameNormalized: 'чужа вправа',
					kind: 'STRENGTH',
					aliases: [],
				},
			})
			const own = await getProgram(owner.agent)

			const response = await owner.agent
				.post(`${PROGRAMS_URL}/versions`)
				.send(saveBody(own, 0, [{ ...bench, name: 'Своя вправа', exerciseId: foreignExercise.id }]))
				.expect(201)

			const [exercise] = oneResponse.parse(response.body).data.templates[0]?.exercises ?? []
			expect(exercise?.exerciseId).not.toBe(foreignExercise.id)
			expect(exercise?.name).toBe('Своя вправа')
		})
	})

	describe('isolation and removal', () => {
		it('shows another user no program and no versions', async () => {
			await start()
			const owner = await registerUser('owner@kus.app')
			const stranger = await registerUser('stranger@kus.app')
			await seedProgram(owner.userId)

			const response = await stranger.agent.get(PROGRAMS_URL).expect(200)

			expect(nullableResponse.parse(response.body).data).toBeNull()
			await stranger.agent.get(`${PROGRAMS_URL}/versions`).expect(404)
			await stranger.agent.delete(PROGRAMS_URL).expect(404)
			expect(await getProgram(owner.agent)).toBeTruthy()
		})

		it('removes the program softly and leaves the workout history alone', async () => {
			await start()
			const owner = await registerUser('owner@kus.app')
			await seedProgram(owner.userId)
			const program = await getProgram(owner.agent)
			const workout = await prisma.workout.create({
				data: {
					userId: owner.userId,
					localDate: new Date('2026-10-27T00:00:00Z'),
					templateId: program.templates[0]?.id,
				},
			})

			await owner.agent.delete(PROGRAMS_URL).expect(204)

			const response = await owner.agent.get(PROGRAMS_URL).expect(200)
			expect(nullableResponse.parse(response.body).data).toBeNull()
			await owner.agent.delete(PROGRAMS_URL).expect(404)
			const stored = await prisma.workout.findUniqueOrThrow({ where: { id: workout.id } })
			expect(stored).toMatchObject({ deletedAt: null, templateId: program.templates[0]?.id })
			expect(await prisma.workoutProgram.count({ where: { deletedAt: { not: null } } })).toBe(1)
			// a new program can be made after the removal
			await seedProgram(owner.userId)
			expect((await getProgram(owner.agent)).id).not.toBe(program.id)
		})

		it('purges an account whose program has two versions', async () => {
			await start()
			const owner = await registerUser('owner@kus.app')
			const neighbour = await registerUser('neighbour@kus.app')
			await seedProgram(owner.userId)
			await seedProgram(neighbour.userId)
			const base = await getProgram(owner.agent)
			await owner.agent
				.post(`${PROGRAMS_URL}/versions`)
				.send(saveBody(base, 0, [bench]))
				.expect(201)
			await prisma.user.update({
				where: { id: owner.userId },
				data: { deletionRequestedAt: addDays(new Date(), -31), purgeAt: addDays(new Date(), -1) },
			})

			const purged = await app.get(AccountPurgeService).purgeExpired(new Date())

			expect(purged).toBe(1)
			expect(await prisma.user.count({ where: { id: owner.userId } })).toBe(0)
			expect(await prisma.workoutProgram.count({ where: { userId: owner.userId } })).toBe(0)
			expect(await prisma.programVersion.count({ where: { userId: owner.userId } })).toBe(0)
			expect(await prisma.workoutTemplate.count({ where: { userId: owner.userId } })).toBe(0)
			expect(await prisma.templateExercise.count()).toBeGreaterThan(0)
			expect((await getProgram(neighbour.agent)).templates).toHaveLength(2)
		})
	})
})
