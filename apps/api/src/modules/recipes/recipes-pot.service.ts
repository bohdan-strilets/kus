import { Injectable, Logger } from '@nestjs/common'
import { getCookedGrams } from '@kus/shared'

import type { Prisma } from '../../generated/prisma/client'
import { EntriesService } from '../entries/entries.service'
import type { EntryWithMealType } from '../entries/entries.repository'
import { PotEntriesService } from '../entries/pot-entries.service'
import {
	applyPotCorrection,
	isPotPortionValid,
	parseRecipeDraft,
	type PotCorrection,
} from './recipe-draft'
import { PotNotFoundException, RecipePortionInvalidException } from './recipes.exceptions'
import { RecipesRepository } from './recipes.repository'

/** The pot an entry is a portion of, as the chat corrects it. */
export interface PotCorrectionResult {
	/** Messages whose cards show a portion that changed. */
	sourceMessageIds: string[]
}

/** «Там було 4 л»: the water or weight of a pot, and every portion of that one cooking. */
@Injectable()
export class RecipesPotService {
	private readonly logger = new Logger(RecipesPotService.name)

	constructor(
		private readonly recipesRepository: RecipesRepository,
		private readonly entriesService: EntriesService,
		private readonly potEntries: PotEntriesService,
	) {}

	/** The first of the entries that is a portion of a pot; null = none is. */
	async findPotEntry(
		userId: string,
		entryIds: string[],
		tx: Prisma.TransactionClient,
	): Promise<EntryWithMealType | null> {
		const entries = await this.entriesService.findActiveEntriesByIds(userId, entryIds, tx)
		return entries.find((entry) => entry.potId !== null) ?? null
	}

	/**
	 * Recounts the pot of `entryId`: its draft, every portion of the same cooking (`pot_id`, the
	 * user's own, within the window) and, when the recipe saved from it is still active, the weight of
	 * that recipe. Portions of other cookings of the same recipe are left alone.
	 */
	async correctPot(
		{
			userId,
			entryId,
			correction,
			messageId,
		}: { userId: string; entryId: string; correction: PotCorrection; messageId?: string },
		tx: Prisma.TransactionClient,
	): Promise<PotCorrectionResult> {
		const [entry] = await this.entriesService.findActiveEntriesByIds(userId, [entryId], tx)
		const draft = entry ? parseRecipeDraft(entry.recipeDraft) : null
		if (!entry || entry.potId === null || !draft) throw new PotNotFoundException()
		const corrected = applyPotCorrection(draft, correction)
		const portions = await this.potEntries.findPortions(entry, tx)
		if (!portions.every(({ grams }) => isPotPortionValid(corrected, grams))) {
			throw new RecipePortionInvalidException()
		}
		const { sourceMessageIds, recipeIds } = await this.potEntries.recount(
			{ portions, draft: corrected, messageId },
			tx,
		)
		if (recipeIds.length > 0) {
			await this.recipesRepository.updateCookedGrams(
				{ userId, ids: recipeIds, cookedGrams: getCookedGrams(corrected) },
				tx,
			)
		}
		this.logger.log(`Pot recounted user=${userId} portions=${portions.length}`)
		return { sourceMessageIds }
	}
}
