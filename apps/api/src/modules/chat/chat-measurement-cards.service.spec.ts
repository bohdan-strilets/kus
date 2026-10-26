import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { MeasurementValue } from '../measurements/measurements.mapper'
import type { MeasurementsService } from '../measurements/measurements.service'
import type { ProfileService } from '../profile/profile.service'
import type { UsersService } from '../users/users.service'
import { ChatMeasurementCardsService } from './chat-measurement-cards.service'

const USER_ID = 'user-1'
const MESSAGE_ID = 'message-1'

const toWaist = (id: string, value: number, date: string, createdAt: string): MeasurementValue => ({
	id,
	kind: 'WAIST',
	value,
	localDate: new Date(`${date}T00:00:00Z`),
	measuredAt: new Date(`${date}T12:00:00Z`),
	source: 'CHAT',
	messageId: null,
	createdAt: new Date(createdAt),
	deletedAt: null,
})

// production's waist: 101 written first, 102 for an earlier day a minute later
const FIRST = toWaist('w101', 101, '2026-10-13', '2026-10-13T15:26:53Z')
const START_BY_DAY = toWaist('w102', 102, '2026-10-09', '2026-10-13T15:27:57Z')
const LAST = { ...toWaist('w99b', 99, '2026-10-25', '2026-10-25T08:00:00Z'), messageId: MESSAGE_ID }

describe('ChatMeasurementCardsService', () => {
	const measurements = {
		findByMessageIds: vi.fn<MeasurementsService['findByMessageIds']>(),
		findStart: vi.fn<MeasurementsService['findStart']>(),
		findFirst: vi.fn<MeasurementsService['findFirst']>(),
		findInRange: vi.fn<MeasurementsService['findInRange']>(),
	}
	let service: ChatMeasurementCardsService

	beforeEach(() => {
		vi.resetAllMocks()
		measurements.findStart.mockResolvedValue(START_BY_DAY)
		measurements.findFirst.mockResolvedValue(FIRST)
		measurements.findInRange.mockResolvedValue([START_BY_DAY, FIRST, LAST])
		service = new ChatMeasurementCardsService(
			measurements as unknown as MeasurementsService,
			{
				findWeightGoal: vi
					.fn()
					.mockResolvedValue({ goalType: null, targetWeightKg: null, paceKgPerWeek: null }),
			} as unknown as ProfileService,
			{
				getMe: vi.fn().mockResolvedValue({ timezone: 'Europe/Warsaw' }),
			} as unknown as UsersService,
		)
	})

	it('counts fromStart from the start by day, not from the first written value', async () => {
		measurements.findByMessageIds.mockResolvedValue([LAST])

		const cards = await service.getCardsByMessage(USER_ID, [MESSAGE_ID])

		expect(cards.get(MESSAGE_ID)?.[0]?.fromStart).toBe(-3)
		expect(measurements.findStart).toHaveBeenCalledWith({ userId: USER_ID, kind: 'WAIST' })
		expect(measurements.findFirst).not.toHaveBeenCalled()
	})

	it('gives the single card the same start (the edit sheet answer)', async () => {
		const card = await service.getCard(USER_ID, LAST)

		expect(card.fromStart).toBe(-3)
		expect(measurements.findFirst).not.toHaveBeenCalled()
	})

	it('has no fromStart for the start value itself', async () => {
		const row = { ...START_BY_DAY, messageId: MESSAGE_ID }
		measurements.findByMessageIds.mockResolvedValue([row])

		const cards = await service.getCardsByMessage(USER_ID, [MESSAGE_ID])

		expect(cards.get(MESSAGE_ID)?.[0]?.fromStart).toBeNull()
	})

	it('returns no cards and asks for no start when the messages recorded nothing', async () => {
		measurements.findByMessageIds.mockResolvedValue([])

		const cards = await service.getCardsByMessage(USER_ID, [MESSAGE_ID])

		expect(cards.size).toBe(0)
		expect(measurements.findStart).not.toHaveBeenCalled()
	})
})
