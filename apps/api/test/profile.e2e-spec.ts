import { Logger } from '@nestjs/common'
import type { NestExpressApplication } from '@nestjs/platform-express'
import {
	apiErrorResponseSchema,
	authSessionResponseSchema,
	createDataResponseSchema,
	dayResponseSchema,
	goalsPreviewResponseSchema,
	profileGoalsSchema,
	profileResponseSchema,
} from '@kus/shared'
import request from 'supertest'
import type TestAgent from 'supertest/lib/agent'
import { afterAll, afterEach, describe, expect, it, vi } from 'vitest'

import { addDays, getLocalDateString } from '../src/common/time'
import { createFakeAiClient } from '../src/modules/ai/ai.test-utils'
import type { PrismaService } from '../src/prisma'
import { createDbTestApp } from './create-db-test-app'

const PROFILE_URL = '/api/v1/profile'
const PREVIEW_URL = '/api/v1/profile/goals/preview'
const GOALS_URL = '/api/v1/profile/goals'
const TIMEZONE = 'Europe/Warsaw'

const profileResponse = createDataResponseSchema(profileResponseSchema)
const previewResponse = createDataResponseSchema(goalsPreviewResponseSchema)
const goalsResponse = createDataResponseSchema(profileGoalsSchema)
const dayResponse = createDataResponseSchema(dayResponseSchema)

/** The design seed («Мої дані»): man, 30, 182 cm, 84 kg → 78 kg, «трохи руху», −0.25 kg/week. */
const SEED = {
	sex: 'MALE',
	age: 30,
	heightCm: 182,
	weightKg: 84,
	targetWeightKg: 78,
	activityLevel: 'LIGHT',
	goalType: 'LOSE',
	paceKgPerWeek: 0.25,
} as const
const SEED_GOALS = { kcal: 2200, proteinG: 140, carbsG: 230, fatG: 80 }

const fake = createFakeAiClient()

interface TestUser {
	agent: TestAgent
	userId: string
}

