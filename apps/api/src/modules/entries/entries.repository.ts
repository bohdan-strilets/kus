import { Injectable } from '@nestjs/common'

import type { FoodEntry, Meal, Prisma } from '../../generated/prisma/client'
import { PrismaService } from '../../prisma'
import type { EntryValues, LoggableMealType } from '@kus/shared'

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

	findActiveEntries(
		{ userId, ids }: { userId: string; ids: string[] },
		tx: Prisma.TransactionClient,
	): Promise<FoodEntry[]> {
		return tx.foodEntry.findMany({
			where: { id: { in: ids }, userId, deletedAt: null },
			orderBy: { createdAt: 'asc' },
		})
	}

	async updateValues(
		{ userId, id, values }: { userId: string; id: string; values: EntryValues },
		tx: Prisma.TransactionClient,
	): Promise<void> {
		await tx.foodEntry.updateMany({
			where: { id, userId, deletedAt: null },
			data: {
				grams: values.grams,
				kcal: values.kcal,
				proteinG: values.protein,
				fatG: values.fat,
				carbsG: values.carbs,
				fiberG: values.fiber,
			},
		})
	}

	async createCorrections(
		corrections: {
			userId: string
			foodEntryId: string
			before: Prisma.InputJsonObject
			after: Prisma.InputJsonObject
		}[],
		tx: Prisma.TransactionClient,
	): Promise<void> {
		await tx.correction.createMany({ data: corrections })
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
