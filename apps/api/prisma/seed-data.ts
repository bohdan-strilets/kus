// Fictional demo data for local development. Never put real personal data here — the repo is public.
import { FoodCategory, MealType, MyFoodSource } from '../src/generated/prisma/client'

export const DEMO_EMAIL = 'demo@kus.local'
export const DEMO_TIMEZONE = 'Europe/Warsaw'
export const DEMO_AI_MODEL = 'demo/model'

export type Macros = {
	kcal: number
	proteinG: number
	fatG: number
	carbsG: number
	fiberG: number | null
}

export type DemoFoodKey =
	'oats' | 'milk' | 'banana' | 'chicken' | 'buckwheat' | 'yogurt' | 'egg' | 'cottageCheese'

export type DemoRecipeKey = 'syrnyky' | 'omelette'

export type DemoFood = {
	name: string
	aliases: string[]
	brand: string | null
	barcode: string | null
	per100g: Macros
	pieceGrams: number | null
	defaultGrams: number | null
	// the icon; entries logged from this food copy it as a snapshot
	category: FoodCategory
	source: MyFoodSource
}

export type DemoRecipe = {
	name: string
	aliases: string[]
	cookedGrams: number
	defaultGrams: number
	category: FoodCategory
	ingredients: { food: DemoFoodKey; grams: number }[]
}

export type DemoMealItem =
	| { kind: 'food'; food: DemoFoodKey; grams: number; quantity?: number }
	| { kind: 'recipe'; recipe: DemoRecipeKey; grams: number }
	| {
			kind: 'estimate'
			name: string
			category: FoodCategory
			grams: number
			macros: Macros
			confidence: number
			assumption: string
	  }

export type DemoMeal = {
	daysAgo: number
	type: MealType
	// hour in UTC; 6–19 UTC stays on the same local day in Europe/Warsaw
	utcHour: number
	items: DemoMealItem[]
}

const macros = (
	kcal: number,
	proteinG: number,
	fatG: number,
	carbsG: number,
	fiberG: number | null = null,
): Macros => ({
	kcal,
	proteinG,
	fatG,
	carbsG,
	fiberG,
})

export const DEMO_FOODS: Record<DemoFoodKey, DemoFood> = {
	oats: {
		name: 'Вівсяні пластівці',
		aliases: ['вівсянка', 'овсянка'],
		brand: 'Демо Злаки',
		barcode: null,
		per100g: macros(366, 12.5, 6.2, 61, 10),
		pieceGrams: null,
		defaultGrams: 60,
		category: FoodCategory.porridge,
		source: MyFoodSource.LABEL,
	},
	milk: {
		name: 'Молоко 2%',
		aliases: ['молоко'],
		brand: null,
		barcode: null,
		per100g: macros(50, 3.4, 2, 4.8),
		pieceGrams: null,
		defaultGrams: 200,
		category: FoodCategory.milk,
		source: MyFoodSource.LABEL,
	},
	banana: {
		name: 'Банан',
		aliases: ['банани'],
		brand: null,
		barcode: null,
		per100g: macros(89, 1.1, 0.3, 22.8, 2.6),
		pieceGrams: 120,
		defaultGrams: 120,
		category: FoodCategory.banana,
		source: MyFoodSource.MANUAL,
	},
	chicken: {
		name: 'Куряче філе (сире)',
		aliases: ['курка', 'філе'],
		brand: null,
		barcode: null,
		per100g: macros(110, 23, 1.5, 0),
		pieceGrams: null,
		defaultGrams: 150,
		category: FoodCategory.poultry,
		source: MyFoodSource.AI,
	},
	buckwheat: {
		name: 'Гречка (суха)',
		aliases: ['гречка', 'гречана крупа'],
		brand: null,
		barcode: null,
		per100g: macros(343, 13.3, 3.4, 71.5, 10),
		pieceGrams: null,
		defaultGrams: 70,
		category: FoodCategory.porridge,
		source: MyFoodSource.LABEL,
	},
	yogurt: {
		name: 'Грецький йогурт 2%',
		aliases: ['йогурт'],
		brand: 'Демо Молочарня',
		// fictional barcode
		barcode: '0000000000017',
		per100g: macros(73, 9.5, 2, 3.8),
		pieceGrams: null,
		defaultGrams: 150,
		category: FoodCategory.yogurt,
		source: MyFoodSource.LABEL,
	},
	egg: {
		name: 'Яйце куряче',
		aliases: ['яйце', 'яйця'],
		brand: null,
		barcode: null,
		per100g: macros(143, 12.6, 9.5, 0.7),
		pieceGrams: 55,
		defaultGrams: 110,
		category: FoodCategory.eggs,
		source: MyFoodSource.MANUAL,
	},
	cottageCheese: {
		name: 'Сир кисломолочний 5%',
		aliases: ['сир', 'творог'],
		brand: null,
		barcode: null,
		per100g: macros(121, 17, 5, 1.8),
		pieceGrams: null,
		defaultGrams: 200,
		category: FoodCategory.cottage_cheese,
		source: MyFoodSource.LABEL,
	},
}

