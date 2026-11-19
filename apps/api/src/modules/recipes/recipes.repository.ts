import { randomUUID } from 'node:crypto'

import { Injectable } from '@nestjs/common'

import type { FoodCategory, Prisma } from '../../generated/prisma/client'
import { PrismaService } from '../../prisma'

/** RecipeIngredient has no userId: it is read only through its recipe, which is the user's. */
const WITH_INGREDIENTS = {
	ingredients: { orderBy: { position: 'asc' } },
} satisfies Prisma.RecipeInclude

export type RecipeWithIngredients = Prisma.RecipeGetPayload<{ include: typeof WITH_INGREDIENTS }>

const MATCHABLE = {
	id: true,
	name: true,
	aliases: true,
	usageCount: true,
	lastUsedAt: true,
} satisfies Prisma.RecipeSelect

export type MatchableRecipe = Prisma.RecipeGetPayload<{ select: typeof MATCHABLE }>

/** A recipe from the chat: the composition is saved with it, the counters may come from a replaced one. */
export interface NewRecipe {
	userId: string
	name: string
	nameNormalized: string
	aliases: string[]
	category: FoodCategory
	cookedGrams: number
	defaultGrams: number
	usageCount: number
	lastUsedAt: Date | null
	sourceMessageId: string | null
	ingredients: {
		name: string
		grams: number
		kcal: number
		proteinG: number
		fatG: number
		carbsG: number
		fiberG: number | null
	}[]
}

/** The counters of an active recipe a new one takes over. */
export interface ReplacedRecipe {
	id: string
	usageCount: number
	lastUsedAt: Date | null
}

@Injectable()
export class RecipesRepository {
	constructor(private readonly prisma: PrismaService) {}

	findActivePage({
		userId,
		skip,
		take,
	}: {
		userId: string
		skip: number
		take: number
	}): Promise<RecipeWithIngredients[]> {
		return this.prisma.recipe.findMany({
			where: { userId, deletedAt: null },
			include: WITH_INGREDIENTS,
			orderBy: [{ lastUsedAt: { sort: 'desc', nulls: 'last' } }, { createdAt: 'desc' }],
			skip,
			take,
		})
	}

	/** Names only (no ingredients): the message is matched in memory, the matches are loaded after. */
	findMatchable({ userId, take }: { userId: string; take: number }): Promise<MatchableRecipe[]> {
		return this.prisma.recipe.findMany({
			where: { userId, deletedAt: null },
			select: MATCHABLE,
			orderBy: [{ lastUsedAt: { sort: 'desc', nulls: 'last' } }, { createdAt: 'desc' }],
			take,
		})
	}

	findActiveByIds({
		userId,
		ids,
	}: {
		userId: string
		ids: string[]
	}): Promise<RecipeWithIngredients[]> {
		return this.prisma.recipe.findMany({
			where: { id: { in: ids }, userId, deletedAt: null },
			include: WITH_INGREDIENTS,
		})
	}

	/** The recipes find_food searches: the user's active ones, the most used first, at most `take`. */
	findActiveForSearch({
		userId,
		take,
	}: {
		userId: string
		take: number
	}): Promise<RecipeWithIngredients[]> {
		return this.prisma.recipe.findMany({
			where: { userId, deletedAt: null },
			include: WITH_INGREDIENTS,
			orderBy: [{ usageCount: 'desc' }, { lastUsedAt: { sort: 'desc', nulls: 'last' } }],
			take,
		})
	}

	countActive(userId: string): Promise<number> {
		return this.prisma.recipe.count({ where: { userId, deletedAt: null } })
	}

	findActive(
		{ userId, id }: { userId: string; id: string },
		tx?: Prisma.TransactionClient,
	): Promise<RecipeWithIngredients | null> {
		return (tx ?? this.prisma).recipe.findFirst({
			where: { id, userId, deletedAt: null },
			include: WITH_INGREDIENTS,
		})
	}

	/** Active or deleted, but always the user's own. */
	findAny({ userId, id }: { userId: string; id: string }): Promise<RecipeWithIngredients | null> {
		return this.prisma.recipe.findFirst({ where: { id, userId }, include: WITH_INGREDIENTS })
	}

	findActiveByName({
		userId,
		nameNormalized,
	}: {
		userId: string
		nameNormalized: string
	}): Promise<{ id: string; name: string } | null> {
		return this.prisma.recipe.findFirst({
			where: { userId, nameNormalized, deletedAt: null },
			select: { id: true, name: true },
		})
	}

	/** The user's active recipe of this name with its counters, inside the turn's transaction. */
	findActiveByNameInTx(
		{ userId, nameNormalized }: { userId: string; nameNormalized: string },
		tx: Prisma.TransactionClient,
	): Promise<ReplacedRecipe | null> {
		return tx.recipe.findFirst({
			where: { userId, nameNormalized, deletedAt: null },
			select: { id: true, usageCount: true, lastUsedAt: true },
		})
	}

	/**
	 * Conflict-safe insert for the chat turn: ON CONFLICT DO NOTHING honours the partial unique index,
	 * while a violation would abort the turn's transaction. null = the name is taken.
	 */
	async createIfFree(
		{ ingredients, ...data }: NewRecipe,
		tx: Prisma.TransactionClient,
	): Promise<RecipeWithIngredients | null> {
		const id = randomUUID()
		const { count } = await tx.recipe.createMany({ data: [{ id, ...data }], skipDuplicates: true })
		if (count === 0) return null
		await tx.recipeIngredient.createMany({
			data: ingredients.map((ingredient, position) => ({ recipeId: id, position, ...ingredient })),
		})
		return this.findActive({ userId: data.userId, id }, tx)
	}

	/** The weight of the finished dish of the user's active recipes; a deleted recipe stays as it was. */
	async updateCookedGrams(
		{ userId, ids, cookedGrams }: { userId: string; ids: string[]; cookedGrams: number },
		tx: Prisma.TransactionClient,
	): Promise<void> {
		await tx.recipe.updateMany({
			where: { id: { in: ids }, userId, deletedAt: null },
			data: { cookedGrams },
		})
	}

	/** Soft delete (a date) or restore (null); only a row in the opposite state. false = nothing matched. */
	async setDeletedAt(
		{
			userId,
			id,
			deletedAt,
		}: {
			userId: string
			id: string
			deletedAt: Date | null
		},
		tx?: Prisma.TransactionClient,
	): Promise<boolean> {
		const { count } = await (tx ?? this.prisma).recipe.updateMany({
			where: { id, userId, deletedAt: deletedAt === null ? { not: null } : null },
			data: { deletedAt },
		})
		return count === 1
	}

	async markUsed(
		{ userId, ids, usedAt }: { userId: string; ids: string[]; usedAt: Date },
		tx: Prisma.TransactionClient,
	): Promise<void> {
		await tx.recipe.updateMany({
			where: { id: { in: ids }, userId, deletedAt: null },
			data: { usageCount: { increment: 1 }, lastUsedAt: usedAt },
		})
	}
}
