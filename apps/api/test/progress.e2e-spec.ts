import type { NestExpressApplication } from '@nestjs/platform-express'
import { Logger } from '@nestjs/common'
import {
	apiErrorResponseSchema,
	authSessionResponseSchema,
	createDataResponseSchema,
	progressResponseSchema,
	type ProgressResponse,
} from '@kus/shared'
import request from 'supertest'
import type TestAgent from 'supertest/lib/agent'
import { afterAll, afterEach, describe, expect, it, vi } from 'vitest'

import { addDays, formatDbDate, getLocalDate } from '../src/common/time'
import { GoalType, MeasurementKind, MeasurementSource } from '../src/generated/prisma/client'
import type { PrismaService } from '../src/prisma'
import { createDbTestApp } from './create-db-test-app'

const PROGRESS_URL = '/api/v1/progress'
const progressResponse = createDataResponseSchema(progressResponseSchema)
const DAILY_GOAL_KCAL = 2200
const KCAL_OVER_GOAL = 2420
const KCAL_NORMAL = 1900
const SATURDAY = 6
const SUNDAY = 0

interface TestUser {
	agent: TestAgent
	userId: string
}

const isWeekend = (date: Date): boolean => [SATURDAY, SUNDAY].includes(date.getUTCDay())

describe('progress (e2e, real DB)', () => {
	let app: NestExpressApplication
	let prisma: PrismaService
	const logSpies = [
		vi.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined),
		vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined),
	]

	const start = async (): Promise<void> => {
		;({ app, prisma } = await createDbTestApp())
	}

	const registerUser = async (email: string): Promise<TestUser> => {
		const agent = request.agent(app.getHttpServer())
		const response = await agent
			.post('/api/v1/auth/register')
			.send({ email, password: 'correct-horse-battery', name: 'Test', consent: true })
			.expect(201)
		const { user } = createDataResponseSchema(authSessionResponseSchema).parse(response.body).data
		return { agent, userId: user.id }
	}

	const getToday = async (userId: string): Promise<Date> => {
		const { timezone } = await prisma.user.findUniqueOrThrow({ where: { id: userId } })
		return getLocalDate(new Date(), timezone)
	}

	const seedMeasurement = (userId: string, kind: MeasurementKind, localDate: Date, value: number) =>
		prisma.measurement.create({
			data: {
				userId,
				kind,
				value,
				localDate,
				measuredAt: localDate,
				source: MeasurementSource.CHAT,
			},
		})

	const seedWeight = (userId: string, localDate: Date, value: number) =>
		seedMeasurement(userId, MeasurementKind.WEIGHT, localDate, value)

	const seedFood = async (
		userId: string,
		localDate: Date,
		{ kcal, proteinG }: { kcal: number; proteinG: number },
	): Promise<void> => {
		const meal = await prisma.meal.create({
			data: { userId, type: 'LUNCH', localDate, eatenAt: localDate },
		})
		await prisma.foodEntry.create({
			data: {
				userId,
				mealId: meal.id,
				name: 'Обід',
				grams: 300,
				kcal,
				proteinG,
				fatG: 15,
				carbsG: 60,
				source: 'ESTIMATE',
				confidence: 0.5,
			},
		})
	}

	const seedDailyGoal = (userId: string, validFrom: Date) =>
		prisma.userGoal.create({
			data: {
				userId,
				type: 'LOSE',
				dailyKcal: DAILY_GOAL_KCAL,
				proteinG: 140,
				fatG: 80,
				carbsG: 225,
				validFrom,
			},
		})

	const setWeightGoal = (userId: string, goalType: GoalType, targetWeightKg: number | null) =>
		prisma.userProfile.upsert({
			where: { userId },
			create: { userId, goalType, targetWeightKg, paceKgPerWeek: 0.25 },
			update: { goalType, targetWeightKg, paceKgPerWeek: 0.25 },
		})

	const getProgress = async (user: TestUser, range?: number): Promise<ProgressResponse> => {
		const query = range === undefined ? '' : `?range=${range}`
		const response = await user.agent.get(`${PROGRESS_URL}${query}`).expect(200)
		return progressResponse.parse(response.body).data
	}

	afterEach(async () => {
		vi.useRealTimers()
		await app.close()
	})

	afterAll(() => {
		for (const spy of logSpies) spy.mockRestore()
	})

	it('answers 401 without a token', async () => {
		await start()

		await request(app.getHttpServer()).get(PROGRESS_URL).expect(401)
	})

	it('answers 422 VALIDATION_ERROR for a range outside 7, 30 and 90', async () => {
		await start()
		const owner = await registerUser('owner@kus.app')

		const response = await owner.agent.get(`${PROGRESS_URL}?range=8`).expect(422)

		expect(apiErrorResponseSchema.parse(response.body)).toMatchObject({
			statusCode: 422,
			errorCode: 'VALIDATION_ERROR',
		})
	})

	it('is empty for a new user, with a 7-day week and no weight or waist', async () => {
		await start()
		const owner = await registerUser('owner@kus.app')
		const today = await getToday(owner.userId)

		const data = await getProgress(owner)

		expect(data).toMatchObject({
			range: 7,
			from: formatDbDate(addDays(today, -6)),
			to: formatDbDate(today),
			isEmpty: true,
			weight: null,
			waist: null,
			insight: {
				weekPaceKg: null,
				planPaceKgPerWeek: null,
				goalType: null,
				overDays: 0,
				isWeekendProteinLow: false,
			},
		})
		expect(data.week.days).toHaveLength(7)
		expect(data.week.days.every((day) => day.status === 'empty')).toBe(true)
		expect(data.week).toMatchObject({ goalKcal: null, avgKcal: null, avgProteinG: null })
	})

	it('stops being empty at 3 food days or 2 weigh-ins', async () => {
		await start()
		const foodUser = await registerUser('food@kus.app')
		const weightUser = await registerUser('weight@kus.app')
		const today = await getToday(foodUser.userId)
		for (const back of [0, 1]) {
			await seedFood(foodUser.userId, addDays(today, -back), { kcal: 1000, proteinG: 50 })
		}
		await seedWeight(weightUser.userId, today, 82)

		expect((await getProgress(foodUser)).isEmpty).toBe(true)
		expect((await getProgress(weightUser)).isEmpty).toBe(true)

		await seedFood(foodUser.userId, addDays(today, -2), { kcal: 1000, proteinG: 50 })
		await seedWeight(weightUser.userId, addDays(today, -3), 83)

		expect((await getProgress(foodUser)).isEmpty).toBe(false)
		expect((await getProgress(weightUser)).isEmpty).toBe(false)
	})

	it('gives weight points per range while the week stays the same', async () => {
		await start()
		const owner = await registerUser('owner@kus.app')
		const today = await getToday(owner.userId)
		await seedDailyGoal(owner.userId, addDays(today, -100))
		await setWeightGoal(owner.userId, GoalType.LOSE, 78)
		const weights: [number, number][] = [
			[80, 84],
			[40, 83.5],
			[10, 83],
			[6, 82.8],
			[0, 82.4],
		]
		for (const [back, value] of weights) {
			await seedWeight(owner.userId, addDays(today, -back), value)
		}
		await seedFood(owner.userId, addDays(today, -1), { kcal: KCAL_NORMAL, proteinG: 120 })

		const [week7, week30, week90] = await Promise.all([
			getProgress(owner, 7),
			getProgress(owner, 30),
			getProgress(owner, 90),
		])

		expect(week7.weight?.points.map((point) => point.value)).toEqual([82.8, 82.4])
		expect(week30.weight?.points.map((point) => point.value)).toEqual([83, 82.8, 82.4])
		expect(week90.weight?.points.map((point) => point.value)).toEqual([84, 83.5, 83, 82.8, 82.4])
		expect(week7.from).toBe(formatDbDate(addDays(today, -6)))
		expect(week30.from).toBe(formatDbDate(addDays(today, -29)))
		expect(week90.from).toBe(formatDbDate(addDays(today, -89)))
		// the week card does not depend on the range
		expect(week30.week).toEqual(week7.week)
		expect(week90.week).toEqual(week7.week)
		expect(week7.week.days).toHaveLength(7)
	})

	it('reports the change over the chosen range, the current weight and the way to the goal', async () => {
		await start()
		const owner = await registerUser('owner@kus.app')
		const today = await getToday(owner.userId)
		await setWeightGoal(owner.userId, GoalType.LOSE, 78)
		await seedWeight(owner.userId, addDays(today, -40), 85)
		await seedWeight(owner.userId, addDays(today, -20), 84)
		await seedWeight(owner.userId, addDays(today, -7), 83)
		await seedWeight(owner.userId, today, 82.4)

		const week = await getProgress(owner, 7)
		const month = await getProgress(owner, 30)
		const quarter = await getProgress(owner, 90)

		expect(week.weight).toMatchObject({
			current: { value: 82.4, localDate: formatDbDate(today) },
			changeInRange: null,
			target: 78,
			toGoal: 4.4,
			isGoalReached: false,
		})
		expect(week.insight.weekPaceKg).toBe(-0.6)
		expect(month.weight?.changeInRange).toBe(-1.6)
		expect(quarter.weight?.changeInRange).toBe(-2.6)
		expect(quarter.insight).toMatchObject({ goalType: 'LOSE', planPaceKgPerWeek: 0.25 })
	})

	it('shows 0 kg to the goal once it is reached or passed, and nothing for MAINTAIN', async () => {
		await start()
		const owner = await registerUser('owner@kus.app')
		const today = await getToday(owner.userId)
		await seedWeight(owner.userId, today, 77.6)
		await setWeightGoal(owner.userId, GoalType.LOSE, 78)

		expect((await getProgress(owner)).weight).toMatchObject({ toGoal: 0, isGoalReached: true })

		await setWeightGoal(owner.userId, GoalType.MAINTAIN, 78)
		const maintain = await getProgress(owner)

		expect(maintain.weight).toMatchObject({ toGoal: null, isGoalReached: null })
		expect(maintain.insight.planPaceKgPerWeek).toBeNull()
	})

	it('keeps the latest weight as current when it is older than the range', async () => {
		await start()
		const owner = await registerUser('owner@kus.app')
		const today = await getToday(owner.userId)
		await seedWeight(owner.userId, addDays(today, -20), 82)

		const { weight, insight } = await getProgress(owner, 7)

		expect(weight).toMatchObject({
			current: { value: 82, localDate: formatDbDate(addDays(today, -20)) },
			changeInRange: null,
			points: [],
		})
		expect(insight.weekPaceKg).toBeNull()
	})

	it('gives the waist its own points and null without any waist', async () => {
		await start()
		const owner = await registerUser('owner@kus.app')
		const today = await getToday(owner.userId)
		await seedWeight(owner.userId, today, 82)
		expect((await getProgress(owner)).waist).toBeNull()

		await seedMeasurement(owner.userId, MeasurementKind.WAIST, addDays(today, -20), 96)
		await seedMeasurement(owner.userId, MeasurementKind.WAIST, today, 94.5)

		const month = await getProgress(owner, 30)
		const week = await getProgress(owner, 7)

		expect(month.waist).toMatchObject({ changeInRange: -1.5, current: { value: 94.5 } })
		expect(month.waist?.points).toHaveLength(2)
		expect(week.waist).toMatchObject({ changeInRange: null, points: [{ value: 94.5 }] })
	})

	it('averages only the days with entries and counts the days over the goal', async () => {
		await start()
		const owner = await registerUser('owner@kus.app')
		const today = await getToday(owner.userId)
		await seedDailyGoal(owner.userId, addDays(today, -30))
		await seedFood(owner.userId, addDays(today, -1), { kcal: KCAL_OVER_GOAL, proteinG: 130 })
		await seedFood(owner.userId, addDays(today, -2), { kcal: KCAL_NORMAL, proteinG: 118 })

		const { week, insight } = await getProgress(owner)

		expect(week.goalKcal).toBe(DAILY_GOAL_KCAL)
		expect(week.avgKcal).toBe(2160)
		expect(week.avgProteinG).toBe(124)
		expect(week.days.map((day) => day.status).filter((status) => status !== 'empty')).toEqual([
			'normal',
			'over',
		])
		expect(insight.overDays).toBe(1)
	})

	it('flags low weekend protein over the last 7 days', async () => {
		await start()
		const owner = await registerUser('owner@kus.app')
		const today = await getToday(owner.userId)
		for (let back = 0; back < 7; back += 1) {
			const date = addDays(today, -back)
			await seedFood(owner.userId, date, { kcal: 1800, proteinG: isWeekend(date) ? 60 : 120 })
		}

		expect((await getProgress(owner)).insight.isWeekendProteinLow).toBe(true)
	})

	it('does not flag the weekend when the weekdays have no data', async () => {
		await start()
		const owner = await registerUser('owner@kus.app')
		const today = await getToday(owner.userId)
		for (let back = 0; back < 7; back += 1) {
			const date = addDays(today, -back)
			if (isWeekend(date)) await seedFood(owner.userId, date, { kcal: 1800, proteinG: 10 })
		}

		expect((await getProgress(owner)).insight.isWeekendProteinLow).toBe(false)
	})

	it('cuts the days at midnight of the user timezone, not UTC', async () => {
		await start()
		const owner = await registerUser('owner@kus.app')
		await prisma.user.update({ where: { id: owner.userId }, data: { timezone: 'Europe/Warsaw' } })
		const summerEvening = new Date('2026-07-14T21:30:00Z') // 23:30 in Warsaw, still the 14th
		const pastMidnight = new Date('2026-07-14T22:30:00Z') // 00:30 in Warsaw, already the 15th
		await seedFood(owner.userId, new Date('2026-07-14T00:00:00Z'), { kcal: 1500, proteinG: 90 })

		vi.useFakeTimers({ toFake: ['Date'] })
		vi.setSystemTime(summerEvening)
		const evening = await getProgress(owner)
		vi.setSystemTime(pastMidnight)
		const night = await getProgress(owner)

		expect(evening.to).toBe('2026-07-14')
		expect(evening.week.days.at(-1)).toMatchObject({ localDate: '2026-07-14', kcal: 1500 })
		expect(night.to).toBe('2026-07-15')
		expect(night.week.days.at(-1)).toMatchObject({ localDate: '2026-07-15', kcal: 0 })
		expect(night.week.days.at(-2)).toMatchObject({ localDate: '2026-07-14', kcal: 1500 })
		expect(night.from).toBe('2026-07-09')
	})

	it('ignores soft-deleted entries', async () => {
		await start()
		const owner = await registerUser('owner@kus.app')
		const today = await getToday(owner.userId)
		await seedFood(owner.userId, today, { kcal: 700, proteinG: 40 })
		await prisma.foodEntry.updateMany({
			where: { userId: owner.userId },
			data: { deletedAt: new Date() },
		})

		const { week } = await getProgress(owner)

		expect(week.avgKcal).toBeNull()
		expect(week.days.at(-1)?.status).toBe('empty')
	})

	it('includes the first day of the 30 and 90 day ranges and drops the day before it', async () => {
		await start()
		const owner = await registerUser('owner@kus.app')
		const today = await getToday(owner.userId)
		for (const [back, value] of [
			[91, 90],
			[90, 89],
			[89, 88],
			[31, 85],
			[30, 84],
			[29, 83],
			[0, 82],
		] as const) {
			await seedWeight(owner.userId, addDays(today, -back), value)
		}

		const month = await getProgress(owner, 30)
		const quarter = await getProgress(owner, 90)

		expect(month.weight?.points.map((point) => point.value)).toEqual([83, 82])
		expect(month.from).toBe(formatDbDate(addDays(today, -29)))
		expect(month.to).toBe(formatDbDate(today))
		expect(quarter.weight?.points.map((point) => point.value)).toEqual([88, 85, 84, 83, 82])
		expect(quarter.from).toBe(formatDbDate(addDays(today, -89)))
	})

	it('counts weigh-ins for the empty state only within the last 90 days', async () => {
		await start()
		const inside = await registerUser('inside@kus.app')
		const outside = await registerUser('outside@kus.app')
		const today = await getToday(inside.userId)
		await seedWeight(inside.userId, today, 82)
		await seedWeight(inside.userId, addDays(today, -89), 85)
		await seedWeight(outside.userId, today, 82)
		await seedWeight(outside.userId, addDays(today, -90), 85)

		expect((await getProgress(inside)).isEmpty).toBe(false)
		expect((await getProgress(outside)).isEmpty).toBe(true)
	})

	it('gives a weekly pace only when the latest weigh-in is at most 6 days old', async () => {
		await start()
		const fresh = await registerUser('fresh@kus.app')
		const stale = await registerUser('stale@kus.app')
		const today = await getToday(fresh.userId)
		await seedWeight(fresh.userId, addDays(today, -6), 82)
		await seedWeight(fresh.userId, addDays(today, -12), 83)
		await seedWeight(stale.userId, addDays(today, -7), 82)
		await seedWeight(stale.userId, addDays(today, -13), 83)

		expect((await getProgress(fresh)).insight.weekPaceKg).toBe(-1)
		expect((await getProgress(stale)).insight.weekPaceKg).toBeNull()
	})

	it('counts the way to a GAIN goal upwards and has no way to go without a target', async () => {
		await start()
		const owner = await registerUser('owner@kus.app')
		const today = await getToday(owner.userId)
		await seedWeight(owner.userId, today, 70.2)
		await setWeightGoal(owner.userId, GoalType.GAIN, 75)

		expect((await getProgress(owner)).weight).toMatchObject({
			toGoal: 4.8,
			isGoalReached: false,
		})

		await setWeightGoal(owner.userId, GoalType.GAIN, 70)
		expect((await getProgress(owner)).weight).toMatchObject({ toGoal: 0, isGoalReached: true })

		await setWeightGoal(owner.userId, GoalType.LOSE, null)
		expect((await getProgress(owner)).weight).toMatchObject({
			target: null,
			toGoal: null,
			isGoalReached: null,
		})
	})

	it('keeps the waist current value when it is older than the range, without points', async () => {
		await start()
		const owner = await registerUser('owner@kus.app')
		const today = await getToday(owner.userId)
		await seedMeasurement(owner.userId, MeasurementKind.WAIST, addDays(today, -20), 96)

		const { waist } = await getProgress(owner, 7)

		expect(waist).toMatchObject({
			current: { value: 96, localDate: formatDbDate(addDays(today, -20)) },
			changeInRange: null,
			points: [],
		})
	})

	it('never mixes in the data of another user', async () => {
		await start()
		const owner = await registerUser('owner@kus.app')
		const other = await registerUser('other@kus.app')
		const today = await getToday(owner.userId)
		await seedWeight(other.userId, today, 99)
		await seedMeasurement(other.userId, MeasurementKind.WAIST, today, 120)
		await seedFood(other.userId, today, { kcal: 3000, proteinG: 200 })
		await seedDailyGoal(other.userId, addDays(today, -10))
		await setWeightGoal(other.userId, GoalType.LOSE, 70)

		const data = await getProgress(owner, 90)

		expect(data).toMatchObject({ isEmpty: true, weight: null, waist: null })
		expect(data.week).toMatchObject({ goalKcal: null, avgKcal: null, avgProteinG: null })
		expect(data.insight).toMatchObject({ goalType: null, overDays: 0 })
		expect((await getProgress(other, 7)).weight?.current.value).toBe(99)
	})
})
