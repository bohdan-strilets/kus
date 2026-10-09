import { Injectable, Logger } from '@nestjs/common'
import type { FoodEntryResponse, UpdateFoodEntryRequest } from '@kus/shared'

import { PrismaService } from '../../prisma'
import { ClarificationsService } from '../chat/clarifications.service'
import { EntryNotFoundException } from '../entries/entries.exceptions'
import { EntryEditsService } from '../entries/entry-edits.service'
import { getTypicalMealEatenAt } from '../entries/meal-type'
import { UsersService } from '../users/users.service'

/**
 * Manual edits from the sheet. They go through the same path as the chat's corrections and
 * deletions (a Correction per change, soft delete), so «скасувати» in the chat still works.
 */
@Injectable()
export class FoodEntriesService {
	private readonly logger = new Logger(FoodEntriesService.name)

	constructor(
		private readonly prisma: PrismaService,
		private readonly entryEdits: EntryEditsService,
		private readonly clarifications: ClarificationsService,
		private readonly usersService: UsersService,
	) {}

	async update(
		userId: string,
		id: string,
		{ grams, mealType }: UpdateFoodEntryRequest,
	): Promise<FoodEntryResponse> {
		const { timezone } = await this.usersService.getMe(userId)
		const now = new Date()
		const { entry, isWeightChanged, isMealChanged } = await this.prisma.$transaction(async (tx) => {
			const edited = await this.entryEdits.editEntry(
				{
					userId,
					id,
					grams,
					mealType,
					getEatenAt: (meal) =>
						getTypicalMealEatenAt({
							mealType: meal.type,
							localDate: meal.localDate,
							now,
							timezone,
						}),
				},
				tx,
			)
			// the portion changed by hand: an open question's options assume the old one (a move
			// between meals keeps the portion, so the question still fits)
			if (edited.isWeightChanged) {
				await this.clarifications.dismissForEntries({ userId, entryIds: [id] }, tx)
			}
			return edited
		})
		if (isWeightChanged || isMealChanged) {
			this.logger.log(`Entry edited user=${userId} entry=${id}`)
		}
		return entry
	}

	async remove(userId: string, id: string): Promise<void> {
		await this.prisma.$transaction(async (tx) => {
			const entry = await this.entryEdits.findActiveEntry({ userId, id }, tx)
			if (!entry) throw new EntryNotFoundException()
			await this.entryEdits.deleteEntries({ userId, ids: [id] }, tx)
			await this.clarifications.dismissForEntries({ userId, entryIds: [id] }, tx)
		})
		this.logger.log(`Entry deleted user=${userId} entry=${id}`)
	}
}
