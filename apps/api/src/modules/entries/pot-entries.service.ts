import { Injectable } from '@nestjs/common'
import { ENTRY_BACKDATE_MAX_DAYS, getRecipePortionValues, type RecipeDraft } from '@kus/shared'

import { addDays } from '../../common/time'
import type { Prisma } from '../../generated/prisma/client'
import { roundNutrition } from './entries.mapper'
import { EntriesRepository, type EntryWithMealType } from './entries.repository'
import { PotEntriesRepository } from './pot-entries.repository'

/** What a recount changed: the messages whose cards show the portions, and the recipes they belong to. */
export interface PotRecount {
	sourceMessageIds: string[]
	recipeIds: string[]
}

/** Portions of one cooking are looked for this many days before the entry the chat pointed at, and after it. */
const getWindowStart = (entry: Pick<EntryWithMealType, 'meal'>): Date =>
	addDays(entry.meal.localDate, -ENTRY_BACKDATE_MAX_DAYS)

/** The entries of a pot (`pot_id`): the same cooking eaten more than once, kept in step. */
@Injectable()
export class PotEntriesService {
	constructor(
		private readonly entriesRepository: EntriesRepository,
		private readonly potEntriesRepository: PotEntriesRepository,
	) {}

	/** The active portions of the pot `entry` belongs to, the entry itself included; none for a plain entry. */
	findPortions(
		entry: Pick<EntryWithMealType, 'userId' | 'potId' | 'meal'>,
		tx: Prisma.TransactionClient,
	): Promise<EntryWithMealType[]> {
		if (entry.potId === null) return Promise.resolve([])
		return this.potEntriesRepository.findPortions(
			{ userId: entry.userId, potId: entry.potId, from: getWindowStart(entry) },
			tx,
		)
	}

	/** Gives the portions of the pot the recipe saved from it; a replaced recipe's portions move to the new one. */
	linkRecipe(
		{
			entry,
			recipeId,
			replacedRecipeId,
		}: {
			entry: Pick<EntryWithMealType, 'userId' | 'potId' | 'meal'>
			recipeId: string
			replacedRecipeId: string | null
		},
		tx: Prisma.TransactionClient,
	): Promise<number> {
		if (entry.potId === null) return Promise.resolve(0)
		return this.potEntriesRepository.linkRecipe(
			{
				userId: entry.userId,
				potId: entry.potId,
				from: getWindowStart(entry),
				recipeId,
				replacedRecipeId,
			},
			tx,
		)
	}

	/**
	 * A new composition of the pot: every portion keeps its grams, takes the new draft and the values
	 * the backend counts from it, and gets a Correction when its numbers changed.
	 */
	async recount(
		{
			portions,
			draft,
			messageId,
		}: { portions: readonly EntryWithMealType[]; draft: RecipeDraft; messageId?: string },
		tx: Prisma.TransactionClient,
	): Promise<PotRecount> {
		const sourceMessageIds = new Set<string>()
		const recipeIds = new Set<string>()
		const corrections = []
		for (const entry of portions) {
			const values = getRecipePortionValues(draft, entry.grams)
			const after = {
				kcal: roundNutrition(values.kcal),
				protein: roundNutrition(values.protein),
				fat: roundNutrition(values.fat),
				carbs: roundNutrition(values.carbs),
			}
			const before = {
				kcal: entry.kcal,
				protein: entry.proteinG,
				fat: entry.fatG,
				carbs: entry.carbsG,
			}
			const isUpdated = await this.entriesRepository.updateEntry(
				{
					userId: entry.userId,
					id: entry.id,
					data: {
						kcal: after.kcal,
						proteinG: after.protein,
						fatG: after.fat,
						carbsG: after.carbs,
						recipeDraft: draft,
						isEdited: true,
					},
				},
				tx,
			)
			// deleted by a parallel request after the read: no Correction for a change that didn't happen
			if (!isUpdated) continue
			if (entry.sourceMessageId) sourceMessageIds.add(entry.sourceMessageId)
			if (entry.recipeId) recipeIds.add(entry.recipeId)
			if (JSON.stringify(before) !== JSON.stringify(after)) {
				corrections.push({
					userId: entry.userId,
					foodEntryId: entry.id,
					messageId,
					before,
					after,
				})
			}
		}
		await this.entriesRepository.createCorrections(corrections, tx)
		return { sourceMessageIds: [...sourceMessageIds], recipeIds: [...recipeIds] }
	}
}