describe('profile (e2e, real DB)', () => {
	let app: NestExpressApplication
	let prisma: PrismaService
	const logSpies = [
		vi.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined),
		vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined),
	]
	const today = (): string => getLocalDateString(new Date(), TIMEZONE)
	const currentYear = (): number => Number(today().slice(0, 4))

	const start = async (): Promise<void> => {
		fake.reset()
		;({ app, prisma } = await createDbTestApp({ aiClient: fake.client }))
	}

	const registerUser = async (email: string): Promise<TestUser> => {
		const agent = request.agent(app.getHttpServer())
		const response = await agent
			.post('/api/v1/auth/register')
			.send({ email, password: 'correct-horse-battery', name: 'Bohdan', consent: true })
			.expect(201)
		const { user } = createDataResponseSchema(authSessionResponseSchema).parse(response.body).data
		return { agent, userId: user.id }
	}

	afterEach(async () => {
		await app.close()
	})

	afterAll(() => {
		for (const spy of logSpies) spy.mockRestore()
	})

	it('is empty for a new user, apart from the account', async () => {
		await start()
		const owner = await registerUser('owner@kus.app')

		const response = await owner.agent.get(PROFILE_URL).expect(200)

		expect(profileResponse.parse(response.body).data).toEqual({
			email: 'owner@kus.app',
			name: 'Bohdan',
			addressAs: null,
			profile: {
				sex: null,
				age: null,
				heightCm: null,
				activityLevel: null,
				targetWeightKg: null,
				goalType: null,
				paceKgPerWeek: null,
			},
			weight: null,
			goals: null,
		})
	})

	it('saves the fields, stores the age as a birth year and the weight as today’s weigh-in', async () => {
		await start()
		const owner = await registerUser('owner@kus.app')

		const updated = await owner.agent
			.patch(PROFILE_URL)
			.send({ ...SEED, weightKg: 84.26 })
			.expect(200)

		const { profile, weight } = profileResponse.parse(updated.body).data
		expect(profile).toEqual({
			sex: 'MALE',
			age: 30,
			heightCm: 182,
			activityLevel: 'LIGHT',
			targetWeightKg: 78,
			goalType: 'LOSE',
			paceKgPerWeek: 0.25,
		})
		// one decimal, the user's calendar day
		expect(weight).toEqual({ kg: 84.3, localDate: today() })
		const stored = await prisma.userProfile.findUniqueOrThrow({ where: { userId: owner.userId } })
		expect(stored.birthYear).toBe(currentYear() - 30)
		// the age reads back as it was saved
		const read = await owner.agent.get(PROFILE_URL).expect(200)
		expect(profileResponse.parse(read.body).data.profile.age).toBe(30)

		// a second weigh-in the same day rewrites it instead of adding a row
		const again = await owner.agent.patch(PROFILE_URL).send({ weightKg: 82.4 }).expect(200)
		expect(profileResponse.parse(again.body).data.weight).toEqual({
			kg: 82.4,
			localDate: today(),
		})
		expect(await prisma.weightEntry.count({ where: { userId: owner.userId } })).toBe(1)
		// a partial edit leaves the rest alone
		expect(profileResponse.parse(again.body).data.profile.heightCm).toBe(182)
	})

	it('«Тримати вагу» clears the pace', async () => {
		await start()
		const owner = await registerUser('owner@kus.app')
		await owner.agent.patch(PROFILE_URL).send(SEED).expect(200)

		const response = await owner.agent.patch(PROFILE_URL).send({ goalType: 'MAINTAIN' }).expect(200)

		expect(profileResponse.parse(response.body).data.profile).toMatchObject({
			goalType: 'MAINTAIN',
			paceKgPerWeek: null,
		})
		// a pace sent for MAINTAIN is dropped too
		const withPace = await owner.agent.patch(PROFILE_URL).send({ paceKgPerWeek: 0.5 }).expect(200)
		expect(profileResponse.parse(withPace.body).data.profile.paceKgPerWeek).toBeNull()
	})

	it('validates the bounds, the four activity levels and rejects an empty body', async () => {
		await start()
		const owner = await registerUser('owner@kus.app')

		const invalid = await owner.agent
			.patch(PROFILE_URL)
			.send({
				age: 17,
				heightCm: 300,
				weightKg: 20,
				activityLevel: 'VERY_ACTIVE',
				paceKgPerWeek: 1,
			})
			.expect(422)
		expect(apiErrorResponseSchema.parse(invalid.body).details.fields).toEqual({
			age: 'AGE_BELOW_MINIMUM',
			heightCm: 'TOO_LARGE',
			weightKg: 'TOO_SMALL',
			activityLevel: 'INVALID_VALUE',
			paceKgPerWeek: 'INVALID_VALUE',
		})

		const empty = await owner.agent.patch(PROFILE_URL).send({}).expect(422)
		expect(apiErrorResponseSchema.parse(empty.body).details.fields).toEqual({
			_root: 'EMPTY_UPDATE',
		})
		expect(await prisma.userProfile.count()).toBe(0)
	})

	it('preview names the missing fields while «Мої дані» is incomplete', async () => {
		await start()
		const owner = await registerUser('owner@kus.app')

		const empty = await owner.agent.post(PREVIEW_URL).expect(409)
		expect(apiErrorResponseSchema.parse(empty.body)).toMatchObject({
			errorCode: 'PROFILE_INCOMPLETE',
			details: {
				fields: ['sex', 'age', 'heightCm', 'activityLevel', 'goalType', 'weightKg'],
			},
		})

		// LOSE without a pace is incomplete too
		await owner.agent
			.patch(PROFILE_URL)
			.send({ ...SEED, paceKgPerWeek: undefined })
			.expect(200)
		const noPace = await owner.agent.post(PREVIEW_URL).expect(409)
		expect(apiErrorResponseSchema.parse(noPace.body).details.fields).toEqual(['paceKgPerWeek'])
		// a calculated save needs the same
		await owner.agent.put(GOALS_URL).send({ source: 'calculated' }).expect(409)
		expect(await prisma.userGoal.count()).toBe(0)
	})

	it('previews and saves the calculated goals from the seed; the day shows them', async () => {
		await start()
		const owner = await registerUser('owner@kus.app')
		await owner.agent.patch(PROFILE_URL).send(SEED).expect(200)

		const preview = await owner.agent.post(PREVIEW_URL).expect(200)

		expect(previewResponse.parse(preview.body).data).toMatchObject({
			...SEED_GOALS,
			appliedPaceKgPerWeek: 0.25,
			etaWeeks: 24,
			warnings: [],
			steps: { bmr: 1832.5, tdee: 2519.7, rawKcal: 2244.7 },
			current: null,
		})
		expect(await prisma.userGoal.count()).toBe(0)

		const saved = await owner.agent.put(GOALS_URL).send({ source: 'calculated' }).expect(200)
		expect(goalsResponse.parse(saved.body).data).toMatchObject({
			...SEED_GOALS,
			source: 'CALCULATED',
			validFrom: today(),
		})
		const profile = await owner.agent.get(PROFILE_URL).expect(200)
		expect(profileResponse.parse(profile.body).data.goals).toMatchObject(SEED_GOALS)
		const day = await owner.agent.get(`/api/v1/days/${today()}`).expect(200)
		expect(dayResponse.parse(day.body).data.goal).toEqual({
			kcal: 2200,
			protein: 140,
			carbs: 230,
			fat: 80,
		})
		const stored = await prisma.userGoal.findFirstOrThrow({ where: { userId: owner.userId } })
		expect(stored).toMatchObject({ type: 'LOSE', source: 'CALCULATED', targetWeightKg: null })

		// the preview now shows what it would replace
		const again = await owner.agent.post(PREVIEW_URL).expect(200)
		expect(previewResponse.parse(again.body).data.current).toMatchObject(SEED_GOALS)
	})

	it('manual goals must add up: inconsistent → 400, consistent saved as MANUAL', async () => {
		await start()
		const owner = await registerUser('owner@kus.app')

		const inconsistent = await owner.agent
			.put(GOALS_URL)
			.send({ source: 'manual', kcal: 2200, proteinG: 100, carbsG: 100, fatG: 50 })
			.expect(400)
		expect(apiErrorResponseSchema.parse(inconsistent.body)).toEqual({
			statusCode: 400,
			errorCode: 'GOALS_INCONSISTENT',
			details: { macroKcal: 1250 },
		})

		const missing = await owner.agent.put(GOALS_URL).send({ source: 'manual' }).expect(422)
		expect(apiErrorResponseSchema.parse(missing.body).details.fields).toEqual({
			kcal: 'REQUIRED',
			proteinG: 'REQUIRED',
			carbsG: 'REQUIRED',
			fatG: 'REQUIRED',
		})
		expect(await prisma.userGoal.count()).toBe(0)

		// the goals-edit-sheet example: 150 · 190 · 70 ≈ 1990 of 2000
		const saved = await owner.agent
			.put(GOALS_URL)
			.send({ source: 'manual', kcal: 2000, proteinG: 150, carbsG: 190, fatG: 70 })
			.expect(200)
		expect(goalsResponse.parse(saved.body).data).toMatchObject({
			kcal: 2000,
			proteinG: 150,
			carbsG: 190,
			fatG: 70,
			source: 'MANUAL',
		})
	})

	it('a new goal starts today; yesterday keeps the goal it had', async () => {
		await start()
		const owner = await registerUser('owner@kus.app')
		const yesterday = getLocalDateString(addDays(new Date(), -1), TIMEZONE)
		await prisma.userGoal.create({
			data: {
				userId: owner.userId,
				type: 'LOSE',
				dailyKcal: 2000,
				proteinG: 140,
				fatG: 70,
				carbsG: 200,
				validFrom: new Date(`${yesterday}T00:00:00Z`),
			},
		})

		await owner.agent
			.put(GOALS_URL)
			.send({ source: 'manual', kcal: 2200, proteinG: 140, carbsG: 230, fatG: 80 })
			.expect(200)

		const before = await owner.agent.get(`/api/v1/days/${yesterday}`).expect(200)
		expect(dayResponse.parse(before.body).data.goal?.kcal).toBe(2000)
		const after = await owner.agent.get(`/api/v1/days/${today()}`).expect(200)
		expect(dayResponse.parse(after.body).data.goal?.kcal).toBe(2200)
		expect(await prisma.userGoal.count({ where: { userId: owner.userId } })).toBe(2)
	})

	it('shows only the own data and requires auth', async () => {
		await start()
		const owner = await registerUser('owner@kus.app')
		const stranger = await registerUser('stranger@kus.app')
		await owner.agent.patch(PROFILE_URL).send(SEED).expect(200)
		await owner.agent.put(GOALS_URL).send({ source: 'calculated' }).expect(200)

		const response = await stranger.agent.get(PROFILE_URL).expect(200)

		expect(profileResponse.parse(response.body).data).toMatchObject({
			email: 'stranger@kus.app',
			weight: null,
			goals: null,
		})
		await request(app.getHttpServer()).get(PROFILE_URL).expect(401)
		await request(app.getHttpServer()).post(PREVIEW_URL).expect(401)
	})
})
