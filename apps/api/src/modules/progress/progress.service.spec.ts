import { beforeEach, describe, expect, it, vi } from 'vitest'

import { getLocalDateString } from '../../common/time'
import { MeasurementKind } from '../../generated/prisma/client'
import type { EntriesService } from '../entries/entries.service'
import type { GoalsService } from '../goals/goals.service'
import type { MeasurementValue } from '../measurements/measurements.mapper'
import type { MeasurementsService } from '../measurements/measurements.service'
import type { ProfileService } from '../profile/profile.service'
import type { UsersService } from '../users/users.service'
import { ProgressService } from './progress.service'

const TIMEZONE = 'Europe/Warsaw'
const USER_ID = 'user-1'
const DAY_MS = 24 * 60 * 60 * 1000

const daysAgo = (days: number): Date => {
	const today = new Date(`${getLocalDateString(new Date(), TIMEZONE)}T00:00:00Z`)
	return new Date(today.getTime() - days * DAY_MS)
}

const toWeight = (id: string, value: number, localDate: Date): MeasurementValue => ({
	id,
	kind: 'WEIGHT',
	value,
	localDate,
	measuredAt: localDate,
	source: 'CHAT',
	messageId: null,
	createdAt: localDate,
	deletedAt: null,
})

describe('ProgressService weight start', () => {
	const measurements = { findLatest: vi.fn(), findFirst: vi.fn(), findInRange: vi.fn() }
	let service: ProgressService

	beforeEach(() => {
		vi.resetAllMocks()
		measurements.findLatest.mockImplementation(({ kind }: { kind: string }) =>
			Promise.resolve(
				kind === MeasurementKind.WEIGHT ? toWeight('latest', 82.4, daysAgo(0)) : null,
			),
		)
		measurements.findInRange.mockResolvedValue([])
		service = new ProgressService(
			{ getDaysTotals: vi.fn().mockResolvedValue(new Map()) } as unknown as EntriesService,
			{ getGoalKcalByDay: vi.fn().mockResolvedValue(new Map()) } as unknown as GoalsService,
			measurements as unknown as MeasurementsService,
			{
				findWeightGoal: vi
					.fn()
					.mockResolvedValue({ goalType: null, targetWeightKg: null, paceKgPerWeek: null }),
			} as unknown as ProfileService,
			{ getMe: vi.fn().mockResolvedValue({ timezone: TIMEZONE }) } as unknown as UsersService,
		)
	})

	it('takes the start from the first live weigh-in and counts the change from it', async () => {
		measurements.findFirst.mockResolvedValue(toWeight('first', 85, daysAgo(40)))

		const { weight } = await service.getProgress(USER_ID, 7)

		expect(weight?.start).toEqual({ value: 85, localDate: getLocalDateString(daysAgo(40), 'UTC') })
		expect(weight?.fromStart).toBe(-2.6)
		expect(measurements.findFirst).toHaveBeenCalledWith({
			userId: USER_ID,
			kind: MeasurementKind.WEIGHT,
		})
	})

	it('has no change from the start when the start is the current value', async () => {
		measurements.findFirst.mockResolvedValue(toWeight('latest', 82.4, daysAgo(0)))

		const { weight } = await service.getProgress(USER_ID, 7)

		expect(weight?.start).toMatchObject({ value: 82.4 })
		expect(weight?.fromStart).toBeNull()
	})

	it('has no start when nothing is left to start from', async () => {
		measurements.findFirst.mockResolvedValue(null)

		const { weight } = await service.getProgress(USER_ID, 7)

		expect(weight).toMatchObject({ start: null, fromStart: null })
	})
})
