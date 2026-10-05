// Local demo data: `pnpm db:seed`. Idempotent — deletes the demo user (cascade) and recreates it.
import 'dotenv/config'

import { Logger } from '@nestjs/common'
import { PrismaPg } from '@prisma/adapter-pg'

import {
	ActivityLevel,
	FactCategory,
	FactStatus,
	FoodSource,
	GoalType,
	type Prisma,
	PrismaClient,
} from '../src/generated/prisma/client'
import { seedTodayChat } from './seed-chat'
import {
	DEMO_EMAIL,
	DEMO_FOODS,
	DEMO_PAST_MEALS,
	DEMO_RECIPES,
	DEMO_TIMEZONE,
	DEMO_WEIGHTS,
	type DemoFoodKey,
	type DemoMealItem,
	type DemoRecipeKey,
	type Macros,
} from './seed-data'
import {
	getLocalDate,
	getUtcTimeOnLocalDate,
	normalizeName,
	scaleMacros,
	sumMacros,
} from './seed-utils'

// many sequential inserts; the default 5 s interactive-transaction timeout is too tight on a cold DB
const SEED_TRANSACTION_TIMEOUT_MS = 30_000

const LOCAL_DB_HOSTS = new Set(['localhost', '127.0.0.1', '::1', '[::1]'])

const logger = new Logger('Seed')

type IdMaps = {
	foodIds: Record<DemoFoodKey, string>
	recipeIds: Record<DemoRecipeKey, string>
}

const getRecipeTotals = (key: DemoRecipeKey): Macros =>
	sumMacros(
		DEMO_RECIPES[key].ingredients.map(({ food, grams }) =>
			scaleMacros(DEMO_FOODS[food].per100g, grams / 100),
		),
	)

const toEntryInput = (
	userId: string,
	item: DemoMealItem,
	ids: IdMaps,
): Prisma.FoodEntryCreateManyMealInput => {
	if (item.kind === 'food') {
		const food = DEMO_FOODS[item.food]
		return {
			userId,
			name: food.name,
			grams: item.grams,
			quantity: item.quantity ?? null,
			...scaleMacros(food.per100g, item.grams / 100),
			source: FoodSource.MEMORY,
			confidence: 0.95,
			myFoodId: ids.foodIds[item.food],
		}
	}
	if (item.kind === 'recipe') {
		const recipe = DEMO_RECIPES[item.recipe]
		return {
			userId,
			name: recipe.name,
			grams: item.grams,
			...scaleMacros(getRecipeTotals(item.recipe), item.grams / recipe.cookedGrams),
			source: FoodSource.MEMORY,
			confidence: 0.9,
			recipeId: ids.recipeIds[item.recipe],
		}
	}
	return {
		userId,
		name: item.name,
		grams: item.grams,
		...item.macros,
		source: FoodSource.ESTIMATE,
		confidence: item.confidence,
		assumption: item.assumption,
	}
}

const seedUser = async (tx: Prisma.TransactionClient): Promise<string> => {
	// no AuthCredentials: password hashing (argon2) arrives with the auth module, so the demo user can't log in yet
	const user = await tx.user.create({
		data: {
			email: DEMO_EMAIL,
			name: 'Демо',
			timezone: DEMO_TIMEZONE,
			profile: {
				create: { heightCm: 178, birthYear: 1992, activityLevel: ActivityLevel.MODERATE },
			},
			goals: {
				create: [
					{
						type: GoalType.MAINTAIN,
						dailyKcal: 2200,
						proteinG: 110,
						fatG: 75,
						carbsG: 270,
						validFrom: getLocalDate(30),
					},
					{
						type: GoalType.LOSE,
						targetWeightKg: 72,
						dailyKcal: 1900,
						proteinG: 130,
						fatG: 60,
						carbsG: 200,
						validFrom: getLocalDate(10),
					},
				],
			},
			weightEntries: {
				create: DEMO_WEIGHTS.map(({ daysAgo, weightKg }) => ({
					weightKg,
					measuredAt: getUtcTimeOnLocalDate(daysAgo, 5),
					localDate: getLocalDate(daysAgo),
				})),
			},
			facts: {
				create: [
					{
						text: 'Не їсть свинину',
						category: FactCategory.RESTRICTION,
						status: FactStatus.CONFIRMED,
					},
					{
						text: 'Зазвичай снідає вівсянкою з молоком',
						category: FactCategory.HABIT,
						status: FactStatus.PROPOSED,
					},
				],
			},
		},
	})
	return user.id
}

