import { randomUUID } from 'node:crypto'

import { Injectable, Logger } from '@nestjs/common'
import type { AiFoodItem, SaveRecipeInput } from '@kus/shared'

import type { Prisma } from '../../generated/prisma/client'
import type { NewFoodEntry } from '../entries/entries.types'
import { toPotEntry, toSavedRecipeEntry } from '../recipes/recipe-entry'
import type { RecipeWithIngredients } from '../recipes/recipes.repository'
import { RecipesSaveService, type SavedRecipe } from '../recipes/recipes-save.service'
import { RecipesService } from '../recipes/recipes.service'

/** The fields of a log_food item that stay the model's whatever the recipe says. */
export type RecipeItemBase = Omit<NewFoodEntry, 'recipeId' | 'recipeDraft' | 'potId'>

/** The model's `r1…` of this turn → the user's own saved recipe. */
export type RecipesByRef = ReadonlyMap<string, RecipeWithIngredients>

export const NO_RECIPES_BY_REF: RecipesByRef = new Map()

/** What save_recipe needs from the turn besides its own input. */
export interface SaveRecipesParams {
	userId: string
	/** The user's message: the source of the recipe. */
	messageId: string
	recipes: readonly SaveRecipeInput[]
	/** `e1…` → the id of the entry the model saw under that ref in this request. */
	entryIdByRef: ReadonlyMap<string, string>
}

/** What the recipe tools do inside the transaction of a chat turn: portions of a pot or a saved recipe, save_recipe. */
@Injectable()
export class ChatTurnRecipesService {
	private readonly logger = new Logger(ChatTurnRecipesService.name)

	constructor(
		private readonly recipesService: RecipesService,
		private readonly recipesSave: RecipesSaveService,
	) {}

	/**
	 * A log_food item with `recipe` is a portion of a new pot (one pot id for it, made here, never by the
	 * model); with `recipeRef` it is a portion of the saved recipe. Their numbers are the backend's, not the model's.
	 */
	toRecipeEntry(
		base: RecipeItemBase,
		{ recipe, recipeRef }: Pick<AiFoodItem, 'recipe' | 'recipeRef'>,
		byRef: RecipesByRef,
	): NewFoodEntry | null {
		if (recipe) return { ...base, ...toPotEntry(base, recipe, randomUUID()) }
		if (!recipeRef) return null
		const saved = byRef.get(recipeRef)
		// the parser accepts only refs of this request; a miss here is a bug
		if (!saved) throw new Error('log_food recipeRef is not mapped')
		return { ...base, ...toSavedRecipeEntry(saved, base.grams) }
	}

	/** Counts a saved recipe as used once per turn that logged a portion of it by `recipeRef`. */
	async markUsed(
		{
			userId,
			items,
			byRef,
			usedAt,
		}: { userId: string; items: readonly AiFoodItem[]; byRef: RecipesByRef; usedAt: Date },
		tx: Prisma.TransactionClient,
	): Promise<void> {
		const ids = new Set(
			items.flatMap(({ recipeRef }) => (recipeRef ? (byRef.get(recipeRef)?.id ?? []) : [])),
		)
		await this.recipesService.markUsed({ userId, ids: [...ids], usedAt }, tx)
	}

	/** save_recipe: from a pot logged earlier (entryRef) or from the ingredients; counts only in the log. */
	async save(
		{ userId, messageId, recipes, entryIdByRef }: SaveRecipesParams,
		tx: Prisma.TransactionClient,
	): Promise<SavedRecipe[]> {
		const saved: SavedRecipe[] = []
		for (const input of recipes) {
			const identity = { name: input.name, aliases: input.aliases, category: input.category }
			if (input.entryRef !== null) {
				const entryId = entryIdByRef.get(input.entryRef)
				// the parser accepts only refs of this request; a miss here is a bug
				if (entryId === undefined) throw new Error('save_recipe entryRef is not mapped')
				saved.push(
					await this.recipesSave.saveFromEntry({ userId, entryId, identity, messageId }, tx),
				)
			} else if (input.recipe !== null) {
				saved.push(
					await this.recipesSave.saveFromBody(
						{
							userId,
							body: input.recipe,
							portionGrams: input.portionGrams,
							identity,
							messageId,
						},
						tx,
					),
				)
			}
		}
		this.logger.log(`Recipes saved user=${userId} count=${saved.length}/${recipes.length}`)
		return saved
	}
}