export const DEMO_RECIPES: Record<DemoRecipeKey, DemoRecipe> = {
	syrnyky: {
		name: 'Сирники',
		aliases: ['сирнички'],
		cookedGrams: 480,
		defaultGrams: 160,
		category: FoodCategory.pancakes,
		ingredients: [
			{ food: 'cottageCheese', grams: 400 },
			{ food: 'egg', grams: 55 },
			{ food: 'oats', grams: 40 },
		],
	},
	omelette: {
		name: 'Омлет з молоком',
		aliases: ['омлет'],
		cookedGrams: 240,
		defaultGrams: 240,
		category: FoodCategory.eggs,
		ingredients: [
			{ food: 'egg', grams: 165 },
			{ food: 'milk', grams: 80 },
		],
	},
}

// Today's meals (daysAgo 0) are created by the chat scenario in seed.ts
export const DEMO_PAST_MEALS: DemoMeal[] = [
	{
		daysAgo: 3,
		type: MealType.BREAKFAST,
		utcHour: 6,
		items: [
			{ kind: 'food', food: 'oats', grams: 60 },
			{ kind: 'food', food: 'milk', grams: 200 },
		],
	},
	{
		daysAgo: 3,
		type: MealType.LUNCH,
		utcHour: 11,
		items: [
			{ kind: 'food', food: 'chicken', grams: 150 },
			{ kind: 'food', food: 'buckwheat', grams: 70 },
		],
	},
	{
		daysAgo: 3,
		type: MealType.SNACK,
		utcHour: 14,
		items: [{ kind: 'food', food: 'banana', grams: 120, quantity: 1 }],
	},
	{
		daysAgo: 3,
		type: MealType.DINNER,
		utcHour: 17,
		items: [{ kind: 'food', food: 'yogurt', grams: 150 }],
	},
	{
		daysAgo: 2,
		type: MealType.BREAKFAST,
		utcHour: 7,
		items: [{ kind: 'recipe', recipe: 'syrnyky', grams: 160 }],
	},
	{
		daysAgo: 2,
		type: MealType.LUNCH,
		utcHour: 11,
		items: [
			{ kind: 'food', food: 'chicken', grams: 180 },
			{ kind: 'food', food: 'buckwheat', grams: 80 },
		],
	},
	{
		daysAgo: 2,
		type: MealType.DINNER,
		utcHour: 18,
		items: [{ kind: 'recipe', recipe: 'omelette', grams: 240 }],
	},
	{
		daysAgo: 1,
		type: MealType.BREAKFAST,
		utcHour: 6,
		items: [
			{ kind: 'food', food: 'oats', grams: 50 },
			{ kind: 'food', food: 'milk', grams: 150 },
			{ kind: 'food', food: 'banana', grams: 120, quantity: 1 },
		],
	},
	{
		daysAgo: 1,
		type: MealType.LUNCH,
		utcHour: 12,
		items: [
			{
				kind: 'estimate',
				name: 'Борщ з куркою',
				category: FoodCategory.borscht,
				grams: 350,
				macros: macros(210, 12, 7, 24, 4),
				confidence: 0.6,
				assumption: 'Тарілка ~350 г, без сметани',
			},
		],
	},
	{
		daysAgo: 1,
		type: MealType.DINNER,
		utcHour: 17,
		items: [
			{ kind: 'food', food: 'chicken', grams: 150 },
			{ kind: 'food', food: 'buckwheat', grams: 60 },
		],
	},
]

export const DEMO_WEIGHTS: { daysAgo: number; weightKg: number }[] = [
	{ daysAgo: 8, weightKg: 76.4 },
	{ daysAgo: 6, weightKg: 76.1 },
	{ daysAgo: 4, weightKg: 75.9 },
	{ daysAgo: 2, weightKg: 75.8 },
	{ daysAgo: 0, weightKg: 75.5 },
]
