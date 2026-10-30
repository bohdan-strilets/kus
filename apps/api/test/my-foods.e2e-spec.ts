import { Logger } from '@nestjs/common'
import type { NestExpressApplication } from '@nestjs/platform-express'
import {
	apiErrorResponseSchema,
	authSessionResponseSchema,
	createDataResponseSchema,
	createPaginatedResponseSchema,
	dayResponseSchema,
	foodEntryResponseSchema,
	myFoodResponseSchema,
	rememberEntriesResponseSchema,
} from '@kus/shared'
import request from 'supertest'
import type TestAgent from 'supertest/lib/agent'
import { afterAll, afterEach, describe, expect, it, vi } from 'vitest'

import type { FoodSource } from '../src/generated/prisma/client'
import type { PrismaService } from '../src/prisma'
import { createDbTestApp } from './create-db-test-app'

const MY_FOODS_URL = '/api/v1/my-foods'
const REMEMBER_URL = `${MY_FOODS_URL}/from-entries`
/** The day of seedEntry's meal. */
const DAY_URL = '/api/v1/days/2026-10-01'
const myFoodUrl = (id: string): string => `${MY_FOODS_URL}/${id}`
const UNKNOWN_ID = '00000000-0000-4000-8000-000000000000'

const listSchema = createPaginatedResponseSchema(myFoodResponseSchema)
const foodSchema = createDataResponseSchema(myFoodResponseSchema)
const rememberSchema = createDataResponseSchema(rememberEntriesResponseSchema)
const entrySchema = createDataResponseSchema(foodEntryResponseSchema)
const dayResponse = createDataResponseSchema(dayResponseSchema)

const PER_100G = { kcal: 52, protein: 0.3, fat: 0.2, carbs: 14, fiber: 2.4 }

interface TestUser {
	agent: TestAgent
	userId: string
}

interface SeedEntryOptions {
	name?: string
	grams?: number
	quantity?: number | null
	kcal?: number
	source?: FoodSource
	deletedAt?: Date
	isMealDeleted?: boolean
}

