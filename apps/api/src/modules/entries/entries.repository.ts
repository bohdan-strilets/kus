import { Injectable } from '@nestjs/common'

import type { FoodEntry, Meal, Prisma } from '../../generated/prisma/client'
import { PrismaService } from '../../prisma'
import type { LoggableMealType } from '@kus/shared'

import type { NewFoodEntry } from './entries.types'

export type MealWithEntries = Meal & { entries: FoodEntry[] }

export type EntryWithMealType = FoodEntry & { meal: Pick<Meal, 'type'> }

interface FindOrCreateMealData {
	userId: string
	type: LoggableMealType
	localDate: Date
	eatenAt: Date
	sourceMessageId: string
}

// entries of one message share createdAt: the id keeps their order stable across updates
const ACTIVE_ENTRIES = {
	where: { deletedAt: null },
	orderBy: [{ createdAt: 'asc' as const }, { id: 'asc' as const }],
}

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

	findDeletedEntries(
		{ userId, ids }: { userId: string; ids: string[] },
		tx: Prisma.TransactionClient,
	): Promise<FoodEntry[]> {
		return tx.foodEntry.findMany({
			where: { id: { in: ids }, userId, deletedAt: { not: null } },
			orderBy: { createdAt: 'asc' },
		})
	}

	/** Every entry of the day's active meals, deleted ones too, oldest first. */
	findDayEntries({
		userId,
		localDate,
	}: {
		userId: string
		localDate: Date
	}): Promise<EntryWithMealType[]> {
		return this.prisma.foodEntry.findMany({
			where: { userId, meal: { localDate, deletedAt: null } },
			include: { meal: { select: { type: true } } },
			// the id keeps e1…eN stable among the entries of one message
			orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
		})
	}

	async updateEntry(
		{
			userId,
			id,
			data,
		}: { userId: string; id: string; data: Prisma.FoodEntryUpdateManyMutationInput },
		tx: Prisma.TransactionClient,
	): Promise<boolean> {
		const { count } = await tx.foodEntry.updateMany({
			where: { id, userId, deletedAt: null },
			data,
		})
		return count === 1
	}

	/** Soft delete (a date) or restore (null); only rows in the opposite state, so a repeat is a no-op. */
	async setDeletedAt(
		{ userId, ids, deletedAt }: { userId: string; ids: string[]; deletedAt: Date | null },
		tx: Prisma.TransactionClient,
	): Promise<number> {
		const { count } = await tx.foodEntry.updateMany({
			where: { id: { in: ids }, userId, deletedAt: deletedAt === null ? { not: null } : null },
			data: { deletedAt },
		})
		return count
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

	/**
	 * Messages with active entries in the meals these messages logged into (deleted entries count
	 * for the link): every chat card of such a meal shows its totals.
	 */
	async findSourceMessagesOfSameMeals(
		{ userId, messageIds }: { userId: string; messageIds: string[] },
		tx?: Prisma.TransactionClient,
	): Promise<string[]> {
		const entries = await (tx ?? this.prisma).foodEntry.findMany({
			where: {
				userId,
				deletedAt: null,
				sourceMessageId: { not: null },
				meal: { userId, entries: { some: { sourceMessageId: { in: messageIds } } } },
			},
			select: { sourceMessageId: true },
			distinct: ['sourceMessageId'],
		})
		return entries.flatMap((entry) => entry.sourceMessageId ?? [])
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
