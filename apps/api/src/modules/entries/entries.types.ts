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
	/** The entry was read from a photo; `source` keeps saying how exact the numbers are. */
	fromPhoto: boolean
	/** The meal's day of the entry this one was copied from (a copyRef); absent = not a copy. */
	copiedFromDate?: Date
	/** The «Без деталей» estimate of a closed day; only closing a day sets it. */
	isUndetailed?: boolean
}

export interface MealEntryInput {
	mealType: LoggableMealType
	/** The meal's day, a @db.Date value: the items of one message may go to different days. */
	localDate: Date
	entry: NewFoodEntry
}

export interface LogEntriesParams {
	userId: string
	sourceMessageId: string
	/** When a meal created by this log was eaten; an existing meal keeps its time. */
	getEatenAt: (meal: { type: LoggableMealType; localDate: Date }) => Date
	/** In the model's item order; a whole day may span several meals. */
	entries: MealEntryInput[]
}
