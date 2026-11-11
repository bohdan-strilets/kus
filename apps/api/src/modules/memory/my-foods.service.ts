import { Injectable, Logger } from '@nestjs/common'
import {
	FOOD_REMOVAL_PROPOSAL_TTL_MS,
	normalizeName,
	type MyFoodResponse,
	type MyFoodsQuery,
	type RememberEntriesResponse,
	type UpdateMyFoodRequest,
} from '@kus/shared'

import { paginate, type PaginatedResult } from '../../common/pagination'
import { type MyFood, Prisma } from '../../generated/prisma/client'
import { PrismaService } from '../../prisma'
import { EntriesService } from '../entries/entries.service'
import { MemoryRepository } from './memory.repository'
import { MyFoodExistsException, MyFoodNotFoundException } from './my-foods.exceptions'
import { toMyFoodResponse } from './my-foods.mapper'
import {
	compareByName,
	isFoodMatchingQuery,
	type NewMyFood,
	toMyFoodUpdate,
	toNewMyFood,
} from './my-foods.utils'

/** Foods "Foods forgotten today" shows the model. */
const MAX_RECENTLY_DELETED_FOODS = 5

/** What bringing a forgotten food back from the chat came to. */
export type FoodRestoreOutcome = 'restored' | 'name_taken' | 'gone'

const UNIQUE_VIOLATION = 'P2002'

const isUniqueViolation = (error: unknown): boolean =>
	error instanceof Prisma.PrismaClientKnownRequestError && error.code === UNIQUE_VIOLATION

/** «Пам'ять · Продукти»: the user's saved foods, edited by hand or created from logged entries. */
@Injectable()
export class MyFoodsService {
	private readonly logger = new Logger(MyFoodsService.name)

	constructor(
		private readonly prisma: PrismaService,
		private readonly memoryRepository: MemoryRepository,
		private readonly entriesService: EntriesService,
	) {}

	async list(
		userId: string,
		{ q, page, limit }: MyFoodsQuery,
	): Promise<PaginatedResult<MyFoodResponse>> {
		const foods = await this.memoryRepository.findActiveFoods(userId)
		const matched = foods
			.filter((food) => q === undefined || isFoodMatchingQuery(food, q))
			.sort(compareByName)
		const items = matched.slice((page - 1) * limit, page * limit).map(toMyFoodResponse)
		return paginate({ items, total: matched.length, page, limit })
	}

	async update(userId: string, id: string, body: UpdateMyFoodRequest): Promise<MyFoodResponse> {
		const food = await this.getActiveFood(userId, id)
		const nameNormalized = body.name === undefined ? undefined : normalizeName(body.name)
		if (nameNormalized !== undefined && nameNormalized !== food.nameNormalized) {
			await this.assertNameFree(userId, nameNormalized, id)
		}
		const data: Prisma.MyFoodUpdateManyMutationInput = {
			...(body.name !== undefined && { name: body.name, nameNormalized }),
			...(body.per100g && {
				kcalPer100g: body.per100g.kcal,
				proteinPer100g: body.per100g.protein,
				fatPer100g: body.per100g.fat,
				carbsPer100g: body.per100g.carbs,
				fiberPer100g: body.per100g.fiber,
			}),
			...(body.pieceGrams !== undefined && { pieceGrams: body.pieceGrams }),
			...(body.defaultGrams !== undefined && { defaultGrams: body.defaultGrams }),
			source: 'MANUAL',
		}
		try {
			const isUpdated = await this.memoryRepository.updateActiveFood({ userId, id, data })
			if (!isUpdated) throw new MyFoodNotFoundException()
		} catch (error) {
			// the pre-check lost a race with a parallel rename
			if (nameNormalized !== undefined && isUniqueViolation(error)) {
				return this.throwExists(userId, nameNormalized)
			}
			throw error
		}
		return toMyFoodResponse(await this.getActiveFood(userId, id))
	}

	/**
	 * The chat's save_food: a new food remembering the message that saved it, or null when the name
	 * is taken (a race, or a ref-less repeat).
	 */
	saveFromChat(
		{ userId, data, sourceMessageId }: { userId: string; data: NewMyFood; sourceMessageId: string },
		tx: Prisma.TransactionClient,
	): Promise<MyFood | null> {
		return this.memoryRepository.createFoodIfFree({ userId, data, sourceMessageId }, tx)
	}

	/** The chat's save_food with an agreed updateRef; null = the food is gone (deleted meanwhile). */
	async updateFromChat(
		{ userId, id, data }: { userId: string; id: string; data: NewMyFood },
		tx: Prisma.TransactionClient,
	): Promise<MyFood | null> {
		const isUpdated = await this.memoryRepository.updateActiveFood(
			{ userId, id, data: toMyFoodUpdate(data) },
			tx,
		)
		if (!isUpdated) return null
		return this.memoryRepository.findFood({ userId, id }, tx)
	}

	/** The chat asked "remove it?" about these foods in this user message; nothing is deleted yet. */
	proposeRemovalFromChat(
		{ userId, ids, messageId }: { userId: string; ids: string[]; messageId: string },
		tx: Prisma.TransactionClient,
	): Promise<void> {
		return this.memoryRepository.setRemovalProposed({ userId, ids, messageId }, tx)
	}

	/** Active foods asked about in `previousMessageId` (the user's message before this one) in time. */
	findPendingRemovals(
		{ userId, previousMessageId, now }: { userId: string; previousMessageId: string; now: Date },
		tx?: Prisma.TransactionClient,
	): Promise<MyFood[]> {
		return this.memoryRepository.findRemovalProposed(
			{ userId, messageId: previousMessageId, since: this.getProposalSince(now) },
			tx,
		)
	}

