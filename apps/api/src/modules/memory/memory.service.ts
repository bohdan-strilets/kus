import { Injectable } from '@nestjs/common'
import { isFoodMentioned, MEMORY_MAX_FOODS, type MemoryFoodContext } from '@kus/shared'

import type { FoodCategory, MyFood, Prisma } from '../../generated/prisma/client'
import { MemoryRepository } from './memory.repository'

const GRAMS_PER_100 = 100
const MEMORY_REF_PREFIX = 'm'

export interface RelevantFoods {
	/** What the model sees: refs instead of ids. */
	context: MemoryFoodContext[]
	/** ref → the user's own food; the only way a model ref turns into a database id. */
	byRef: Map<string, MyFood>
}

export interface PortionValues {
	kcal: number
	protein: number
	fat: number
	carbs: number
	fiber: number | null
	category: FoodCategory
}

const toContext = (food: MyFood, ref: string): MemoryFoodContext => ({
	ref,
	name: food.name,
	aliases: food.aliases,
	per100g: {
		kcal: food.kcalPer100g,
		protein: food.proteinPer100g,
		fat: food.fatPer100g,
		carbs: food.carbsPer100g,
	},
	pieceGrams: food.pieceGrams,
	defaultGrams: food.defaultGrams,
	category: food.category,
})

@Injectable()
export class MemoryService {
	constructor(private readonly memoryRepository: MemoryRepository) {}

	/** Saved foods mentioned in the message, most used first. */
	async findRelevantFoods(userId: string, text: string): Promise<RelevantFoods> {
		const foods = await this.memoryRepository.findActiveFoods(userId)
		const matched = foods.filter((food) => isFoodMentioned(food, text)).slice(0, MEMORY_MAX_FOODS)
		const byRef = new Map(matched.map((food, index) => [`${MEMORY_REF_PREFIX}${index + 1}`, food]))
		return {
			context: [...byRef].map(([ref, food]) => toContext(food, ref)),
			byRef,
		}
	}

	/**
	 * Values of a saved food for a portion: scaled by the backend from per-100 g data, not taken
	 * from the model; the category is a snapshot of the food's (docs/database.md).
	 */
	getPortionValues(food: MyFood, grams: number): PortionValues {
		const factor = grams / GRAMS_PER_100
		return {
			kcal: food.kcalPer100g * factor,
			protein: food.proteinPer100g * factor,
			fat: food.fatPer100g * factor,
			carbs: food.carbsPer100g * factor,
			fiber: food.fiberPer100g === null ? null : food.fiberPer100g * factor,
			category: food.category,
		}
	}

	async markUsed(
		params: { userId: string; ids: string[]; usedAt: Date },
		tx: Prisma.TransactionClient,
	): Promise<void> {
		if (params.ids.length === 0) return
		await this.memoryRepository.markUsed(params, tx)
	}
}
