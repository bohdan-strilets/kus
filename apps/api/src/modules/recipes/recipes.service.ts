import { Injectable, Logger } from '@nestjs/common'
import {
	getRecipePortionValues,
	isRecipeDensityValid,
	MAX_ENTRY_GRAMS,
	MIN_ENTRY_GRAMS,
	type LogRecipePortionResponse,
	type RecipeDetail,
	type RecipeListItem,
	type RecipePortionShare,
	type RecipesQuery,
} from '@kus/shared'

import { paginate, type PaginatedResult } from '../../common/pagination'
import { formatDbDate, getLocalDate, getLocalHour } from '../../common/time'
import { Prisma } from '../../generated/prisma/client'
import { PrismaService } from '../../prisma'
import { roundNutrition } from '../entries/entries.mapper'
import { EntriesService } from '../entries/entries.service'
import { getMealEatenAtForDay, getMealTypeByHour } from '../entries/meal-type'
import { UsersService } from '../users/users.service'
import { RECIPE_ENTRY_CONFIDENCE } from './recipes.constants'
import {
	RecipeNameTakenException,
	RecipeNotFoundException,
	RecipePortionInvalidException,
} from './recipes.exceptions'
import { getPortionGrams, toCookedInput, toRecipeDetail, toRecipeListItem } from './recipes.mapper'
import { RecipesRepository, type RecipeWithIngredients } from './recipes.repository'

const UNIQUE_VIOLATION = 'P2002'

const isUniqueViolation = (error: unknown): boolean =>
	error instanceof Prisma.PrismaClientKnownRequestError && error.code === UNIQUE_VIOLATION

/** Saved recipes: the list, a recipe's figures and «Додати на сьогодні». */
@Injectable()
export class RecipesService {
	private readonly logger = new Logger(RecipesService.name)

	constructor(
		private readonly prisma: PrismaService,
		private readonly recipesRepository: RecipesRepository,
		private readonly entriesService: EntriesService,
		private readonly usersService: UsersService,
	) {}

	async list(
		userId: string,
		{ page, limit }: RecipesQuery,
	): Promise<PaginatedResult<RecipeListItem>> {
		const [recipes, total] = await Promise.all([
			this.recipesRepository.findActivePage({ userId, skip: (page - 1) * limit, take: limit }),
			this.recipesRepository.countActive(userId),
		])
		return paginate({ items: recipes.map(toRecipeListItem), total, page, limit })
	}

	async get(userId: string, id: string): Promise<RecipeDetail> {
		return toRecipeDetail(await this.getActive(userId, id))
	}

	/**
	 * Adds `share` of the recipe's portion to today's meal picked by the local hour. The figures
	 * come from the recipe's totals and weight, never from the client.
	 */
	async logPortion(
		userId: string,
		id: string,
		share: RecipePortionShare,
	): Promise<LogRecipePortionResponse> {
		const { timezone } = await this.usersService.getMe(userId)
		const now = new Date()
		const localDate = getLocalDate(now, timezone)
		const mealType = getMealTypeByHour(getLocalHour(now, timezone))
		const response = await this.prisma.$transaction(async (tx) => {
			const recipe = await this.recipesRepository.findActive({ userId, id }, tx)
			if (!recipe) throw new RecipeNotFoundException()
			const grams = roundNutrition(share * getPortionGrams(recipe))
			const input = toCookedInput(recipe)
			const isValid =
				grams >= MIN_ENTRY_GRAMS && grams <= MAX_ENTRY_GRAMS && isRecipeDensityValid(input)
			if (!isValid) throw new RecipePortionInvalidException()
			const { kcal, protein, fat, carbs } = getRecipePortionValues(input, grams)
			const { meals } = await this.entriesService.logEntries(
				{
					userId,
					sourceMessageId: null,
					getEatenAt: (meal) =>
						getMealEatenAtForDay({
							mealType: meal.type,
							isNamed: false,
							localDate: meal.localDate,
							now,
							timezone,
						}),
					entries: [
						{
							mealType,
							localDate,
							entry: {
								name: recipe.name,
								grams,
								quantity: null,
								kcal,
								protein,
								fat,
								carbs,
								fiber: null,
								category: recipe.category,
								source: 'MEMORY',
								confidence: RECIPE_ENTRY_CONFIDENCE,
								assumption: null,
								myFoodId: null,
								recipeId: recipe.id,
								fromPhoto: false,
							},
						},
					],
				},
				tx,
			)
			await this.recipesRepository.markUsed({ userId, ids: [id], usedAt: now }, tx)
			const meal = meals[0]
			const entry = meal?.entries[0]
			if (!meal || !entry) throw new Error('Recipe portion was not logged')
			return { entry, mealType: meal.type, localDate: formatDbDate(localDate) }
		})
		this.logger.log(`Recipe portion logged user=${userId} recipe=${id} share=${share}`)
		return response
	}

	/** Portions of these recipes were eaten again from the chat: the counters go up in the turn's transaction. */
	async markUsed(
		{ userId, ids, usedAt }: { userId: string; ids: string[]; usedAt: Date },
		tx: Prisma.TransactionClient,
	): Promise<void> {
		if (ids.length === 0) return
		await this.recipesRepository.markUsed({ userId, ids, usedAt }, tx)
	}

	async remove(userId: string, id: string): Promise<void> {
		const isDeleted = await this.recipesRepository.setDeletedAt({
			userId,
			id,
			deletedAt: new Date(),
		})
		if (!isDeleted) throw new RecipeNotFoundException()
	}

	async restore(userId: string, id: string): Promise<RecipeListItem> {
		const recipe = await this.recipesRepository.findAny({ userId, id })
		if (!recipe) throw new RecipeNotFoundException()
		if (recipe.deletedAt === null) return toRecipeListItem(recipe)
		await this.assertNameFree(userId, recipe)
		try {
			await this.recipesRepository.setDeletedAt({ userId, id, deletedAt: null })
		} catch (error) {
			// the pre-check lost a race with a recipe saved under the same name
			if (isUniqueViolation(error)) return this.throwNameTaken(userId, recipe)
			throw error
		}
		return toRecipeListItem(await this.getActive(userId, id))
	}

	private async getActive(userId: string, id: string): Promise<RecipeWithIngredients> {
		const recipe = await this.recipesRepository.findActive({ userId, id })
		if (!recipe) throw new RecipeNotFoundException()
		return recipe
	}

	private async assertNameFree(userId: string, recipe: RecipeWithIngredients): Promise<void> {
		const existing = await this.recipesRepository.findActiveByName({
			userId,
			nameNormalized: recipe.nameNormalized,
		})
		if (existing && existing.id !== recipe.id) throw new RecipeNameTakenException(existing)
	}

	private async throwNameTaken(userId: string, recipe: RecipeWithIngredients): Promise<never> {
		const existing = await this.recipesRepository.findActiveByName({
			userId,
			nameNormalized: recipe.nameNormalized,
		})
		if (!existing) throw new RecipeNotFoundException()
		throw new RecipeNameTakenException(existing)
	}
}