	/**
	 * The chat's forget_food with the user's "yes": soft delete, but only a food that the question of
	 * the previous message was about, asked not longer ago than the TTL. false = nothing deleted.
	 */
	forgetFromChat(
		{ userId, id, previousMessageId }: { userId: string; id: string; previousMessageId: string },
		tx: Prisma.TransactionClient,
	): Promise<boolean> {
		const now = new Date()
		return this.memoryRepository.deleteProposed(
			{
				userId,
				id,
				messageId: previousMessageId,
				since: this.getProposalSince(now),
				deletedAt: now,
			},
			tx,
		)
	}

	/** Foods deleted since `since` (the user's local midnight), the newest first: what restore_food reaches. */
	findRecentlyDeleted(userId: string, since: Date): Promise<MyFood[]> {
		return this.memoryRepository.findDeletedSince({
			userId,
			since,
			limit: MAX_RECENTLY_DELETED_FOODS,
		})
	}

	/** The chat's restore_food; a name another food has taken meanwhile is not overwritten. */
	async restoreFromChat(
		{ userId, id }: { userId: string; id: string },
		tx: Prisma.TransactionClient,
	): Promise<FoodRestoreOutcome> {
		const food = await this.memoryRepository.findFood({ userId, id }, tx)
		if (!food) return 'gone'
		if (food.deletedAt === null) return 'restored'
		const holder = await this.memoryRepository.findActiveFoodByName(
			{ userId, nameNormalized: food.nameNormalized },
			tx,
		)
		if (holder) return 'name_taken'
		const isRestored = await this.memoryRepository.setDeletedAt({ userId, id, deletedAt: null }, tx)
		return isRestored ? 'restored' : 'gone'
	}

	async remove(userId: string, id: string): Promise<void> {
		const isDeleted = await this.memoryRepository.setDeletedAt({
			userId,
			id,
			deletedAt: new Date(),
		})
		if (!isDeleted) throw new MyFoodNotFoundException()
	}

	async restore(userId: string, id: string): Promise<MyFoodResponse> {
		const food = await this.memoryRepository.findFood({ userId, id })
		if (!food) throw new MyFoodNotFoundException()
		if (food.deletedAt === null) return toMyFoodResponse(food)
		await this.assertNameFree(userId, food.nameNormalized, id)
		try {
			await this.memoryRepository.setDeletedAt({ userId, id, deletedAt: null })
		} catch (error) {
			if (isUniqueViolation(error)) return this.throwExists(userId, food.nameNormalized)
			throw error
		}
		return toMyFoodResponse(await this.getActiveFood(userId, id))
	}

	/**
	 * Saves the entries' foods and links the entries to them. All or nothing: an entry that isn't
	 * the user's active one fails the request with nothing written. A name that is saved already
	 * (or comes earlier in the request) is skipped, not an error.
	 */
	async rememberEntries(userId: string, entryIds: string[]): Promise<RememberEntriesResponse> {
		let response: RememberEntriesResponse
		try {
			response = await this.remember(userId, entryIds)
		} catch (error) {
			// a parallel request saved the same name between our check and insert: the retry skips it
			if (!isUniqueViolation(error)) throw error
			response = await this.remember(userId, entryIds)
		}
		this.logger.log(
			`Remembered ${response.created.length} of ${entryIds.length} entries (user ${userId})`,
		)
		return response
	}

	private remember(userId: string, entryIds: string[]): Promise<RememberEntriesResponse> {
		return this.prisma.$transaction(async (tx) => {
			const entries = await this.entriesService.getRememberableEntries(userId, entryIds, tx)
			const created: MyFood[] = []
			const skipped: RememberEntriesResponse['skipped'] = []
			const takenNames = new Set<string>()
			for (const entry of entries) {
				const data = toNewMyFood(entry)
				const isTaken =
					takenNames.has(data.nameNormalized) ||
					(await this.memoryRepository.findActiveFoodByName(
						{ userId, nameNormalized: data.nameNormalized },
						tx,
					)) !== null
				if (isTaken) {
					skipped.push({ entryId: entry.id, reason: 'exists' })
					continue
				}
				takenNames.add(data.nameNormalized)
				const food = await this.memoryRepository.createFood({ userId, data }, tx)
				await this.entriesService.linkMyFood({ userId, entryId: entry.id, myFoodId: food.id }, tx)
				created.push(food)
			}
			return { created: created.map(toMyFoodResponse), skipped }
		})
	}

	private getProposalSince(now: Date): Date {
		return new Date(now.getTime() - FOOD_REMOVAL_PROPOSAL_TTL_MS)
	}

	private async getActiveFood(userId: string, id: string): Promise<MyFood> {
		const food = await this.memoryRepository.findFood({ userId, id })
		if (!food || food.deletedAt !== null) throw new MyFoodNotFoundException()
		return food
	}

	private async assertNameFree(
		userId: string,
		nameNormalized: string,
		exceptId: string,
	): Promise<void> {
		const existing = await this.memoryRepository.findActiveFoodByName({ userId, nameNormalized })
		if (existing && existing.id !== exceptId) throw new MyFoodExistsException(existing)
	}

	private async throwExists(userId: string, nameNormalized: string): Promise<never> {
		const existing = await this.memoryRepository.findActiveFoodByName({ userId, nameNormalized })
		if (!existing) throw new MyFoodNotFoundException()
		throw new MyFoodExistsException(existing)
	}
}
