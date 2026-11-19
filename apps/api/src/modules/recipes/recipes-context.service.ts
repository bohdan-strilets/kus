import { Injectable } from '@nestjs/common'
import {
	findMentionedFoods,
	MEMORY_PASSIVE_MAX_RECIPES,
	RECIPE_REF_PREFIX,
	type RecipeContext,
} from '@kus/shared'

import { RECIPE_SCAN_LIMIT } from './recipes.constants'
import { toRecipeContext } from './recipes.mapper'
import { RecipesRepository, type RecipeWithIngredients } from './recipes.repository'

export interface RelevantRecipes {
	/** What the model sees: refs instead of ids. */
	context: RecipeContext[]
	/** ref → the user's own recipe; the only way a model ref turns into a database id. */
	byRef: Map<string, RecipeWithIngredients>
}

/** Recipes the model reads: the passive block of a chat turn and the find_food search. Active ones only. */
@Injectable()
export class RecipesContextService {
	constructor(private readonly recipesRepository: RecipesRepository) {}

	/**
	 * Recipes the message names (refs r1…), matched like the saved foods: same words, same
	 * threshold. Nothing is read beyond the names when nothing matches.
	 */
	async findRelevant(userId: string, text: string): Promise<RelevantRecipes> {
		const none: RelevantRecipes = { context: [], byRef: new Map() }
		if (text.trim() === '') return none
		const candidates = await this.recipesRepository.findMatchable({
			userId,
			take: RECIPE_SCAN_LIMIT,
		})
		const matched = findMentionedFoods(text, candidates, { limit: MEMORY_PASSIVE_MAX_RECIPES })
		if (matched.length === 0) return none
		const recipes = await this.recipesRepository.findActiveByIds({
			userId,
			ids: matched.map(({ id }) => id),
		})
		const recipeById = new Map(recipes.map((recipe) => [recipe.id, recipe]))
		// a recipe deleted between the two reads is simply not there
		const found = matched.flatMap(({ id }) => recipeById.get(id) ?? [])
		const byRef = new Map(
			found.map((recipe, index) => [`${RECIPE_REF_PREFIX}${index + 1}`, recipe]),
		)
		return {
			context: [...byRef].map(([ref, recipe]) => toRecipeContext(recipe, ref)),
			byRef,
		}
	}

	/** The user's active recipes for find_food, which searches them in memory (the match is in shared). */
	findForSearch(userId: string): Promise<RecipeWithIngredients[]> {
		return this.recipesRepository.findActiveForSearch({ userId, take: RECIPE_SCAN_LIMIT })
	}
}