const seedMemory = async (tx: Prisma.TransactionClient, userId: string): Promise<IdMaps> => {
	const foodIds = {} as Record<DemoFoodKey, string>
	for (const [key, food] of Object.entries(DEMO_FOODS) as [
		DemoFoodKey,
		(typeof DEMO_FOODS)[DemoFoodKey],
	][]) {
		const { per100g, ...rest } = food
		const created = await tx.myFood.create({
			data: {
				...rest,
				userId,
				nameNormalized: normalizeName(food.name),
				aliases: food.aliases.map(normalizeName),
				kcalPer100g: per100g.kcal,
				proteinPer100g: per100g.proteinG,
				fatPer100g: per100g.fatG,
				carbsPer100g: per100g.carbsG,
				fiberPer100g: per100g.fiberG,
			},
		})
		foodIds[key] = created.id
	}

	const recipeIds = {} as Record<DemoRecipeKey, string>
	for (const [key, recipe] of Object.entries(DEMO_RECIPES) as [
		DemoRecipeKey,
		(typeof DEMO_RECIPES)[DemoRecipeKey],
	][]) {
		const created = await tx.recipe.create({
			data: {
				userId,
				name: recipe.name,
				nameNormalized: normalizeName(recipe.name),
				aliases: recipe.aliases.map(normalizeName),
				cookedGrams: recipe.cookedGrams,
				defaultGrams: recipe.defaultGrams,
				ingredients: {
					create: recipe.ingredients.map(({ food, grams }, position) => ({
						name: DEMO_FOODS[food].name,
						grams,
						position,
						myFoodId: foodIds[food],
						...scaleMacros(DEMO_FOODS[food].per100g, grams / 100),
					})),
				},
			},
		})
		recipeIds[key] = created.id
	}
	return { foodIds, recipeIds }
}

const seedPastMeals = async (
	tx: Prisma.TransactionClient,
	userId: string,
	ids: IdMaps,
): Promise<void> => {
	for (const meal of DEMO_PAST_MEALS) {
		await tx.meal.create({
			data: {
				userId,
				type: meal.type,
				eatenAt: getUtcTimeOnLocalDate(meal.daysAgo, meal.utcHour),
				localDate: getLocalDate(meal.daysAgo),
				entries: {
					createMany: { data: meal.items.map((item) => toEntryInput(userId, item, ids)) },
				},
			},
		})
	}
}

const seed = async (prisma: PrismaClient): Promise<void> => {
	await prisma.$transaction(
		async (tx) => {
			await tx.user.deleteMany({ where: { email: DEMO_EMAIL } })
			const userId = await seedUser(tx)
			const ids = await seedMemory(tx, userId)
			await seedPastMeals(tx, userId, ids)
			await seedTodayChat(tx, userId, ids.foodIds)
		},
		{ timeout: SEED_TRANSACTION_TIMEOUT_MS },
	)
}

const main = async (): Promise<void> => {
	if (process.env.NODE_ENV === 'production') {
		throw new Error('Seed is for local development only')
	}
	const connectionString = process.env.DATABASE_URL
	if (!connectionString) {
		throw new Error('DATABASE_URL is not set')
	}
	// guards against a remote (e.g. Railway) DATABASE_URL left in a local .env: the seed deletes and inserts demo data;
	// a libpq "host" query param overrides the URL host, so it counts as remote too
	const url = new URL(connectionString)
	const isLocalDb = LOCAL_DB_HOSTS.has(url.hostname) && !url.searchParams.has('host')
	if (!isLocalDb && process.env.SEED_ALLOW_REMOTE !== '1') {
		throw new Error('Refusing to seed a non-local database; set SEED_ALLOW_REMOTE=1 to override')
	}
	const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) })
	try {
		await seed(prisma)
		logger.log(`Seeded demo user ${DEMO_EMAIL}`)
	} finally {
		await prisma.$disconnect()
	}
}

main().catch((error: unknown) => {
	logger.error(error)
	process.exitCode = 1
})
