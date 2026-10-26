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

const toRow = (
	id: string,
	value: number,
	localDate: Date,
	kind: MeasurementValue['kind'] = 'WEIGHT',
): MeasurementValue => ({
	id,
	kind,
	value,
	localDate,
	measuredAt: localDate,
	source: 'CHAT',
	messageId: null,
	createdAt: localDate,
	deletedAt: null,
})

describe('ProgressService start and change', () => {
	const measurements = {
		findLatest: vi.fn(),
		findStart: vi.fn(),
		findInRange: vi.fn(),
		findBefore: vi.fn(),
	}
	let service: ProgressService

	beforeEach(() => {
		vi.resetAllMocks()
		measurements.findLatest.mockImplementation(({ kind }: { kind: string }) =>
			Promise.resolve(kind === MeasurementKind.WEIGHT ? toRow('latest', 82.4, daysAgo(0)) : null),
		)
		measurements.findInRange.mockResolvedValue([])
		measurements.findBefore.mockResolvedValue(null)
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
		measurements.findStart.mockResolvedValue(toRow('first', 85, daysAgo(40)))

		const { weight } = await service.getProgress(USER_ID, 7)

		expect(weight?.start).toEqual({ value: 85, localDate: getLocalDateString(daysAgo(40), 'UTC') })
		expect(weight?.fromStart).toBe(-2.6)
		expect(measurements.findStart).toHaveBeenCalledWith({
			userId: USER_ID,
			kind: MeasurementKind.WEIGHT,
		})
	})

	it('has no change from the start when the start is the current value', async () => {
		measurements.findStart.mockResolvedValue(toRow('latest', 82.4, daysAgo(0)))

		const { weight } = await service.getProgress(USER_ID, 7)

		expect(weight?.start).toMatchObject({ value: 82.4 })
		expect(weight?.fromStart).toBeNull()
	})

	it('has no start when nothing is left to start from', async () => {
		measurements.findStart.mockResolvedValue(null)

		const { weight } = await service.getProgress(USER_ID, 7)

		expect(weight).toMatchObject({ start: null, fromStart: null })
	})

	it('gives the waist the same start and change from it as the weight', async () => {
		measurements.findLatest.mockImplementation(({ kind }: { kind: string }) =>
			Promise.resolve(
				kind === MeasurementKind.WAIST ? toRow('w-latest', 99, daysAgo(1), 'WAIST') : null,
			),
		)
		measurements.findStart.mockResolvedValue(toRow('w-start', 102, daysAgo(17), 'WAIST'))

		const { waist } = await service.getProgress(USER_ID, 30)

		expect(waist).toMatchObject({ start: { value: 102 }, fromStart: -3 })
		expect(measurements.findStart).toHaveBeenCalledWith({
			userId: USER_ID,
			kind: MeasurementKind.WAIST,
		})
	})

	describe('one value in the range', () => {
		beforeEach(() => {
			measurements.findStart.mockResolvedValue(null)
		})

		it('compares it with the latest value before the range', async () => {
			measurements.findInRange.mockResolvedValue([toRow('latest', 82.4, daysAgo(0))])
			measurements.findBefore.mockResolvedValue(toRow('older', 85.4, daysAgo(10)))

			const { weight } = await service.getProgress(USER_ID, 7)

			expect(weight?.changeInRange).toBeNull()
			expect(weight?.changeSince).toEqual({
				change: -3,
				sinceDate: getLocalDateString(daysAgo(10), 'UTC'),
			})
			expect(measurements.findBefore).toHaveBeenCalledWith({
				userId: USER_ID,
				kind: MeasurementKind.WEIGHT,
				before: daysAgo(6),
			})
		})

		it('has no change when nothing precedes the range', async () => {
			measurements.findInRange.mockResolvedValue([toRow('latest', 82.4, daysAgo(0))])

			const { weight } = await service.getProgress(USER_ID, 7)

			expect(weight?.changeSince).toBeNull()
		})

		it('leaves the change to changeInRange with two values', async () => {
			measurements.findInRange.mockResolvedValue([
				toRow('a', 84, daysAgo(3)),
				toRow('latest', 82.4, daysAgo(0)),
			])

			const { weight } = await service.getProgress(USER_ID, 7)

			expect(weight).toMatchObject({ changeInRange: -1.6, changeSince: null })
			expect(measurements.findBefore).not.toHaveBeenCalled()
		})
	})
})
