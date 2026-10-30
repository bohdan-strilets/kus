import type { MyFoodResponse } from '@kus/shared'

import type { MyFood } from '../../generated/prisma/client'

export const toMyFoodResponse = (food: MyFood): MyFoodResponse => ({
	id: food.id,
	name: food.name,
	brand: food.brand,
	aliases: food.aliases,
	per100g: {
		kcal: food.kcalPer100g,
		protein: food.proteinPer100g,
		fat: food.fatPer100g,
		carbs: food.carbsPer100g,
		fiber: food.fiberPer100g,
	},
	pieceGrams: food.pieceGrams,
	defaultGrams: food.defaultGrams,
	category: food.category,
	source: food.source,
	updatedAt: food.updatedAt.toISOString(),
})
