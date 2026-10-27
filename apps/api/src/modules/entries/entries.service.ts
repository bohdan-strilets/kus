import { Injectable } from '@nestjs/common'
import {
	type DayMealContext,
	type EntryWasContext,
	type LoggedMeal,
	MAX_CONTEXT_DELETED_ENTRIES,
	MAX_CONTEXT_ENTRIES,
	type NutritionTotals,
} from '@kus/shared'

import { formatDbDate } from '../../common/time'
import type { Prisma } from '../../generated/prisma/client'
import {
	roundNutrition,
	sumEntries,
	toDayMeal,
	toDayMealContext,
	toLoggedMeal,
} from './entries.mapper'
import {
	EntriesRepository,
	type EntryWithMealType,
	type MealWithEntries,
} from './entries.repository'
import { getMealRank } from './entries.constants'
import { toValuesBefore } from './entry-values-before'
import type { LogEntriesParams, MealEntryInput, NewFoodEntry } from './entries.types'

const roundEntry = (entry: NewFoodEntry): NewFoodEntry => ({
	...entry,
	grams: roundNutrition(entry.grams),
	kcal: roundNutrition(entry.kcal),
	protein: roundNutrition(entry.protein),
	fat: roundNutrition(entry.fat),
	carbs: roundNutrition(entry.carbs),
	fiber: entry.fiber === null ? null : roundNutrition(entry.fiber),
})

interface MealGroup {
	mealType: MealEntryInput['mealType']
	localDate: Date
	/** `index` is the position in the input. */
	group: { index: number; entry: NewFoodEntry }[]
}

/** One group per (day, meal type): earlier days first, each day in its course. */
const groupByMeal = (entries: MealEntryInput[]): MealGroup[] => {
	const groups = new Map<string, MealGroup>()
	entries.forEach(({ mealType, localDate, entry }, index) => {
		const key = `${formatDbDate(localDate)}|${mealType}`
		const existing = groups.get(key)
		if (existing) existing.group.push({ index, entry })
		else groups.set(key, { mealType, localDate, group: [{ index, entry }] })
	})
	return [...groups.values()].sort(
		(a, b) =>
			a.localDate.getTime() - b.localDate.getTime() ||
			getMealRank(a.mealType) - getMealRank(b.mealType),
	)
}

export interface DaySummary {
	totals: NutritionTotals
	meals: DayMealContext[]
}

export interface DayTotals {
	kcal: number
	proteinG: number
	entryCount: number
}

@Injectable()
export class EntriesService {
	constructor(private readonly entriesRepository: EntriesRepository) {}

	/**
	 * Adds each entry to the day's meal of its type (created on first use). Runs inside the
	 * caller's tx. `entryIds` follow the input order, so clarify item indexes still map.
	 */
	async logEntries(
		{ userId, sourceMessageId, getEatenAt, entries }: LogEntriesParams,
		tx: Prisma.TransactionClient,
	): Promise<{ meals: LoggedMeal[]; entryIds: string[] }> {
		const entryIds: string[] = []
		const meals: LoggedMeal[] = []
		for (const { mealType, localDate, group } of groupByMeal(entries)) {
			const meal = await this.entriesRepository.findOrCreateMeal(
				{
					userId,
					type: mealType,
					localDate,
					eatenAt: getEatenAt({ type: mealType, localDate }),
					sourceMessageId,
				},
				tx,
			)
			const created = await this.entriesRepository.createEntries(
				{
					userId,
					mealId: meal.id,
					sourceMessageId,
					entries: group.map(({ entry }) => roundEntry(entry)),
				},
				tx,
			)
			group.forEach(({ index }, position) => {
				const id = created[position]?.id
				// clarify links rely on this order; a mismatch must fail, not leave a hole
				if (!id) throw new Error('Created entries do not match the input')
				entryIds[index] = id
			})
			const withEntries = await this.entriesRepository.findMealWithEntries(
				{ userId, mealId: meal.id },
				tx,
			)
			// the meal was found or created a moment ago in this same transaction
			if (!withEntries) throw new Error('Meal disappeared inside its own transaction')
			meals.push(toLoggedMeal(withEntries, sourceMessageId))
		}
		return { meals, entryIds }
	}

	async getDaySummary(userId: string, localDate: Date): Promise<DaySummary> {
		const meals = await this.findDayMealsInOrder(userId, localDate)
		return {
			totals: sumEntries(meals.flatMap((meal) => meal.entries)),
			meals: meals.map(toDayMealContext),
		}
	}

	/** Per `YYYY-MM-DD` of the range: the kcal summed by the backend and how many entries. */
	async getDaysKcal(
		userId: string,
		range: { from: Date; to: Date },
		tx?: Prisma.TransactionClient,
	): Promise<Map<string, { kcal: number; entryCount: number }>> {
		const totals = await this.getDaysTotals(userId, range, tx)
		return new Map(
			[...totals].map(([localDate, { kcal, entryCount }]) => [localDate, { kcal, entryCount }]),
		)
	}

