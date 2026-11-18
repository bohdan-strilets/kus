import { Logger } from '@nestjs/common'
import type { NestExpressApplication } from '@nestjs/platform-express'
import {
	apiErrorResponseSchema,
	authSessionResponseSchema,
	createDataResponseSchema,
	createPaginatedResponseSchema,
	dayResponseSchema,
	logRecipePortionResponseSchema,
	recipeDetailSchema,
	recipeListItemSchema,
} from '@kus/shared'
import request from 'supertest'
import type TestAgent from 'supertest/lib/agent'
import { afterAll, afterEach, describe, expect, it, vi } from 'vitest'

import type { PrismaService } from '../src/prisma'
import { createDbTestApp } from './create-db-test-app'

const RECIPES_URL = '/api/v1/recipes'
const recipeUrl = (id: string): string => `${RECIPES_URL}/${id}`
const UNKNOWN_ID = '00000000-0000-4000-8000-000000000000'

const listSchema = createPaginatedResponseSchema(recipeListItemSchema)
const itemSchema = createDataResponseSchema(recipeListItemSchema)
const detailSchema = createDataResponseSchema(recipeDetailSchema)
const logSchema = createDataResponseSchema(logRecipePortionResponseSchema)
const dayResponse = createDataResponseSchema(dayResponseSchema)

interface TestUser {
	agent: TestAgent
	userId: string
}

interface SeedRecipeOptions {
	deletedAt?: Date
	lastUsedAt?: Date
	createdAt?: Date
	defaultGrams?: number | null
}

