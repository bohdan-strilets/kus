import { describe, expect, it, vi } from 'vitest'

import { ClarificationStatus, type Prisma } from '../../generated/prisma/client'
import type { PrismaService } from '../../prisma'
import type { EntryEditsService } from '../entries/entry-edits.service'
import type { RecipesPotService } from '../recipes/recipes-pot.service'
import type { ChatFeedService } from './chat-feed.service'
import type { ChatRepository } from './chat.repository'
import type { ClarificationsRepository } from './clarifications.repository'
import { ClarificationsService } from './clarifications.service'

const TX = {} as Prisma.TransactionClient
const USER_ID = 'user-1'

const option = (label: string, waterMl: number | null) => ({
	label,
	kcal: 100,
	protein: 0,
	fat: 0,
	carbs: 25,
	fiber: null,
	grams: null,
	name: null,
	waterMl,
})

const setup = (options: ReturnType<typeof option>[], potEntry: { id: string } | null) => {
	const applyOptionValues = vi.fn().mockResolvedValue(true)
	const correctPot = vi.fn().mockResolvedValue({ sourceMessageIds: [] })
	const findPotEntry = vi.fn().mockResolvedValue(potEntry)
	const service = new ClarificationsService(
		{} as PrismaService,
		{} as ChatRepository,
		{
			findClarification: vi.fn().mockResolvedValue({
				id: 'c1',
				messageId: 'reply-1',
				status: ClarificationStatus.OPEN,
				options,
				entries: [{ foodEntryId: 'entry-1' }],
			}),
			markClarificationAnswered: vi.fn().mockResolvedValue(true),
		} as unknown as ClarificationsRepository,
		{} as ChatFeedService,
		{ applyOptionValues } as unknown as EntryEditsService,
		{ findPotEntry, correctPot } as unknown as RecipesPotService,
	)
	const answer = (optionIndex: number) =>
		service.applyAnswer(
			{
				userId: USER_ID,
				id: 'c1',
				optionIndex,
				values: null,
				answer: null,
				answerMessageId: 'message-2',
			},
			TX,
		)
	return { answer, applyOptionValues, correctPot, findPotEntry }
}

const WATER_OPTIONS = [option('1–2 л', 1500), option('3 л', 3000), option('Не знаю', null)]

describe('ClarificationsService answer about the water of a pot', () => {
	it('recounts the pot with the water of the option; the option values are not applied as they are', async () => {
		const { answer, correctPot, applyOptionValues } = setup(WATER_OPTIONS, { id: 'entry-1' })

		await answer(1)

		expect(correctPot).toHaveBeenCalledWith(
			{
				userId: USER_ID,
				entryId: 'entry-1',
				correction: { waterMl: 3000, cookedGrams: null },
				messageId: 'message-2',
			},
			TX,
		)
		expect(applyOptionValues).not.toHaveBeenCalled()
	})

	it('keeps the estimate for an answer without water («Не знаю»)', async () => {
		const { answer, correctPot, applyOptionValues } = setup(WATER_OPTIONS, { id: 'entry-1' })

		await answer(2)

		expect(correctPot).not.toHaveBeenCalled()
		expect(applyOptionValues).not.toHaveBeenCalled()
	})

	it('applies the values as before when the entry is not a pot', async () => {
		const { answer, correctPot, applyOptionValues } = setup(WATER_OPTIONS, null)

		await answer(1)

		expect(correctPot).not.toHaveBeenCalled()
		expect(applyOptionValues).toHaveBeenCalledOnce()
	})

	it('applies the values as before for a question that has no water in its options', async () => {
		const { answer, correctPot, applyOptionValues, findPotEntry } = setup(
			[option('Овочевий', null), option('Харчо', null)],
			{ id: 'entry-1' },
		)

		await answer(1)

		expect(findPotEntry).not.toHaveBeenCalled()
		expect(correctPot).not.toHaveBeenCalled()
		expect(applyOptionValues).toHaveBeenCalledOnce()
	})
})
