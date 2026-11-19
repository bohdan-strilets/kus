import { Injectable, Logger } from '@nestjs/common'
import { getCookedGrams, normalizeName, type RecipeBody, type RecipeDraft } from '@kus/shared'

import type { FoodCategory, Prisma } from '../../generated/prisma/client'
import { EntriesService } from '../entries/entries.service'
import type { EntryWithMealType } from '../entries/entries.repository'
import { PotEntriesService } from '../entries/pot-entries.service'
import {
	getRecipePortionGrams,
	isPotPortionValid,
	parseRecipeDraft,
	toRecipeAliases,
} from './recipe-draft'
import {
	RecipeFromEntryInvalidException,
	RecipeNameTakenException,
	RecipePortionInvalidException,
	RecipePortionUnknownException,
} from './recipes.exceptions'
import { RecipesRepository, type RecipeWithIngredients } from './recipes.repository'

/** What names a recipe the chat saves. */
export interface RecipeIdentity {
	name: string
	aliases: readonly string[]
	category: FoodCategory
}

/** A recipe saved by the chat or the «Запам'ятати» button. */
export interface SavedRecipe {
	id: string
	name: string
	/** An active recipe of the same name was replaced (the toast says «saved» or «updated»). */
	replaced: boolean
}

/** Saving a recipe from a pot already logged (a portion of it) or from the ingredients the model sent. */
@Injectable()
export class RecipesSaveService {
	private readonly logger = new Logger(RecipesSaveService.name)

	constructor(
		private readonly recipesRepository: RecipesRepository,
		private readonly entriesService: EntriesService,
		private readonly potEntries: PotEntriesService,
	) {}

	/** The entry is a portion of a pot (`entryId` is read again by userId): its composition becomes the recipe. */
	async saveFromEntry(
		{
			userId,
			entryId,
			identity,
			messageId,
		}: { userId: string; entryId: string; identity: RecipeIdentity; messageId: string | null },
		tx: Prisma.TransactionClient,
	): Promise<SavedRecipe> {
		const [entry] = await this.entriesService.findActiveEntriesByIds(userId, [entryId], tx)
		const draft = entry ? parseRecipeDraft(entry.recipeDraft) : null
		if (!entry || entry.potId === null || !draft) throw new RecipeFromEntryInvalidException()
		const recipe = await this.create(
			{ userId, body: draft, defaultGrams: entry.grams, identity, messageId },
			tx,
		)
		await this.linkPortions({ entry, recipe, replacedId: recipe.replacedId }, tx)
		return { id: recipe.id, name: recipe.name, replaced: recipe.replacedId !== null }
	}

	/** Ingredients from the model: a recipe never gets saved without the weight of a portion. */
	async saveFromBody(
		{
			userId,
			body,
			portionGrams,
			identity,
			messageId,
		}: {
			userId: string
			body: RecipeBody
			portionGrams: number | null
			identity: RecipeIdentity
			messageId: string | null
		},
		tx: Prisma.TransactionClient,
	): Promise<SavedRecipe> {
		const defaultGrams = getRecipePortionGrams(body, portionGrams)
		if (defaultGrams === null) throw new RecipePortionUnknownException()
		const recipe = await this.create({ userId, body, defaultGrams, identity, messageId }, tx)
		return { id: recipe.id, name: recipe.name, replaced: recipe.replacedId !== null }
	}

	private async create(
		{
			userId,
			body,
			defaultGrams,
			identity,
			messageId,
		}: {
			userId: string
			body: RecipeDraft
			defaultGrams: number
			identity: RecipeIdentity
			messageId: string | null
		},
		tx: Prisma.TransactionClient,
	): Promise<RecipeWithIngredients & { replacedId: string | null }> {
		if (!isPotPortionValid(body, defaultGrams)) throw new RecipePortionInvalidException()
		const nameNormalized = normalizeName(identity.name)
		// the old one goes first: the partial unique allows one active recipe of a name, and the new one
		// takes over its counters
		const replaced = await this.recipesRepository.findActiveByNameInTx(
			{ userId, nameNormalized },
			tx,
		)
		if (replaced) {
			await this.recipesRepository.setDeletedAt(
				{ userId, id: replaced.id, deletedAt: new Date() },
				tx,
			)
		}
		const recipe = await this.recipesRepository.createIfFree(
			{
				userId,
				name: identity.name,
				nameNormalized,
				aliases: toRecipeAliases(identity.aliases, nameNormalized),
				category: identity.category,
				cookedGrams: getCookedGrams(body),
				defaultGrams,
				usageCount: replaced?.usageCount ?? 0,
				lastUsedAt: replaced?.lastUsedAt ?? null,
				sourceMessageId: messageId,
				ingredients: body.ingredients.map((ingredient) => ({
					name: ingredient.name,
					grams: ingredient.grams,
					kcal: ingredient.kcal,
					proteinG: ingredient.protein,
					fatG: ingredient.fat,
					carbsG: ingredient.carbs,
					fiberG: ingredient.fiber,
				})),
			},
			tx,
		)
		if (!recipe) return this.throwNameTaken({ userId, nameNormalized, name: identity.name }, tx)
		this.logger.log(`Recipe saved user=${userId} recipe=${recipe.id} replaced=${replaced !== null}`)
		return { ...recipe, replacedId: replaced?.id ?? null }
	}

	/** A parallel save took the name between the read and the insert; the turn is resent as a whole. */
	private async throwNameTaken(
		{ userId, nameNormalized, name }: { userId: string; nameNormalized: string; name: string },
		tx: Prisma.TransactionClient,
	): Promise<never> {
		const holder = await this.recipesRepository.findActiveByNameInTx({ userId, nameNormalized }, tx)
		throw new RecipeNameTakenException({ id: holder?.id ?? 'unknown', name })
	}

	private async linkPortions(
		{
			entry,
			recipe,
			replacedId,
		}: { entry: EntryWithMealType; recipe: { id: string }; replacedId: string | null },
		tx: Prisma.TransactionClient,
	): Promise<void> {
		const linked = await this.potEntries.linkRecipe(
			{ entry, recipeId: recipe.id, replacedRecipeId: replacedId },
			tx,
		)
		this.logger.log(`Pot portions linked user=${entry.userId} recipe=${recipe.id} count=${linked}`)
	}
}
