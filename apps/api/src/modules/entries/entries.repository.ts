import { Injectable } from '@nestjs/common'

import type { FoodEntry, Meal, Prisma } from '../../generated/prisma/client'
import { PrismaService } from '../../prisma'
import type { LoggableMealType } from '@kus/shared'

import type { NewFoodEntry } from './entries.types'

export type MealWithEntries = Meal & { entries: FoodEntry[] }

interface FindOrCreateMealData {
	userId: string
	type: LoggableMealType
	localDate: Date
	eatenAt: Date
	sourceMessageId: string
}

const ACTIVE_ENTRIES = { where: { deletedAt: null }, orderBy: { createdAt: 'asc' } } as const

@Injectable()
export class EntriesRepository {
	constructor(private readonly prisma: PrismaService) {}

	/**
	 * One active meal per day + type. Meals have a partial unique, so no upsert (docs/database.md):
	 * createMany + skipDuplicates sends ON CONFLICT DO NOTHING without a target, which also honours
	 * the partial index and doesn't abort the transaction; then the active row is read back.
	 */
	async findOrCreateMeal(data: FindOrCreateMealData, tx: Prisma.TransactionClient): Promise<Meal> {
		await tx.meal.createMany({ data: [data], skipDuplicates: true })
		return tx.meal.findFirstOrThrow({
			where: { userId: data.userId, localDate: data.localDate, type: data.type, deletedAt: null },
		})
	}

	createEntries(
		{
			userId,
			mealId,
			sourceMessageId,
			entries,
		}: { userId: string; mealId: string; sourceMessageId: string; entries: NewFoodEntry[] },
		tx: Prisma.TransactionClient,
	): Promise<FoodEntry[]> {
		return tx.foodEntry.createManyAndReturn({
			data: entries.map(({ protein, fat, carbs, fiber, ...entry }) => ({
				...entry,
				userId,
				mealId,
				sourceMessageId,
				proteinG: protein,
				fatG: fat,
				carbsG: carbs,
				fiberG: fiber,
			})),
		})
	}

	findMealWithEntries(
		{ userId, mealId }: { userId: string; mealId: string },
		tx?: Prisma.TransactionClient,
	): Promise<MealWithEntries | null> {
		return (tx ?? this.prisma).meal.findFirst({
			where: { id: mealId, userId, deletedAt: null },
			include: { entries: ACTIVE_ENTRIES },
		})
	}

	findDayMeals(
		{ userId, localDate }: { userId: string; localDate: Date },
		tx?: Prisma.TransactionClient,
	): Promise<MealWithEntries[]> {
		return (tx ?? this.prisma).meal.findMany({
			where: { userId, localDate, deletedAt: null },
			include: { entries: ACTIVE_ENTRIES },
			orderBy: { eatenAt: 'asc' },
		})
	}

	/** Meals that got entries from these messages, with all their active entries. */
	findMealsBySourceMessages(
		{ userId, messageIds }: { userId: string; messageIds: string[] },
		tx?: Prisma.TransactionClient,
	): Promise<MealWithEntries[]> {
		return (tx ?? this.prisma).meal.findMany({
			where: {
				userId,
				deletedAt: null,
				entries: { some: { sourceMessageId: { in: messageIds }, deletedAt: null } },
			},
			include: { entries: ACTIVE_ENTRIES },
		})
	}
}
