import { Logger } from '@nestjs/common'
import type { NestExpressApplication } from '@nestjs/platform-express'
import { authSessionResponseSchema, createDataResponseSchema } from '@kus/shared'
import request from 'supertest'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { createFakeAiClient } from '../src/modules/ai/ai.test-utils'
import type { PrismaService } from '../src/prisma'
import { createDbTestApp } from './create-db-test-app'

const fake = createFakeAiClient()
const DAY = new Date('2026-10-27T00:00:00Z')
const NOW = new Date('2026-10-27T17:30:00Z')

describe('workouts schema (real DB)', () => {
	let app: NestExpressApplication
	let prisma: PrismaService
	vi.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined)

	const start = async (): Promise<string> => {
		;({ app, prisma } = await createDbTestApp({ aiClient: fake.client }))
		const response = await request(app.getHttpServer())
			.post('/api/v1/auth/register')
			.send({
				email: 'lifter@kus.app',
				password: 'correct-horse-battery',
				name: 'Bohdan',
				consent: true,
			})
			.expect(201)
		return createDataResponseSchema(authSessionResponseSchema).parse(response.body).data.user.id
	}

	const seedWorkout = async (userId: string) => {
		const workout = await prisma.workout.create({
			data: { userId, localDate: DAY, place: 'GYM', kcalBurned: 320, kcalSource: 'MANUAL' },
		})
		const entry = await prisma.exerciseEntry.create({
			data: {
				userId,
				workoutId: workout.id,
				name: 'Жим лежачи',
				kind: 'STRENGTH',
				source: 'MANUAL',
				performedAt: NOW,
				localDate: DAY,
			},
		})
		await prisma.exerciseSet.createMany({
			data: [
				{ userId, exerciseEntryId: entry.id, position: 0, reps: 8, weightKg: 80 },
				{ userId, exerciseEntryId: entry.id, position: 1, reps: 8, weightKg: 82.5 },
			],
		})
		return { workout, entry }
	}

	afterEach(async () => {
		await app.close()
	})

	it('stores a strength exercise without duration or calories', async () => {
		const userId = await start()

		const { entry } = await seedWorkout(userId)

		const stored = await prisma.exerciseEntry.findUniqueOrThrow({
			where: { id: entry.id },
			include: { sets: { orderBy: { position: 'asc' } } },
		})
		expect(stored.durationMin).toBeNull()
		expect(stored.kcalBurned).toBeNull()
		expect(stored.sets.map((set) => Number(set.weightKg))).toEqual([80, 82.5])
	})

	it('deleting a workout removes its exercises and sets', async () => {
		const userId = await start()
		const { workout } = await seedWorkout(userId)

		await prisma.workout.delete({ where: { id: workout.id } })

		expect(await prisma.exerciseEntry.count({ where: { userId } })).toBe(0)
		expect(await prisma.exerciseSet.count({ where: { userId } })).toBe(0)
	})

	it('deleting the account removes workouts, exercises and sets', async () => {
		const userId = await start()
		await seedWorkout(userId)
		await prisma.exercise.create({
			data: { userId, name: 'Жим', nameNormalized: 'жим', kind: 'STRENGTH', aliases: [] },
		})

		await prisma.user.delete({ where: { id: userId } })

		expect(await prisma.workout.count()).toBe(0)
		expect(await prisma.exercise.count()).toBe(0)
		expect(await prisma.exerciseEntry.count()).toBe(0)
		expect(await prisma.exerciseSet.count()).toBe(0)
	})

	it('keeps a dictionary name unique per user until the exercise is soft-deleted', async () => {
		const userId = await start()
		const data = {
			userId,
			name: 'Жим',
			nameNormalized: 'жим',
			kind: 'STRENGTH' as const,
			aliases: [] as string[],
		}
		const first = await prisma.exercise.create({ data })

		await expect(prisma.exercise.create({ data })).rejects.toThrow()

		await prisma.exercise.update({ where: { id: first.id }, data: { deletedAt: new Date() } })
		await expect(prisma.exercise.create({ data })).resolves.toBeDefined()
	})
})
