import { randomUUID } from 'node:crypto'

import type { NestExpressApplication } from '@nestjs/platform-express'
import {
	authSessionResponseSchema,
	createDataResponseSchema,
	type ProgramDraft,
	programResponseSchema,
	type TemplateExerciseDraft,
} from '@kus/shared'
import request from 'supertest'
import type TestAgent from 'supertest/lib/agent'

import { ProgramsService } from '../src/modules/programs/programs.service'

export const LIVE_URL = '/api/v1/live-workouts'
export const FORMS_URL = '/api/v1/workout-forms'
export const MINUTE_MS = 60_000

export interface TestUser {
	agent: TestAgent
	userId: string
}

export const registerUser = async (
	app: NestExpressApplication,
	email: string,
): Promise<TestUser> => {
	const agent = request.agent(app.getHttpServer())
	const response = await agent
		.post('/api/v1/auth/register')
		.send({ email, password: 'correct-horse-battery', name: 'Test', consent: true })
		.expect(201)
	const { user } = createDataResponseSchema(authSessionResponseSchema).parse(response.body).data
	return { agent, userId: user.id }
}

export const minutesAgo = (minutes: number): Date => new Date(Date.now() - minutes * MINUTE_MS)

export const liveSet = (overrides: Record<string, unknown> = {}) => ({
	reps: 8,
	weightKg: 80,
	isWarmup: false,
	doneAt: new Date().toISOString(),
	...overrides,
})

export const liveExercise = (overrides: Record<string, unknown> = {}) => ({
	clientKey: randomUUID(),
	name: 'Жим лежачи',
	kind: 'STRENGTH',
	sets: [liveSet()],
	...overrides,
})

const target = {
	sets: 3,
	repsMin: 8,
	repsMax: 12,
	weightKg: 60,
	progressStepKg: null,
	restSec: null,
	durationMin: null,
	distanceM: null,
}

const templateExercise = (name: string): TemplateExerciseDraft => ({
	name,
	exerciseId: null,
	kind: 'STRENGTH',
	muscleGroup: null,
	target,
})

const makeDraft = (): ProgramDraft => ({
	title: 'Все тіло',
	mode: 'ROTATE',
	perWeek: 3,
	templates: [
		{
			key: randomUUID(),
			name: 'Верх A',
			weekdays: [],
			exercises: [templateExercise('Жим лежачи'), templateExercise('Тяга штанги')],
			estimatedMin: 0,
		},
		{
			key: randomUUID(),
			name: 'Низ B',
			weekdays: [],
			exercises: [templateExercise('Присідання')],
			estimatedMin: 0,
		},
	],
	pinnedKey: null,
})

/** A two-template program of the user; the response carries the template and exercise ids. */
export const seedProgram = async (app: NestExpressApplication, user: TestUser) => {
	await app
		.get(ProgramsService)
		.createVersion(user.userId, { draft: makeDraft(), baseVersionId: null, sourceMessageId: null })
	const response = await user.agent.get('/api/v1/programs/active').expect(200)
	return createDataResponseSchema(programResponseSchema).parse(response.body).data
}
