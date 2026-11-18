import { Injectable } from '@nestjs/common'

import type { Prisma } from '../../generated/prisma/client'
import { PrismaService } from '../../prisma'

/** RecipeIngredient has no userId: it is read only through its recipe, which is the user's. */
const WITH_INGREDIENTS = {
	ingredients: { orderBy: { position: 'asc' } },
} satisfies Prisma.RecipeInclude

export type RecipeWithIngredients = Prisma.RecipeGetPayload<{ include: typeof WITH_INGREDIENTS }>

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

	/** Soft delete (a date) or restore (null); only a row in the opposite state. false = nothing matched. */
	async setDeletedAt({
		userId,
		id,
		deletedAt,
	}: {
		userId: string
		id: string
		deletedAt: Date | null
	}): Promise<boolean> {
		const { count } = await this.prisma.recipe.updateMany({
			where: { id, userId, deletedAt: deletedAt === null ? { not: null } : null },
			data: { deletedAt },
		})
		return count === 1
	}

	async markUsed(
		{ userId, id, usedAt }: { userId: string; id: string; usedAt: Date },
		tx: Prisma.TransactionClient,
	): Promise<void> {
		await tx.recipe.updateMany({
			where: { id, userId, deletedAt: null },
			data: { usageCount: { increment: 1 }, lastUsedAt: usedAt },
		})
	}
}
