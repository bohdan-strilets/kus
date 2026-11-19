import { randomUUID } from 'node:crypto'

import { Logger } from '@nestjs/common'
import type { NestExpressApplication } from '@nestjs/platform-express'
import { authSessionResponseSchema, createDataResponseSchema } from '@kus/shared'
import request from 'supertest'
import type TestAgent from 'supertest/lib/agent'
import { afterAll, afterEach, describe, expect, it, vi } from 'vitest'

import {
	createCompletion,
	createFakeAiClient,
	type FakeToolCall,
	logFoodCall,
} from '../src/modules/ai/ai.test-utils'
import { RecipesPotService } from '../src/modules/recipes/recipes-pot.service'
import { RecipesSaveService } from '../src/modules/recipes/recipes-save.service'
import type { PrismaService } from '../src/prisma'
import { createDbTestApp } from './create-db-test-app'

const MESSAGES_URL = '/api/v1/messages'
const DAY_ONE = new Date('2026-11-19T11:00:00Z')
const DAY_TWO = new Date('2026-11-20T11:00:00Z')
const PASSWORD = 'correct-horse-battery'

const fake = createFakeAiClient()

/** 910 g of ingredients, 890 kcal. With 3000 ml of water: 3910 g, 850 g of it ≈ 193.5 kcal. */
const POT = {
	ingredients: [
		{ name: 'Куряче філе', grams: 410, kcal: 450, protein: 90, fat: 6, carbs: 0, fiber: null },
		{ name: 'Картопля', grams: 500, kcal: 440, protein: 10, fat: 1, carbs: 100, fiber: null },
	],
	waterMl: 3000,
	cookedGrams: null,
	servings: null,
}

const item = (overrides: Record<string, unknown> = {}) => ({
	name: 'Суп курячий',
	grams: 850,
	quantity: null,
	// the model's numbers: the backend ignores them for a pot
	kcal: 400,
	protein: 20,
	fat: 10,
	carbs: 30,
	fiber: null,
	category: 'soup',
	source: 'ESTIMATE',
	confidence: 0.5,
	assumption: '≈ 3 л води',
	memoryRef: null,
	copyRef: null,
	recipe: null,
	recipeRef: null,
	...overrides,
})

const reply = (text: string): FakeToolCall => ({ name: 'reply', args: { text } })

const correctPot = (ref: string, waterMl: number): FakeToolCall => ({
	name: 'correct_entry',
	args: {
		changes: [
			{
				ref,
				name: null,
				category: null,
				grams: null,
				values: null,
				recipe: { waterMl, cookedGrams: null },
			},
		],
	},
})

const saveRecipeCall = (overrides: Record<string, unknown>): FakeToolCall => ({
	name: 'save_recipe',
	args: {
		name: 'Суп курячий',
		aliases: [],
		category: 'soup',
		entryRef: null,
		recipe: null,
		portionGrams: null,
		...overrides,
	},
})

interface TestUser {
	agent: TestAgent
	userId: string
	email: string
}