describe('recipes (e2e, real DB)', () => {
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

	/** A 1000 g pot with 1000 kcal in total and a 400 g portion: ½ = 200 kcal, 1 = 400, 1½ = 600. */
	const seedRecipe = (user: TestUser, name: string, options: SeedRecipeOptions = {}) =>
		prisma.recipe.create({
			data: {
				userId: user.userId,
				name,
				nameNormalized: name.trim().toLowerCase(),
				cookedGrams: 1000,
				defaultGrams: options.defaultGrams === undefined ? 400 : options.defaultGrams,
				category: 'soup',
				lastUsedAt: options.lastUsedAt,
				createdAt: options.createdAt,
				deletedAt: options.deletedAt,
				ingredients: {
					create: [
						{
							name: 'Буряк',
							grams: 500,
							kcal: 600,
							proteinG: 20,
							fatG: 10,
							carbsG: 100,
							position: 0,
						},
						{
							name: 'Яловичина',
							grams: 500,
							kcal: 400,
							proteinG: 60,
							fatG: 20,
							carbsG: 0,
							position: 1,
						},
					],
				},
			},
		})

	const expectError = (response: request.Response, errorCode: string): Record<string, unknown> => {
		const body = apiErrorResponseSchema.parse(response.body)
		expect(body.errorCode).toBe(errorCode)
		return body.details
	}

	afterEach(async () => {
		await app.close()
	})

	afterAll(() => {
		for (const spy of logSpies) spy.mockRestore()
	})

	it('answers 401 without a token', async () => {
		await start()
		const agent = request(app.getHttpServer())
		await agent.get(RECIPES_URL).expect(401)
		await agent.get(recipeUrl(UNKNOWN_ID)).expect(401)
		await agent
			.post(`${recipeUrl(UNKNOWN_ID)}/log`)
			.send({ share: 1 })
			.expect(401)
		await agent.delete(recipeUrl(UNKNOWN_ID)).expect(401)
		await agent.post(`${recipeUrl(UNKNOWN_ID)}/restore`).expect(401)
	})

	describe('list', () => {
		it('sorts by last use then newest, paginates, hides deleted and foreign recipes', async () => {
			await start()
			const owner = await registerUser('owner@kus.app')
			const other = await registerUser('other@kus.app')
			await seedRecipe(owner, 'Старий', { createdAt: new Date('2026-10-01T00:00:00Z') })
			await seedRecipe(owner, 'Новий', { createdAt: new Date('2026-10-05T00:00:00Z') })
			await seedRecipe(owner, 'Нещодавній', {
				createdAt: new Date('2026-09-01T00:00:00Z'),
				lastUsedAt: new Date('2026-10-10T00:00:00Z'),
			})
			await seedRecipe(owner, 'Видалений', { deletedAt: new Date() })
			await seedRecipe(other, 'Чужий')

			const all = listSchema.parse((await owner.agent.get(RECIPES_URL).expect(200)).body)
			expect(all.data.map((recipe) => recipe.name)).toEqual(['Нещодавній', 'Новий', 'Старий'])
			expect(all.meta).toMatchObject({ total: 3, page: 1, totalPages: 1 })
			expect(all.data[0]).toMatchObject({ kcal: 400, portionGrams: 400, usageCount: 0 })

			const page = listSchema.parse(
				(await owner.agent.get(RECIPES_URL).query({ limit: 2, page: 2 }).expect(200)).body,
			)
			expect(page.data.map((recipe) => recipe.name)).toEqual(['Старий'])
			expect(page.meta).toMatchObject({ total: 3, page: 2, limit: 2, totalPages: 2 })
		})

		it('answers 422 on a bad query', async () => {
			await start()
			const owner = await registerUser('owner@kus.app')
			await owner.agent.get(RECIPES_URL).query({ limit: 100000 }).expect(422)
		})
	})

	describe('detail', () => {
		it('returns the cooked weight, ingredients and the three portions', async () => {
			await start()
			const owner = await registerUser('owner@kus.app')
			const recipe = await seedRecipe(owner, 'Борщ')

			const { data } = detailSchema.parse(
				(await owner.agent.get(recipeUrl(recipe.id)).expect(200)).body,
			)

			expect(data).toMatchObject({ id: recipe.id, cookedGrams: 1000, portionGrams: 400 })
			expect(data.ingredients.map((ingredient) => ingredient.name)).toEqual(['Буряк', 'Яловичина'])
			expect(data.portions.map(({ share, grams, kcal }) => [share, grams, kcal])).toEqual([
				[0.5, 200, 200],
				[1, 400, 400],
				[1.5, 600, 600],
			])
		})

		it('answers 404 for a foreign, deleted or unknown recipe and 422 for a bad id', async () => {
			await start()
			const owner = await registerUser('owner@kus.app')
			const other = await registerUser('other@kus.app')
			const foreign = await seedRecipe(other, 'Чужий')
			const deleted = await seedRecipe(owner, 'Видалений', { deletedAt: new Date() })

			for (const id of [foreign.id, deleted.id, UNKNOWN_ID]) {
				expectError(await owner.agent.get(recipeUrl(id)).expect(404), 'RECIPE_NOT_FOUND')
			}
			await owner.agent.get(recipeUrl('not-a-uuid')).expect(422)
		})
	})

	describe('log', () => {
		it('adds a portion to today, links the recipe and counts the use', async () => {
			await start()
			const owner = await registerUser('owner@kus.app')
			const recipe = await seedRecipe(owner, 'Борщ')

			const one = logSchema.parse(
				(
					await owner.agent
						.post(`${recipeUrl(recipe.id)}/log`)
						.send({ share: 1 })
						.expect(200)
				).body,
			).data
			const oneAndHalf = logSchema.parse(
				(
					await owner.agent
						.post(`${recipeUrl(recipe.id)}/log`)
						.send({ share: 1.5 })
						.expect(200)
				).body,
			).data

			expect(one.entry).toMatchObject({
				name: 'Борщ',
				grams: 400,
				kcal: 400,
				source: 'MEMORY',
				confidence: 0.9,
				category: 'soup',
			})
			expect(oneAndHalf.entry).toMatchObject({ grams: 600, kcal: 600 })
			const stored = await prisma.foodEntry.findUniqueOrThrow({ where: { id: one.entry.id } })
			expect(stored).toMatchObject({
				recipeId: recipe.id,
				myFoodId: null,
				sourceMessageId: null,
				userId: owner.userId,
			})
			const used = await prisma.recipe.findUniqueOrThrow({ where: { id: recipe.id } })
			expect(used.usageCount).toBe(2)
			expect(used.lastUsedAt).not.toBeNull()

			// the day (a portion has no chat message) shows both entries and its total
			const day = dayResponse.parse(
				(await owner.agent.get(`/api/v1/days/${one.localDate}`).expect(200)).body,
			).data
			const entries = day.meals.flatMap((meal) => meal.entries)
			expect(entries.map((entry) => entry.id).sort()).toEqual(
				[one.entry.id, oneAndHalf.entry.id].sort(),
			)
			expect(day.meals.some((meal) => meal.type === one.mealType)).toBe(true)
			expect(entries.every((entry) => !entry.canRemember)).toBe(true)
		})

		it('answers 422 on a bad share', async () => {
			await start()
			const owner = await registerUser('owner@kus.app')
			const recipe = await seedRecipe(owner, 'Борщ')
			await owner.agent
				.post(`${recipeUrl(recipe.id)}/log`)
				.send({ share: 2 })
				.expect(422)
			await owner.agent
				.post(`${recipeUrl(recipe.id)}/log`)
				.send({})
				.expect(422)
		})

		it('answers 422 when the portion is over 5000 g and writes nothing', async () => {
			await start()
			const owner = await registerUser('owner@kus.app')
			const recipe = await seedRecipe(owner, 'Каструля', { defaultGrams: 4000 })

			const response = await owner.agent
				.post(`${recipeUrl(recipe.id)}/log`)
				.send({ share: 1.5 })
				.expect(422)

			expectError(response, 'RECIPE_PORTION_INVALID')
			expect(await prisma.foodEntry.count({ where: { userId: owner.userId } })).toBe(0)
		})

		it('answers 404 for a foreign, deleted or unknown recipe and writes nothing', async () => {
			await start()
			const owner = await registerUser('owner@kus.app')
			const other = await registerUser('other@kus.app')
			const foreign = await seedRecipe(other, 'Чужий')
			const deleted = await seedRecipe(owner, 'Видалений', { deletedAt: new Date() })

			for (const id of [foreign.id, deleted.id, UNKNOWN_ID]) {
				const response = await owner.agent
					.post(`${recipeUrl(id)}/log`)
					.send({ share: 1 })
					.expect(404)
				expectError(response, 'RECIPE_NOT_FOUND')
			}
			expect(await prisma.foodEntry.count()).toBe(0)
			expect(
				(await prisma.recipe.findUniqueOrThrow({ where: { id: foreign.id } })).usageCount,
			).toBe(0)
		})
	})

	describe('delete and restore', () => {
		it('soft deletes, hides from the list, restores', async () => {
			await start()
			const owner = await registerUser('owner@kus.app')
			const recipe = await seedRecipe(owner, 'Борщ')

			await owner.agent.delete(recipeUrl(recipe.id)).expect(204)
			expect(
				(await prisma.recipe.findUniqueOrThrow({ where: { id: recipe.id } })).deletedAt,
			).not.toBeNull()
			expect(listSchema.parse((await owner.agent.get(RECIPES_URL).expect(200)).body).data).toEqual(
				[],
			)
			expectError(await owner.agent.delete(recipeUrl(recipe.id)).expect(404), 'RECIPE_NOT_FOUND')

			const restored = itemSchema.parse(
				(await owner.agent.post(`${recipeUrl(recipe.id)}/restore`).expect(200)).body,
			).data
			expect(restored).toMatchObject({ id: recipe.id, name: 'Борщ', kcal: 400 })
			expect(
				listSchema.parse((await owner.agent.get(RECIPES_URL).expect(200)).body).data,
			).toHaveLength(1)
		})

		it('answers 409 on restore when another active recipe has the name', async () => {
			await start()
			const owner = await registerUser('owner@kus.app')
			const old = await seedRecipe(owner, 'Борщ', { deletedAt: new Date() })
			const current = await seedRecipe(owner, 'Борщ')

			const response = await owner.agent.post(`${recipeUrl(old.id)}/restore`).expect(409)

			expect(expectError(response, 'RECIPE_NAME_TAKEN')).toEqual({
				existingId: current.id,
				name: 'Борщ',
			})
			expect(
				(await prisma.recipe.findUniqueOrThrow({ where: { id: old.id } })).deletedAt,
			).not.toBeNull()
		})

		it("answers 404 on another user's recipe and leaves it untouched", async () => {
			await start()
			const owner = await registerUser('owner@kus.app')
			const other = await registerUser('other@kus.app')
			const active = await seedRecipe(other, 'Чужий')
			const deleted = await seedRecipe(other, 'Чужий видалений', { deletedAt: new Date() })

			expectError(await owner.agent.delete(recipeUrl(active.id)).expect(404), 'RECIPE_NOT_FOUND')
			expectError(
				await owner.agent.post(`${recipeUrl(deleted.id)}/restore`).expect(404),
				'RECIPE_NOT_FOUND',
			)
			expect(
				(await prisma.recipe.findUniqueOrThrow({ where: { id: active.id } })).deletedAt,
			).toBeNull()
			expect(
				(await prisma.recipe.findUniqueOrThrow({ where: { id: deleted.id } })).deletedAt,
			).not.toBeNull()
		})
	})
})
