import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { Achievement, Prisma } from '../../generated/prisma/client'
import type { EntriesService } from '../entries/entries.service'
import type { MeasurementsService } from '../measurements/measurements.service'
import type { ProfileService } from '../profile/profile.service'
import type { AchievementsRepository } from './achievements.repository'
import { AchievementsService } from './achievements.service'

const USER_ID = '01999a00-0000-7000-8000-000000000001'
const REPLY_ID = '01999a00-0000-7000-8000-0000000000aa'
const TIMEZONE = 'Europe/Warsaw'
const tx = { tag: 'tx' } as unknown as Prisma.TransactionClient

const toRow = (type: Achievement['type'], value: number): Achievement => ({
	id: `row-${value}`,
	userId: USER_ID,
	type,
	value,
	achievedAt: new Date(),
	messageId: null,
	createdAt: new Date(),
})

const toDays = (dates: string[]): Map<string, { kcal: number; entryCount: number }> =>
	new Map(dates.map((date) => [date, { kcal: 500, entryCount: 1 }]))

describe('AchievementsService.recordForTurn', () => {
	const repository = {
		createMissing: vi.fn<AchievementsRepository['createMissing']>(),
		attachToMessage: vi.fn<AchievementsRepository['attachToMessage']>(),
	}
	const entries = { getDaysKcal: vi.fn<EntriesService['getDaysKcal']>() }
	const measurements = {
		findFirst: vi.fn<MeasurementsService['findFirst']>(),
		findLatest: vi.fn<MeasurementsService['findLatest']>(),
	}
	const profile = { findWeightGoal: vi.fn<ProfileService['findWeightGoal']>() }
	const service = new AchievementsService(
		repository as unknown as AchievementsRepository,
		entries as unknown as EntriesService,
		measurements as unknown as MeasurementsService,
		profile as unknown as ProfileService,
	)

	const recordFood = (now: Date) =>
		service.recordForTurn(
			{
				userId: USER_ID,
				timezone: TIMEZONE,
				now,
				replyMessageId: REPLY_ID,
				isFoodChanged: true,
				isWeightLogged: false,
			},
			tx,
		)

	beforeEach(() => {
		vi.resetAllMocks()
		repository.createMissing.mockImplementation(({ type, values }) =>
			Promise.resolve(values.map((value) => toRow(type, value))),
		)
		repository.attachToMessage.mockResolvedValue(undefined)
		profile.findWeightGoal.mockResolvedValue({
			goalType: null,
			targetWeightKg: null,
			paceKgPerWeek: null,
		})
	})

	describe('food streak', () => {
		it('counts the day by the user timezone: 23:30 in Warsaw is still that evening', async () => {
			// 21:30 UTC = 23:30 CEST on the 12th
			entries.getDaysKcal.mockResolvedValue(toDays(['2026-10-10', '2026-10-11', '2026-10-12']))

			await recordFood(new Date('2026-10-12T21:30:00Z'))

			expect(entries.getDaysKcal).toHaveBeenCalledWith(
				USER_ID,
				{ from: new Date('2026-07-05T00:00:00Z'), to: new Date('2026-10-12T00:00:00Z') },
				tx,
			)
			expect(repository.createMissing.mock.calls[0]?.[0].values).toEqual([3])
		})

		it('starts a new day after midnight in Warsaw, which is not yet midnight in UTC', async () => {
			// 22:30 UTC = 00:30 CEST on the 13th: that day has no food yet
			entries.getDaysKcal.mockResolvedValue(toDays(['2026-10-10', '2026-10-11', '2026-10-12']))

			await recordFood(new Date('2026-10-12T22:30:00Z'))

			expect(repository.createMissing).not.toHaveBeenCalled()
		})

		it('stores every reached milestone but announces only the highest new one', async () => {
			const dates = Array.from({ length: 20 }, (_, index) => {
				const day = new Date(Date.UTC(2026, 9, 12 - index))
				return day.toISOString().slice(0, 10)
			})
			entries.getDaysKcal.mockResolvedValue(toDays(dates))

			await recordFood(new Date('2026-10-12T12:00:00Z'))

			expect(repository.createMissing.mock.calls[0]?.[0].values).toEqual([3, 7, 14])
			expect(repository.attachToMessage).toHaveBeenCalledOnce()
			expect(repository.attachToMessage).toHaveBeenCalledWith(
				{ userId: USER_ID, id: 'row-14', messageId: REPLY_ID },
				tx,
			)
		})

		it('announces nothing when the insert saw every threshold already', async () => {
			entries.getDaysKcal.mockResolvedValue(toDays(['2026-10-10', '2026-10-11', '2026-10-12']))
			repository.createMissing.mockResolvedValue([])

			await recordFood(new Date('2026-10-12T12:00:00Z'))

			expect(repository.attachToMessage).not.toHaveBeenCalled()
		})
	})

	describe('kg lost', () => {
		const recordWeight = () =>
			service.recordForTurn(
				{
					userId: USER_ID,
					timezone: TIMEZONE,
					now: new Date('2026-10-12T12:00:00Z'),
					replyMessageId: REPLY_ID,
					isFoodChanged: false,
					isWeightLogged: true,
				},
				tx,
			)

		const weigh = (value: number) => ({
			id: 'm',
			kind: 'WEIGHT' as const,
			value,
			localDate: new Date('2026-10-12T00:00:00Z'),
			measuredAt: new Date(),
			source: 'CHAT' as const,
			messageId: null,
		})

		it('writes the whole kilograms between the first and the latest weight', async () => {
			measurements.findFirst.mockResolvedValue(weigh(84))
			measurements.findLatest.mockResolvedValue(weigh(81.9))

			await recordWeight()

			expect(repository.createMissing.mock.calls[0]?.[0].values).toEqual([1, 2])
			expect(repository.attachToMessage).toHaveBeenCalledWith(
				{ userId: USER_ID, id: 'row-2', messageId: REPLY_ID },
				tx,
			)
		})

		it('writes nothing for a part of a kilogram', async () => {
			measurements.findFirst.mockResolvedValue(weigh(84))
			measurements.findLatest.mockResolvedValue(weigh(83.1))

			await recordWeight()

			expect(repository.createMissing).not.toHaveBeenCalled()
		})

		it.each(['GAIN', 'MAINTAIN'] as const)(
			'does not celebrate losing with the goal %s',
			async (goalType) => {
				profile.findWeightGoal.mockResolvedValue({
					goalType,
					targetWeightKg: 90,
					paceKgPerWeek: null,
				})
				measurements.findFirst.mockResolvedValue(weigh(84))
				measurements.findLatest.mockResolvedValue(weigh(80))

				await recordWeight()

				expect(repository.createMissing).not.toHaveBeenCalled()
			},
		)

		it('celebrates for the goal LOSE', async () => {
			profile.findWeightGoal.mockResolvedValue({
				goalType: 'LOSE',
				targetWeightKg: 75,
				paceKgPerWeek: 0.5,
			})
			measurements.findFirst.mockResolvedValue(weigh(84))
			measurements.findLatest.mockResolvedValue(weigh(83))

			await recordWeight()

			expect(repository.createMissing.mock.calls[0]?.[0].values).toEqual([1])
		})
	})

	it('checks nothing when the turn neither changed food nor logged a weight', async () => {
		await service.recordForTurn(
			{
				userId: USER_ID,
				timezone: TIMEZONE,
				now: new Date(),
				replyMessageId: REPLY_ID,
				isFoodChanged: false,
				isWeightLogged: false,
			},
			tx,
		)

		expect(entries.getDaysKcal).not.toHaveBeenCalled()
		expect(measurements.findFirst).not.toHaveBeenCalled()
	})
})
