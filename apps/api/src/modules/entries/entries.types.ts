import type { FoodCategory, FoodSource, MealType } from '../../generated/prisma/client'

/** OTHER may repeat within a day, so it can't be found-or-created; the chat never logs it. */
export type LoggableMealType = Exclude<MealType, 'OTHER'>

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

export interface LogEntriesParams {
	userId: string
	sourceMessageId: string
	mealType: LoggableMealType
	eatenAt: Date
	localDate: Date
	entries: NewFoodEntry[]
}