describe('my foods (e2e, real DB)', () => {
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

	const seedFood = (
		user: TestUser,
		name: string,
		extra: { aliases?: string[]; deletedAt?: Date } = {},
	) =>
		prisma.myFood.create({
			data: {
				userId: user.userId,
				name,
				nameNormalized: name.trim().toLowerCase().replace(/\s+/g, ' '),
				aliases: extra.aliases ?? [],
				kcalPer100g: PER_100G.kcal,
				proteinPer100g: PER_100G.protein,
				fatPer100g: PER_100G.fat,
				carbsPer100g: PER_100G.carbs,
				fiberPer100g: PER_100G.fiber,
				source: 'AI',
				deletedAt: extra.deletedAt,
			},
		})

	const seedEntry = async (user: TestUser, options: SeedEntryOptions = {}) => {
		const meal = await prisma.meal.create({
			data: {
				userId: user.userId,
				type: 'OTHER',
				eatenAt: new Date(),
				localDate: new Date('2026-10-01T00:00:00Z'),
				deletedAt: options.isMealDeleted ? new Date() : null,
			},
		})
		return prisma.foodEntry.create({
			data: {
				userId: user.userId,
				mealId: meal.id,
				name: options.name ?? 'Яйце варене',
				grams: options.grams ?? 100,
				quantity: options.quantity ?? null,
				kcal: options.kcal ?? 150,
				proteinG: 12,
				fatG: 10,
				carbsG: 1,
				fiberG: null,
				category: 'eggs',
				source: options.source ?? 'ESTIMATE',
				confidence: 0.8,
				deletedAt: options.deletedAt,
			},
		})
	}

	const expectError = (response: request.Response, errorCode: string): Record<string, unknown> => {
		const body = apiErrorResponseSchema.parse(response.body)
		expect(body.errorCode).toBe(errorCode)
		return body.details
	}

	const getDeletedAt = async (id: string): Promise<Date | null> =>
		(await prisma.myFood.findUniqueOrThrow({ where: { id } })).deletedAt

	afterEach(async () => {
		await app.close()
	})

	afterAll(() => {
		for (const spy of logSpies) spy.mockRestore()
	})

	it('answers 401 without a token', async () => {
		await start()
		const agent = request(app.getHttpServer())
		await agent.get(MY_FOODS_URL).expect(401)
		await agent.patch(myFoodUrl(UNKNOWN_ID)).send({ name: 'X' }).expect(401)
		await agent.delete(myFoodUrl(UNKNOWN_ID)).expect(401)
		await agent.post(`${myFoodUrl(UNKNOWN_ID)}/restore`).expect(401)
		await agent
			.post(REMEMBER_URL)
			.send({ entryIds: [UNKNOWN_ID] })
			.expect(401)
	})

	describe('list', () => {
		it('sorts by name, searches name and aliases, paginates, hides deleted and foreign foods', async () => {
			await start()
			const owner = await registerUser('owner@kus.app')
			const other = await registerUser('other@kus.app')
			await seedFood(owner, 'Яблуко')
			await seedFood(owner, 'Банан', { aliases: ['бананчик'] })
			await seedFood(owner, 'Авокадо')
			await seedFood(owner, 'Груша', { deletedAt: new Date() })
			await seedFood(other, 'Ананас')

			const all = listSchema.parse((await owner.agent.get(MY_FOODS_URL).expect(200)).body)
			expect(all.data.map((food) => food.name)).toEqual(['Авокадо', 'Банан', 'Яблуко'])
			expect(all.meta).toMatchObject({ total: 3, page: 1, totalPages: 1 })
			expect(all.data[0]?.per100g).toEqual(PER_100G)

			const byName = listSchema.parse(
				(await owner.agent.get(MY_FOODS_URL).query({ q: '  ЯБЛ ' }).expect(200)).body,
			)
			expect(byName.data.map((food) => food.name)).toEqual(['Яблуко'])

			const byAlias = listSchema.parse(
				(await owner.agent.get(MY_FOODS_URL).query({ q: 'чик' }).expect(200)).body,
			)
			expect(byAlias.data.map((food) => food.name)).toEqual(['Банан'])

			const page = listSchema.parse(
				(await owner.agent.get(MY_FOODS_URL).query({ limit: 2, page: 2 }).expect(200)).body,
			)
			expect(page.data.map((food) => food.name)).toEqual(['Яблуко'])
			expect(page.meta).toMatchObject({ total: 3, page: 2, limit: 2, totalPages: 2 })
		})

		it('answers 422 on a bad query', async () => {
			await start()
			const owner = await registerUser('owner@kus.app')
			await owner.agent.get(MY_FOODS_URL).query({ limit: 100000 }).expect(422)
		})
	})

	describe('update', () => {
		it('edits the fields, recomputes the normalized name and marks the source MANUAL', async () => {
			await start()
			const owner = await registerUser('owner@kus.app')
			const food = await seedFood(owner, 'Яблуко')

			const response = await owner.agent
				.patch(myFoodUrl(food.id))
				.send({
					name: '  Яблуко   Зелене ',
					per100g: { kcal: 40, protein: 1, fat: 0, carbs: 9, fiber: null },
					pieceGrams: 150,
					defaultGrams: null,
				})
				.expect(200)

			expect(foodSchema.parse(response.body).data).toMatchObject({
				id: food.id,
				// one line with single spaces: the name goes into the model context
				name: 'Яблуко Зелене',
				per100g: { kcal: 40, protein: 1, fat: 0, carbs: 9, fiber: null },
				pieceGrams: 150,
				defaultGrams: null,
				source: 'MANUAL',
			})
			const stored = await prisma.myFood.findUniqueOrThrow({ where: { id: food.id } })
			expect(stored.nameNormalized).toBe('яблуко зелене')
		})

		it('keeps the other fields when only one is sent', async () => {
			await start()
			const owner = await registerUser('owner@kus.app')
			const food = await seedFood(owner, 'Яблуко')

			await owner.agent.patch(myFoodUrl(food.id)).send({ pieceGrams: 120 }).expect(200)

			const stored = await prisma.myFood.findUniqueOrThrow({ where: { id: food.id } })
			expect(stored).toMatchObject({ name: 'Яблуко', kcalPer100g: 52, pieceGrams: 120 })
		})

		it('answers 409 with the existing food when the name is taken', async () => {
			await start()
			const owner = await registerUser('owner@kus.app')
			const apple = await seedFood(owner, 'Яблуко')
			const pear = await seedFood(owner, 'Груша')

			const response = await owner.agent
				.patch(myFoodUrl(pear.id))
				.send({ name: '  яблуко ' })
				.expect(409)

			expect(expectError(response, 'MY_FOOD_EXISTS')).toEqual({
				existingId: apple.id,
				name: 'Яблуко',
			})
			const stored = await prisma.myFood.findUniqueOrThrow({ where: { id: pear.id } })
			expect(stored.name).toBe('Груша')
		})

		it('allows a name held only by the same food or by a deleted one', async () => {
			await start()
			const owner = await registerUser('owner@kus.app')
			const apple = await seedFood(owner, 'Яблуко')
			await seedFood(owner, 'Груша', { deletedAt: new Date() })

			await owner.agent.patch(myFoodUrl(apple.id)).send({ name: 'ЯБЛУКО' }).expect(200)
			await owner.agent.patch(myFoodUrl(apple.id)).send({ name: 'груша' }).expect(200)
		})

		it('answers 422 on a bad body', async () => {
			await start()
			const owner = await registerUser('owner@kus.app')
			const food = await seedFood(owner, 'Яблуко')

			await owner.agent.patch(myFoodUrl(food.id)).send({}).expect(422)
			await owner.agent.patch(myFoodUrl(food.id)).send({ name: '   ' }).expect(422)
			await owner.agent
				.patch(myFoodUrl(food.id))
				.send({ per100g: { kcal: 5000, protein: 0, fat: 0, carbs: 0 } })
				.expect(422)
			await owner.agent.patch(myFoodUrl('not-a-uuid')).send({ name: 'X' }).expect(422)
		})
	})

	describe('delete and restore', () => {
		it('hides a deleted food from the list and brings it back', async () => {
			await start()
			const owner = await registerUser('owner@kus.app')
			const food = await seedFood(owner, 'Яблуко')

			await owner.agent.delete(myFoodUrl(food.id)).expect(204)
			const afterDelete = listSchema.parse((await owner.agent.get(MY_FOODS_URL).expect(200)).body)
			expect(afterDelete.data).toEqual([])
			expect(await getDeletedAt(food.id)).not.toBeNull()
			// nothing active left to delete or edit
			await owner.agent.delete(myFoodUrl(food.id)).expect(404)
			await owner.agent.patch(myFoodUrl(food.id)).send({ name: 'X' }).expect(404)

			const restored = await owner.agent.post(`${myFoodUrl(food.id)}/restore`).expect(200)
			expect(foodSchema.parse(restored.body).data.id).toBe(food.id)
			const afterRestore = listSchema.parse((await owner.agent.get(MY_FOODS_URL).expect(200)).body)
			expect(afterRestore.data.map((item) => item.id)).toEqual([food.id])
		})

		it('answers 409 when an active food took the name meanwhile', async () => {
			await start()
			const owner = await registerUser('owner@kus.app')
			const deleted = await seedFood(owner, 'Яблуко', { deletedAt: new Date() })
			const successor = await seedFood(owner, 'яблуко')

			const response = await owner.agent.post(`${myFoodUrl(deleted.id)}/restore`).expect(409)

			expect(expectError(response, 'MY_FOOD_EXISTS')).toEqual({
				existingId: successor.id,
				name: 'яблуко',
			})
			expect(await getDeletedAt(deleted.id)).not.toBeNull()
		})
	})

	describe('foreign and unknown foods', () => {
		it('answers 404 MY_FOOD_NOT_FOUND on patch, delete and restore, and changes nothing', async () => {
			await start()
			const owner = await registerUser('owner@kus.app')
			const intruder = await registerUser('intruder@kus.app')
			const food = await seedFood(owner, 'Яблуко')
			const deleted = await seedFood(owner, 'Груша', { deletedAt: new Date() })

			const patched = await intruder.agent.patch(myFoodUrl(food.id)).send({ name: 'X' }).expect(404)
			expectError(patched, 'MY_FOOD_NOT_FOUND')
			expectError(await intruder.agent.delete(myFoodUrl(food.id)).expect(404), 'MY_FOOD_NOT_FOUND')
			expectError(
				await intruder.agent.post(`${myFoodUrl(deleted.id)}/restore`).expect(404),
				'MY_FOOD_NOT_FOUND',
			)
			await owner.agent.patch(myFoodUrl(UNKNOWN_ID)).send({ name: 'X' }).expect(404)

			const stored = await prisma.myFood.findUniqueOrThrow({ where: { id: food.id } })
			expect(stored).toMatchObject({ name: 'Яблуко', deletedAt: null })
			expect(await getDeletedAt(deleted.id)).not.toBeNull()
			const list = listSchema.parse((await intruder.agent.get(MY_FOODS_URL).expect(200)).body)
			expect(list.data).toEqual([])
		})
	})

	describe('from entries', () => {
		it('creates foods per 100 g, links the entries and does not mark them edited', async () => {
			await start()
			const owner = await registerUser('owner@kus.app')
			const eggs = await seedEntry(owner, {
				name: 'Яйце варене',
				grams: 120,
				quantity: 2,
				kcal: 186,
				source: 'LABEL',
			})
			const cake = await seedEntry(owner, { name: 'Торт', grams: 200, kcal: 700 })

			const response = await owner.agent
				.post(REMEMBER_URL)
				.send({ entryIds: [eggs.id, cake.id] })
				.expect(201)

			const { created, skipped } = rememberSchema.parse(response.body).data
			expect(skipped).toEqual([])
			expect(created.map((food) => food.name)).toEqual(['Яйце варене', 'Торт'])
			expect(created[0]).toMatchObject({
				per100g: { kcal: 155, protein: 10, fat: 8.3, carbs: 0.8, fiber: null },
				pieceGrams: 60,
				defaultGrams: 120,
				category: 'eggs',
				source: 'LABEL',
			})
			expect(created[1]).toMatchObject({
				per100g: { kcal: 350 },
				pieceGrams: null,
				defaultGrams: 200,
				source: 'AI',
			})
			const stored = await prisma.myFood.findMany({ where: { userId: owner.userId } })
			expect(stored).toHaveLength(2)
			expect(stored.every((food) => food.usageCount === 0 && food.deletedAt === null)).toBe(true)
			const linked = await prisma.foodEntry.findUniqueOrThrow({ where: { id: eggs.id } })
			expect(linked).toMatchObject({ myFoodId: created[0]?.id, isEdited: false })
		})

		it('maps a MANUAL entry to a MANUAL food', async () => {
			await start()
			const owner = await registerUser('owner@kus.app')
			const entry = await seedEntry(owner, { source: 'MANUAL' })

			const response = await owner.agent
				.post(REMEMBER_URL)
				.send({ entryIds: [entry.id] })
				.expect(201)

			expect(rememberSchema.parse(response.body).data.created[0]?.source).toBe('MANUAL')
		})

		it('skips a name that is saved already and a duplicate inside the request', async () => {
			await start()
			const owner = await registerUser('owner@kus.app')
			await seedFood(owner, 'Яблуко')
			const apple = await seedEntry(owner, { name: ' яблуко ' })
			const first = await seedEntry(owner, { name: 'Сир' })
			const second = await seedEntry(owner, { name: 'СИР' })

			const response = await owner.agent
				.post(REMEMBER_URL)
				.send({ entryIds: [apple.id, first.id, second.id] })
				.expect(201)

			const { created, skipped } = rememberSchema.parse(response.body).data
			expect(created.map((food) => food.name)).toEqual(['Сир'])
			expect(skipped).toEqual([
				{ entryId: apple.id, reason: 'exists' },
				{ entryId: second.id, reason: 'exists' },
			])
			expect(await prisma.myFood.count({ where: { userId: owner.userId } })).toBe(2)
			const unlinked = await prisma.foodEntry.findUniqueOrThrow({ where: { id: apple.id } })
			expect(unlinked.myFoodId).toBeNull()
		})

		it('creates again for a name that only a deleted food had', async () => {
			await start()
			const owner = await registerUser('owner@kus.app')
			await seedFood(owner, 'Яблуко', { deletedAt: new Date() })
			const entry = await seedEntry(owner, { name: 'Яблуко' })

			const response = await owner.agent
				.post(REMEMBER_URL)
				.send({ entryIds: [entry.id] })
				.expect(201)

			expect(rememberSchema.parse(response.body).data.created).toHaveLength(1)
		})

		it('answers 404 for a deleted entry or meal and writes nothing', async () => {
			await start()
			const owner = await registerUser('owner@kus.app')
			const alive = await seedEntry(owner, { name: 'Сир' })
			const deletedEntry = await seedEntry(owner, { name: 'Хліб', deletedAt: new Date() })
			const deletedMeal = await seedEntry(owner, { name: 'Мед', isMealDeleted: true })

			for (const gone of [deletedEntry, deletedMeal]) {
				const response = await owner.agent
					.post(REMEMBER_URL)
					.send({ entryIds: [alive.id, gone.id] })
					.expect(404)
				expectError(response, 'ENTRY_NOT_FOUND')
			}
			await owner.agent
				.post(REMEMBER_URL)
				.send({ entryIds: [UNKNOWN_ID] })
				.expect(404)

			expect(await prisma.myFood.count()).toBe(0)
			const stored = await prisma.foodEntry.findUniqueOrThrow({ where: { id: alive.id } })
			expect(stored.myFoodId).toBeNull()
		})

		it("answers 404 for another user's entry and creates nothing", async () => {
			await start()
			const owner = await registerUser('owner@kus.app')
			const intruder = await registerUser('intruder@kus.app')
			const mine = await seedEntry(intruder, { name: 'Сир' })
			const foreign = await seedEntry(owner, { name: 'Хліб' })

			const response = await intruder.agent
				.post(REMEMBER_URL)
				.send({ entryIds: [mine.id, foreign.id] })
				.expect(404)

			expectError(response, 'ENTRY_NOT_FOUND')
			expect(await prisma.myFood.count()).toBe(0)
			const stored = await prisma.foodEntry.findUniqueOrThrow({ where: { id: mine.id } })
			expect(stored.myFoodId).toBeNull()
		})

		it('answers 422 on a bad body', async () => {
			await start()
			const owner = await registerUser('owner@kus.app')
			const entry = await seedEntry(owner)

			await owner.agent.post(REMEMBER_URL).send({ entryIds: [] }).expect(422)
			await owner.agent
				.post(REMEMBER_URL)
				.send({ entryIds: [entry.id, entry.id] })
				.expect(422)
			await owner.agent
				.post(REMEMBER_URL)
				.send({ entryIds: ['nope'] })
				.expect(422)
		})

		it('tells the entry response whether it can be remembered', async () => {
			await start()
			const owner = await registerUser('owner@kus.app')
			const entry = await seedEntry(owner)
			const entryUrl = `/api/v1/food-entries/${entry.id}`

			const before = await owner.agent.patch(entryUrl).send({ grams: 150 }).expect(200)
			expect(entrySchema.parse(before.body).data.canRemember).toBe(true)
			await owner.agent
				.post(REMEMBER_URL)
				.send({ entryIds: [entry.id] })
				.expect(201)
			const after = await owner.agent.patch(entryUrl).send({ grams: 160 }).expect(200)

			expect(entrySchema.parse(after.body).data.canRemember).toBe(false)
		})

		it("offers «Запам'ятати» again in the day once the saved food is deleted", async () => {
			await start()
			const owner = await registerUser('owner@kus.app')
			const entry = await seedEntry(owner)
			const remembered = await owner.agent
				.post(REMEMBER_URL)
				.send({ entryIds: [entry.id] })
				.expect(201)
			const [food] = rememberSchema.parse(remembered.body).data.created
			const readCanRemember = async (): Promise<boolean | undefined> => {
				const day = await owner.agent.get(DAY_URL).expect(200)
				return dayResponse.parse(day.body).data.meals[0]?.entries[0]?.canRemember
			}

			expect(await readCanRemember()).toBe(false)
			await owner.agent.delete(myFoodUrl(food?.id ?? UNKNOWN_ID)).expect(204)
			expect(await readCanRemember()).toBe(true)
			await owner.agent.post(`${myFoodUrl(food?.id ?? UNKNOWN_ID)}/restore`).expect(200)
			expect(await readCanRemember()).toBe(false)
		})
	})
})