	/** Per `YYYY-MM-DD` of the range with entries: kcal and protein summed by the backend, and the entry count. */
	async getDaysTotals(
		userId: string,
		{ from, to }: { from: Date; to: Date },
		tx?: Prisma.TransactionClient,
	): Promise<Map<string, DayTotals>> {
		const entries = await this.entriesRepository.findRangeEntries({ userId, from, to }, tx)
		const days = new Map<string, DayTotals>()
		for (const entry of entries) {
			const localDate = formatDbDate(entry.meal.localDate)
			const day = days.get(localDate) ?? { kcal: 0, proteinG: 0, entryCount: 0 }
			days.set(localDate, {
				kcal: day.kcal + entry.kcal,
				proteinG: day.proteinG + entry.proteinG,
				entryCount: day.entryCount + 1,
			})
		}
		return new Map(
			[...days].map(([localDate, day]) => [
				localDate,
				{ ...day, kcal: roundNutrition(day.kcal), proteinG: roundNutrition(day.proteinG) },
			]),
		)
	}

	/** «Сьогодні»: the day's meals with all their entries and the day totals. */
	async getDayMeals(
		userId: string,
		localDate: Date,
		tx?: Prisma.TransactionClient,
	): Promise<{ meals: LoggedMeal[]; totals: NutritionTotals }> {
		const meals = await this.findDayMealsInOrder(userId, localDate, tx)
		return {
			meals: meals.map(toDayMeal),
			totals: sumEntries(meals.flatMap((meal) => meal.entries)),
		}
	}

	/**
	 * What the model may change: the day's newest active entries and the last deleted ones. With
	 * `otherDays`, entries of the neighbouring days that were logged since `createdSince` join them.
	 */
	async getEditableEntries(
		userId: string,
		localDate: Date,
		otherDays?: { from: Date; to: Date; createdSince: Date },
	): Promise<{
		active: EntryWithMealType[]
		deleted: EntryWithMealType[]
		/** Every entry of the day before the context limits: tells which messages logged something. */
		sourceMessages: { id: string; sourceMessageId: string | null }[]
	}> {
		const entries = await this.entriesRepository.findDayEntries({ userId, localDate, otherDays })
		const deleted = entries.flatMap((entry) =>
			entry.deletedAt === null ? [] : [{ entry, deletedAt: entry.deletedAt.getTime() }],
		)
		return {
			active: entries.filter((entry) => entry.deletedAt === null).slice(-MAX_CONTEXT_ENTRIES),
			deleted: deleted
				.sort((a, b) => b.deletedAt - a.deletedAt)
				.slice(0, MAX_CONTEXT_DELETED_ENTRIES)
				.map(({ entry }) => entry),
			sourceMessages: entries.map(({ id, sourceMessageId }) => ({ id, sourceMessageId })),
		}
	}

	/** What edited entries held before their changes; an entry with nothing to restore is missing. */
	async getValuesBefore(
		userId: string,
		entryIds: string[],
	): Promise<ReadonlyMap<string, EntryWasContext>> {
		if (entryIds.length === 0) return new Map()
		return toValuesBefore(await this.entriesRepository.findCorrections({ userId, entryIds }))
	}

	/** The user's own active entries by id; anything else (another user's, deleted) is simply missing. */
	findActiveEntriesByIds(
		userId: string,
		ids: string[],
		tx?: Prisma.TransactionClient,
	): Promise<EntryWithMealType[]> {
		if (ids.length === 0) return Promise.resolve([])
		return this.entriesRepository.findActiveEntries({ userId, ids }, tx)
	}

	/** Active entries of one day, oldest first (the candidates of a «як вчора» message). */
	findDayEntries(userId: string, localDate: Date, take: number): Promise<EntryWithMealType[]> {
		return this.entriesRepository.findActiveDayEntriesWithMeal({ userId, localDate, take })
	}

	/** Active entries of a range, newest first; the caller narrows them down (by the food's name). */
	findRecentEntries(
		userId: string,
		range: { from: Date; to: Date },
		take: number,
	): Promise<EntryWithMealType[]> {
		return this.entriesRepository.findActiveRangeEntriesWithMeal({ userId, ...range, take })
	}

	/** Non-empty meals by the day's course: a whole day logged at once shares one eatenAt. */
	private async findDayMealsInOrder(
		userId: string,
		localDate: Date,
		tx?: Prisma.TransactionClient,
	): Promise<MealWithEntries[]> {
		const meals = await this.entriesRepository.findDayMeals({ userId, localDate }, tx)
		return meals
			.filter((meal) => meal.entries.length > 0)
			.sort((a, b) => getMealRank(a.type) - getMealRank(b.type))
	}

	/** The edited messages and every other message whose card tells the same meal's kcal. */
	async getMessagesSharingMeals(userId: string, messageIds: string[]): Promise<string[]> {
		if (messageIds.length === 0) return []
		const shared = await this.entriesRepository.findSourceMessagesOfSameMeals({
			userId,
			messageIds,
		})
		return [...new Set([...messageIds, ...shared])]
	}

	/** Chat cards: for each source message, the meals it logged into, in the day's order. */
	async getLoggedMealsByMessage(
		userId: string,
		messageIds: string[],
	): Promise<Map<string, LoggedMeal[]>> {
		const result = new Map<string, LoggedMeal[]>()
		if (messageIds.length === 0) return result
		const meals = await this.entriesRepository.findMealsBySourceMessages({ userId, messageIds })
		const ordered = [...meals].sort(
			(a, b) =>
				a.localDate.getTime() - b.localDate.getTime() || getMealRank(a.type) - getMealRank(b.type),
		)
		for (const meal of ordered) {
			const sources = new Set(meal.entries.map((entry) => entry.sourceMessageId))
			for (const messageId of messageIds) {
				if (!sources.has(messageId)) continue
				result.set(messageId, [...(result.get(messageId) ?? []), toLoggedMeal(meal, messageId)])
			}
		}
		return result
	}
}