describe('pots and recipes in the chat (e2e, real DB, fake model)', () => {
	let app: NestExpressApplication
	let prisma: PrismaService
	const logSpies = [
		vi.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined),
		vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined),
		vi.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined),
	]

	const start = async (): Promise<void> => {
		fake.reset()
		vi.useFakeTimers({ toFake: ['Date'], now: DAY_ONE })
		;({ app, prisma } = await createDbTestApp({ aiClient: fake.client }))
	}

	const registerUser = async (email: string): Promise<TestUser> => {
		const agent = request.agent(app.getHttpServer())
		const response = await agent
			.post('/api/v1/auth/register')
			.send({ email, password: PASSWORD, name: 'Test', consent: true })
			.expect(201)
		const { user } = createDataResponseSchema(authSessionResponseSchema).parse(response.body).data
		return { agent, userId: user.id, email }
	}

	const send = (user: TestUser, text: string, extra: Record<string, unknown> = {}) =>
		user.agent.post(MESSAGES_URL).send({ clientMessageId: randomUUID(), text, ...extra })

	const sendOk = async (user: TestUser, text: string, extra: Record<string, unknown> = {}) => {
		const response = await send(user, text, extra).expect(201)
		return response.body as unknown
	}

	/** The next day on the clock; the access token of day one is gone by then, as for a real user. */
	const nextDay = async (user: TestUser): Promise<void> => {
		vi.setSystemTime(DAY_TWO)
		await user.agent
			.post('/api/v1/auth/login')
			.send({ email: user.email, password: PASSWORD })
			.expect(200)
	}

	const entriesOf = (user: TestUser) =>
		prisma.foodEntry.findMany({
			where: { userId: user.userId, deletedAt: null },
			orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
		})

	const requestText = (index: number): string => JSON.stringify(fake.bodies[index])

	afterEach(async () => {
		vi.useRealTimers()
		await app.close()
	})

	afterAll(() => {
		for (const spy of logSpies) spy.mockRestore()
	})

	it('pot → another plate → «там було 4 л» → save → another day by the recipe', async () => {
		await start()
		const owner = await registerUser('owner@kus.app')

		// 1. the pot: the backend counts the portion, the model's numbers are not used
		fake.respond(createCompletion([logFoodCall([item({ recipe: POT })])]))
		await sendOk(owner, 'зварив суп: філе 410 г, картопля 500 г, 3 л води, з’їв 850 г')
		const [first] = await entriesOf(owner)
		expect(first?.kcal).toBeCloseTo(193.5, 0)
		expect(first?.potId).toEqual(expect.any(String))
		expect(first?.recipeId).toBeNull()
		expect(first?.recipeDraft).toMatchObject({ waterMl: 3000 })
		expect(first?.source).toBe('ESTIMATE')

		// 2. «ще тарілку»: the copy joins the same pot
		fake.respond(createCompletion([logFoodCall([item({ copyRef: 'e1', grams: 425 })])]))
		await sendOk(owner, 'ще півтарілки')
		expect(requestText(1)).toContain('(pot, recipe not saved)')
		const portions = await entriesOf(owner)
		expect(portions).toHaveLength(2)
		expect(portions[1]?.potId).toBe(first?.potId)
		expect(portions[1]?.kcal).toBeCloseTo(96.8, 0)

		// 3. «там було 4 л»: both portions are recounted, each keeps its grams
		fake.respond(createCompletion([correctPot('e1', 4000), reply('Перерахував')]))
		await sendOk(owner, 'там було 4 л води')
		const [recounted, recountedCopy] = await entriesOf(owner)
		expect(recounted?.kcal).toBeCloseTo(154.1, 0)
		expect(recountedCopy?.kcal).toBeCloseTo(77.1, 0)
		expect(recounted?.isEdited).toBe(true)
		expect(recounted?.recipeDraft).toMatchObject({ waterMl: 4000 })
		expect(recountedCopy?.recipeDraft).toMatchObject({ waterMl: 4000 })
		const corrections = await prisma.correction.findMany({ where: { userId: owner.userId } })
		expect(corrections).toHaveLength(2)

		// 4. «Зберегти рецепт?» «так»: the recipe takes the weight of the portion eaten, both portions link to it
		fake.respond(createCompletion([saveRecipeCall({ entryRef: 'e1' }), reply('Зберіг')]))
		await sendOk(owner, 'так, збережи')
		expect(requestText(3)).toContain('(pot, recipe not saved)')
		const recipe = await prisma.recipe.findFirstOrThrow({
			where: { userId: owner.userId, deletedAt: null },
			include: { ingredients: { orderBy: { position: 'asc' } } },
		})
		expect(recipe.defaultGrams).toBe(850)
		expect(recipe.cookedGrams).toBe(4910)
		expect(recipe.ingredients.map(({ name }) => name)).toEqual(['Куряче філе', 'Картопля'])
		expect(recipe.sourceMessageId).not.toBeNull()
		expect((await entriesOf(owner)).map(({ recipeId }) => recipeId)).toEqual([recipe.id, recipe.id])

		// 5. the next day: «Saved recipes» r1 → the portion is the recipe's, the use is counted
		await nextDay(owner)
		fake.respond(createCompletion([logFoodCall([item({ recipeRef: 'r1', grams: 350 })])]))
		await sendOk(owner, 'суп курячий, 350 г')
		expect(requestText(4)).toContain('r1 \\"Суп курячий\\" portion 850 g')
		const all = await entriesOf(owner)
		const viaRecipe = all[2]
		expect(viaRecipe?.recipeId).toBe(recipe.id)
		expect(viaRecipe?.potId).toBeNull()
		expect(viaRecipe?.recipeDraft).toBeNull()
		expect(viaRecipe?.kcal).toBeCloseTo((890 * 350) / 4910, 0)
		expect(viaRecipe?.source).toBe('MEMORY')
		const used = await prisma.recipe.findUniqueOrThrow({ where: { id: recipe.id } })
		expect(used.usageCount).toBe(1)
		expect(used.lastUsedAt).not.toBeNull()
	})

	it('a correction recounts only its own pot: not another cooking, not another user, not the distant past', async () => {
		await start()
		const owner = await registerUser('owner@kus.app')
		const stranger = await registerUser('stranger@kus.app')
		fake.respond(
			createCompletion([logFoodCall([item({ recipe: POT })])]),
			createCompletion([logFoodCall([item({ name: 'Борщ', recipe: { ...POT, waterMl: 2000 } })])]),
		)
		await sendOk(owner, 'суп')
		await sendOk(owner, 'борщ')
		const [soup, borscht] = await entriesOf(owner)
		const potId = soup?.potId ?? ''
		expect(potId).not.toBe(borscht?.potId)
		// a stranger's entry of the same pot id, and an old portion of the owner's pot
		const seed = async (userId: string, localDate: string, name: string) => {
			const meal = await prisma.meal.create({
				data: {
					userId,
					type: 'DINNER',
					localDate: new Date(`${localDate}T00:00:00Z`),
					eatenAt: new Date(`${localDate}T17:00:00Z`),
				},
			})
			return prisma.foodEntry.create({
				data: {
					userId,
					mealId: meal.id,
					name,
					grams: 500,
					kcal: 114,
					proteinG: 10,
					fatG: 1,
					carbsG: 10,
					source: 'ESTIMATE',
					confidence: 0.5,
					potId,
					recipeDraft: POT,
				},
			})
		}
		const foreign = await seed(stranger.userId, '2026-11-19', 'Чужий суп')
		const old = await seed(owner.userId, '2026-11-05', 'Давній суп')

		fake.respond(createCompletion([correctPot('e1', 4000), reply('Перерахував')]))
		await sendOk(owner, 'там було 4 л води')

		const after = await entriesOf(owner)
		expect(after.find(({ id }) => id === soup?.id)?.kcal).toBeCloseTo(154.1, 0)
		expect(after.find(({ id }) => id === borscht?.id)?.kcal).toBe(borscht?.kcal)
		expect(after.find(({ id }) => id === old.id)?.kcal).toBe(114)
		const untouched = await prisma.foodEntry.findUniqueOrThrow({ where: { id: foreign.id } })
		expect(untouched.kcal).toBe(114)
		expect(untouched.recipeDraft).toMatchObject({ waterMl: 3000 })
		expect(untouched.isEdited).toBe(false)
	})

	it('IDOR: another user cannot recount, save or see the pot or its recipe', async () => {
		await start()
		const owner = await registerUser('owner@kus.app')
		const stranger = await registerUser('stranger@kus.app')
		fake.respond(createCompletion([logFoodCall([item({ recipe: POT })])]))
		await sendOk(owner, 'суп')
		const [entry] = await entriesOf(owner)
		const pots = app.get(RecipesPotService, { strict: false })
		const saves = app.get(RecipesSaveService, { strict: false })

		await expect(
			prisma.$transaction((tx) =>
				pots.correctPot(
					{
						userId: stranger.userId,
						entryId: entry?.id ?? '',
						correction: { waterMl: 5000, cookedGrams: null },
					},
					tx,
				),
			),
		).rejects.toMatchObject({ response: 'POT_NOT_FOUND' })
		await expect(
			prisma.$transaction((tx) =>
				saves.saveFromEntry(
					{
						userId: stranger.userId,
						entryId: entry?.id ?? '',
						identity: { name: 'Чужий суп', aliases: [], category: 'soup' },
						messageId: null,
					},
					tx,
				),
			),
		).rejects.toMatchObject({ response: 'RECIPE_FROM_ENTRY_INVALID' })

		const [same] = await entriesOf(owner)
		expect(same?.kcal).toBe(entry?.kcal)
		expect(same?.recipeId).toBeNull()
		expect(await prisma.recipe.count()).toBe(0)

		// the owner's recipe is the owner's alone
		fake.respond(createCompletion([saveRecipeCall({ entryRef: 'e1' }), reply('Зберіг')]))
		await sendOk(owner, 'збережи')
		const list = await stranger.agent.get('/api/v1/recipes').expect(200)
		expect((list.body as { data: unknown[] }).data).toEqual([])
		fake.respond(createCompletion([reply('Ок')]))
		await sendOk(stranger, 'суп курячий')
		expect(requestText(fake.bodies.length - 1)).not.toContain('Saved recipes (data')
	})

	it('a new recipe from «Новий рецепт» is saved from the ingredients, with its portion, and logs nothing', async () => {
		await start()
		const owner = await registerUser('owner@kus.app')
		fake.respond(
			createCompletion([
				saveRecipeCall({
					name: 'Борщ',
					aliases: ['Борщик'],
					category: 'borscht',
					recipe: POT,
					portionGrams: 350,
				}),
				reply('Записав рецепт'),
			]),
		)

		await sendOk(owner, 'борщ: філе 410 г, картопля 500 г, 3 л води', { intent: 'new_recipe' })

		expect(requestText(0)).toContain('This message comes from «Новий рецепт»')
		const recipe = await prisma.recipe.findFirstOrThrow({ where: { userId: owner.userId } })
		expect(recipe).toMatchObject({ defaultGrams: 350, cookedGrams: 3910, aliases: ['борщик'] })
		expect(await entriesOf(owner)).toHaveLength(0)
	})

	it('the same name replaces the old recipe: the old one is deleted, its usage moves on', async () => {
		await start()
		const owner = await registerUser('owner@kus.app')
		const old = await prisma.recipe.create({
			data: {
				userId: owner.userId,
				name: 'Суп курячий',
				nameNormalized: 'суп курячий',
				cookedGrams: 1000,
				defaultGrams: 300,
				category: 'soup',
				usageCount: 5,
				ingredients: {
					create: [
						{ name: 'Вода', grams: 1, kcal: 0, proteinG: 0, fatG: 0, carbsG: 0, position: 0 },
					],
				},
			},
		})
		fake.respond(createCompletion([logFoodCall([item({ recipe: POT })])]))
		await sendOk(owner, 'суп')
		fake.respond(createCompletion([saveRecipeCall({ entryRef: 'e1' }), reply('Зберіг')]))

		await sendOk(owner, 'збережи, цей рецепт новіший')

		const recipes = await prisma.recipe.findMany({ where: { userId: owner.userId } })
		const active = recipes.filter(({ deletedAt }) => deletedAt === null)
		expect(active).toHaveLength(1)
		expect(active[0]?.id).not.toBe(old.id)
		expect(active[0]?.usageCount).toBe(5)
		expect(recipes.find(({ id }) => id === old.id)?.deletedAt).not.toBeNull()
		const [entry] = await entriesOf(owner)
		expect(entry?.recipeId).toBe(active[0]?.id)
	})

	it('the water asked by clarify: a tapped answer recounts the pot, «Не знаю» keeps the estimate', async () => {
		await start()
		const owner = await registerUser('owner@kus.app')
		const option = (label: string, kcal: number, waterMl: number | null) => ({
			label,
			kcal,
			protein: 0,
			fat: 0,
			carbs: kcal / 4,
			fiber: null,
			grams: null,
			name: null,
			waterMl,
		})
		const clarify: FakeToolCall = {
			name: 'clarify',
			args: {
				question: 'Скільки води було в каструлі?',
				itemIndexes: [0],
				options: [
					option('1–2 л', 100, 1500),
					option('4–5 л', 330, 4500),
					option('Не знаю', 190, null),
				],
			},
		}
		const ask = async () => {
			fake.respond(createCompletion([logFoodCall([item({ recipe: POT })]), clarify]))
			const body = (await sendOk(owner, 'суп, води не знаю')) as {
				data: { assistantMessage: { clarifications: { id: string }[] } }
			}
			const [clarification] = body.data.assistantMessage.clarifications
			return clarification?.id ?? ''
		}

		const first = await ask()
		await owner.agent
			.post(`/api/v1/clarifications/${first}/answer`)
			.send({ optionIndex: 0 })
			.expect(200)
		const [afterWater] = await entriesOf(owner)
		// 850 g of (910 g + 1500 ml): 890 × 850 / 2410
		expect(afterWater?.kcal).toBeCloseTo(313.9, 0)
		expect(afterWater?.recipeDraft).toMatchObject({ waterMl: 1500 })

		const second = await ask()
		await owner.agent
			.post(`/api/v1/clarifications/${second}/answer`)
			.send({ optionIndex: 2 })
			.expect(200)
		const [, afterUnknown] = await entriesOf(owner)
		expect(afterUnknown?.kcal).toBeCloseTo(193.5, 0)
		expect(afterUnknown?.recipeDraft).toMatchObject({ waterMl: 3000 })
	})

	it('«Запам’ятати» on a pot portion saves a recipe, never a food', async () => {
		await start()
		const owner = await registerUser('owner@kus.app')
		fake.respond(createCompletion([logFoodCall([item({ recipe: POT })])]))
		await sendOk(owner, 'суп')
		const [entry] = await entriesOf(owner)

		const response = await owner.agent
			.post('/api/v1/my-foods/from-entries')
			.send({ entryIds: [entry?.id] })
			.expect(201)

		const data = (
			response.body as { data: { created: unknown[]; createdRecipes: { name: string }[] } }
		).data
		expect(data.created).toEqual([])
		expect(data.createdRecipes).toEqual([expect.objectContaining({ name: 'Суп курячий' })])
		expect(await prisma.myFood.count({ where: { userId: owner.userId } })).toBe(0)
		const recipe = await prisma.recipe.findFirstOrThrow({ where: { userId: owner.userId } })
		expect(recipe.defaultGrams).toBe(850)
		expect((await entriesOf(owner))[0]?.recipeId).toBe(recipe.id)
	})
})
