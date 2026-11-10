import { beforeEach, describe, expect, it, vi } from 'vitest'

import { MeasurementKind } from '../../generated/prisma/client'
import { ChatHistoryMarkersService } from './chat-history-markers.service'

const USER_ID = 'u1'
const NOW = new Date('2026-11-06T10:00:00Z')

const NO_REFS = {
	workouts: new Map<string, string>(),
	deletedWorkouts: new Map<string, string>(),
	exercises: new Map<string, string>(),
}

const createService = () => {
	const findStartedByMessages = vi.fn().mockResolvedValue([])
	const findByMessageIds = vi.fn().mockResolvedValue([])
	const findForHistory = vi.fn().mockResolvedValue([])
	const countForgottenFacts = vi.fn().mockResolvedValue(new Map())
	const findReadDigests = vi.fn().mockResolvedValue(new Map())
	const findSavedByMessages = vi.fn().mockResolvedValue([])
	const service = new ChatHistoryMarkersService(
		{ findStartedByMessages } as never,
		{ findByMessageIds } as never,
		{ findForHistory } as never,
		{ countForgottenFacts, findReadDigests } as never,
		{ findSavedByMessages } as never,
	)
	return {
		service,
		findStartedByMessages,
		findByMessageIds,
		findForHistory,
		countForgottenFacts,
		findReadDigests,
		findSavedByMessages,
	}
}

describe('ChatHistoryMarkersService.getMarkers', () => {
	let mocks: ReturnType<typeof createService>

	beforeEach(() => {
		mocks = createService()
	})

	const get = (messageIds: string[], overrides = {}) =>
		mocks.service.getMarkers({
			userId: USER_ID,
			messageIds,
			workoutRefIds: NO_REFS,
			factRefById: new Map(),
			foodRefById: new Map(),
			...overrides,
		})

	it('asks nothing without messages', async () => {
		expect(await get([])).toEqual(new Map())
		expect(mocks.findStartedByMessages).not.toHaveBeenCalled()
		expect(mocks.countForgottenFacts).not.toHaveBeenCalled()
	})

	it('asks every source once for all the messages, with the user of the token', async () => {
		await get(['m1', 'm2'])

		for (const call of [
			mocks.findByMessageIds,
			mocks.findForHistory,
			mocks.countForgottenFacts,
			mocks.findStartedByMessages,
			mocks.findSavedByMessages,
		]) {
			expect(call).toHaveBeenCalledTimes(1)
		}
		expect(mocks.findByMessageIds).toHaveBeenCalledWith({
			userId: USER_ID,
			messageIds: ['m1', 'm2'],
		})
		expect(mocks.findForHistory).toHaveBeenCalledWith(USER_ID, ['m1', 'm2'])
		expect(mocks.countForgottenFacts).toHaveBeenCalledWith(USER_ID, ['m1', 'm2'])
		expect(mocks.findStartedByMessages).toHaveBeenCalledWith(USER_ID, ['m1', 'm2'])
		expect(mocks.findSavedByMessages).toHaveBeenCalledWith(USER_ID, ['m1', 'm2'])
	})

	it('leaves out a message that did nothing', async () => {
		const markers = await get(['m1', 'm2'])
		expect(markers.size).toBe(0)
	})

	it('turns the rows of the sources into the markers of their message', async () => {
		mocks.findStartedByMessages.mockResolvedValue([
			{ id: 'w-a', sourceMessageId: 'm1', deletedAt: NOW },
		])
		mocks.findByMessageIds.mockResolvedValue([
			{ kind: MeasurementKind.WEIGHT, messageId: 'm1', deletedAt: null },
		])
		mocks.countForgottenFacts.mockResolvedValue(new Map([['m2', 1]]))
		mocks.findForHistory.mockResolvedValue([
			{
				id: 'fact-1',
				status: 'CONFIRMED',
				sourceMessageId: 'm2',
				confirmedMessageId: null,
				answeredAt: null,
				deletedAt: null,
			},
		])
		mocks.findSavedByMessages.mockResolvedValue([
			{ id: 'food-a', sourceMessageId: 'm2', deletedAt: null },
		])

		const markers = await get(['m1', 'm2'], {
			workoutRefIds: { ...NO_REFS, deletedWorkouts: new Map([['w3', 'w-a']]) },
			factRefById: new Map([['fact-1', 'f4']]),
			foodRefById: new Map([['food-a', 'm1']]),
		})

		expect(markers.get('m1')).toEqual({
			workout: { refs: ['w3'], deletedRefs: ['w3'], isDeleted: true },
			measurements: [{ kind: 'weight', isDeleted: false }],
		})
		expect(markers.get('m2')).toEqual({
			facts: [{ kind: 'forgotten' }, { kind: 'saved', ref: 'f4', isDeleted: false }],
			savedFoods: [{ ref: 'm1', isDeleted: false }],
		})
	})
})

describe('ChatHistoryMarkersService.getReadDigests', () => {
	it('asks the AI service for the digests of the messages, for the user of the token', async () => {
		const mocks = createService()
		const digests = new Map([['m1', ['read workouts 01.11–10.11: 3']]])
		mocks.findReadDigests.mockResolvedValue(digests)

		expect(await mocks.service.getReadDigests(USER_ID, ['m1', 'm2'])).toBe(digests)
		expect(mocks.findReadDigests).toHaveBeenCalledWith(USER_ID, ['m1', 'm2'])
	})
})
