import { describe, expect, it, vi } from 'vitest'

import type { Prisma } from '../../generated/prisma/client'
import type { EntryEditsService } from '../entries/entry-edits.service'
import type { RecipesPotService } from '../recipes/recipes-pot.service'
import { NO_WORKOUT_REFS, type WorkoutsTurnService } from '../workouts/workouts-turn.service'
import { ChatEditsService } from './chat-edits.service'
import type { ClarificationsRepository } from './clarifications.repository'
import type { ClarificationsService } from './clarifications.service'

const TX = {} as Prisma.TransactionClient

const change = (
	ref: string,
	recipe: { waterMl: number | null; cookedGrams: number | null } | null,
) => ({
	ref,
	name: null,
	category: null,
	grams: null,
	values: null,
	recipe,
})

const setup = () => {
	const correctEntries = vi.fn().mockResolvedValue(['message-1'])
	const correctPot = vi.fn().mockResolvedValue({ sourceMessageIds: ['message-1', 'message-2'] })
	const service = new ChatEditsService(
		{
			correctEntries,
			deleteEntries: vi.fn().mockResolvedValue([]),
			restoreEntries: vi.fn().mockResolvedValue([]),
		} as unknown as EntryEditsService,
		{} as ClarificationsService,
		{
			dismissOpenClarifications: vi.fn().mockResolvedValue([]),
		} as unknown as ClarificationsRepository,
		{
			deleteByRefs: vi.fn().mockResolvedValue([]),
			restoreByRefs: vi.fn().mockResolvedValue([]),
		} as unknown as WorkoutsTurnService,
		{ correctPot } as unknown as RecipesPotService,
	)
	const apply = (corrections: ReturnType<typeof change>[]) =>
		service.applyEdits(
			{
				userId: 'user-1',
				userMessageId: 'message-3',
				edits: { corrections, deletions: [], restorations: [], resolutions: [] },
				refIds: {
					entries: new Map([
						['e1', 'entry-1'],
						['e2', 'entry-2'],
					]),
					deletedEntries: new Map(),
					clarifications: new Map(),
				},
				workoutRefIds: NO_WORKOUT_REFS,
			},
			TX,
		)
	return { apply, correctEntries, correctPot }
}

describe('ChatEditsService pot corrections', () => {
	it('recounts the pot of an entry changed with recipe and reports every card the portions sit on', async () => {
		const { apply, correctPot } = setup()

		const edited = await apply([change('e1', { waterMl: 4000, cookedGrams: null })])

		expect(correctPot).toHaveBeenCalledWith(
			{
				userId: 'user-1',
				entryId: 'entry-1',
				correction: { waterMl: 4000, cookedGrams: null },
				messageId: 'message-3',
			},
			TX,
		)
		expect(edited.sourceMessageIds.sort()).toEqual(['message-1', 'message-2'])
	})

	it('leaves the pots alone for corrections without recipe', async () => {
		const { apply, correctPot, correctEntries } = setup()

		await apply([change('e2', null)])

		expect(correctPot).not.toHaveBeenCalled()
		expect(correctEntries).toHaveBeenCalled()
	})
})
