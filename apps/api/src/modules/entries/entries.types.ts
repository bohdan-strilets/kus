import type { LoggableMealType } from '@kus/shared'

import type { FoodCategory, FoodSource } from '../../generated/prisma/client'

/** Values already validated and, for memory items, recomputed by the backend. */
export interface NewFoodEntry {
	name: string
	grams: number
	quantity: number | null
	kcal: number
	protein: number
	fat: number
	carbs: number
	fiber: number | null
	category: FoodCategory
	source: FoodSource
	confidence: number
	assumption: string | null
	myFoodId: string | null
}

export interface MealEntryInput {
	mealType: LoggableMealType
	entry: NewFoodEntry
}

export interface LogEntriesParams {
	userId: string
	sourceMessageId: string
	/** When a meal created by this log was eaten; an existing meal keeps its time. */
	getEatenAt: (mealType: LoggableMealType) => Date
	localDate: Date
	/** In the model's item order; a whole day may span several meals. */
	entries: MealEntryInput[]
}
