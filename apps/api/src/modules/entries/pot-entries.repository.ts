import { Injectable } from '@nestjs/common'

import type { Prisma } from '../../generated/prisma/client'
import type { EntryWithMealType } from './entries.repository'

/** The active entries of one pot of the user: active meals only, from `from` on (a @db.Date value). */
const getPortionsWhere = ({
	userId,
	potId,
	from,
}: {
	userId: string
	potId: string
	from: Date
}): Prisma.FoodEntryWhereInput => ({
	userId,
	potId,
	deletedAt: null,
	meal: { deletedAt: null, localDate: { gte: from } },
})

/** Portions of a pot: entries that share `pot_id`. Every query is scoped by userId. */
@Injectable()
export class PotEntriesRepository {
	findPortions(
		params: { userId: string; potId: string; from: Date },
		tx: Prisma.TransactionClient,
	): Promise<EntryWithMealType[]> {
		return tx.foodEntry.findMany({
			where: getPortionsWhere(params),
			include: { meal: { select: { type: true, localDate: true } } },
			orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
		})
	}

	/** Links the portions that have no recipe yet, or the one `replacedRecipeId` that is being replaced. */
	async linkRecipe(
		{
			recipeId,
			replacedRecipeId,
			...params
		}: {
			userId: string
			potId: string
			from: Date
			recipeId: string
			replacedRecipeId: string | null
		},
		tx: Prisma.TransactionClient,
	): Promise<number> {
		const { count } = await tx.foodEntry.updateMany({
			where: {
				...getPortionsWhere(params),
				OR: [{ recipeId: null }, ...(replacedRecipeId ? [{ recipeId: replacedRecipeId }] : [])],
			},
			data: { recipeId },
		})
		return count
	}
}
