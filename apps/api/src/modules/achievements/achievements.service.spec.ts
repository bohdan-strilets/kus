import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { Achievement, MeasurementSource, Prisma } from '../../generated/prisma/client'
import type { EntriesService } from '../entries/entries.service'
import type { MeasurementsService } from '../measurements/measurements.service'
import type { ProfileService } from '../profile/profile.service'
import type { AchievementsRepository } from './achievements.repository'
import { AchievementsService } from './achievements.service'

const USER_ID = '01999a00-0000-7000-8000-000000000001'
const REPLY_ID = '01999a00-0000-7000-8000-0000000000aa'
const USER_MESSAGE_ID = '01999a00-0000-7000-8000-0000000000bb'
const OLD_MESSAGE_ID = '01999a00-0000-7000-8000-0000000000cc'
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
		findBefore: vi.fn<MeasurementsService['findBefore']>(),
		findInRange: vi.fn<MeasurementsService['findInRange']>(),
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
				userMessageId: USER_MESSAGE_ID,
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
		measurements.findBefore.mockResolvedValue(null)
		measurements.findInRange.mockResolvedValue([])
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

	describe('food streak with entries on other days', () => {
		const NOW = new Date('2026-10-12T12:00:00Z')

		/** Like the database: only the days inside the requested range come back. */
		const mockDaysInRange = (dates: string[]) =>
			entries.getDaysKcal.mockImplementation((_userId, { from, to }) =>
				Promise.resolve(
					toDays(
						dates.filter((date) => {
							const day = new Date(`${date}T00:00:00Z`)
							return day >= from && day <= to
						}),
					),
				),
			)

		const awardedValues = (): number[] | undefined =>
			repository.createMissing.mock.calls[0]?.[0].values

		describe('tomorrow', () => {
			it('is not counted: three days up to tomorrow are a streak of two', async () => {
				mockDaysInRange(['2026-10-11', '2026-10-12', '2026-10-13'])

				await recordFood(NOW)

				expect(repository.createMissing).not.toHaveBeenCalled()
			})

			it('does not change the streak of today and pays nothing for itself', async () => {
				mockDaysInRange(['2026-10-10', '2026-10-11', '2026-10-12', '2026-10-13', '2026-10-14'])

				await recordFood(NOW)

				expect(awardedValues()).toEqual([3])
			})

			it('does not break today and does not make it: food only tomorrow is a streak of zero', async () => {
				mockDaysInRange(['2026-10-13'])

				await recordFood(NOW)

				expect(repository.createMissing).not.toHaveBeenCalled()
			})

			it('is not read at all: the range ends today', async () => {
				mockDaysInRange(['2026-10-13'])

				await recordFood(NOW)

				expect(entries.getDaysKcal.mock.calls[0]?.[1].to).toEqual(new Date('2026-10-12T00:00:00Z'))
			})
		})

		describe('yesterday, back-dated', () => {
			it('closes the gap with an empty yesterday and pays the milestone of the joined run', async () => {
				// 10-10 and 10-09 were a run cut off by an empty 10-11; today has food
				mockDaysInRange(['2026-10-12', '2026-10-10', '2026-10-09'])
				await recordFood(NOW)
				expect(repository.createMissing).not.toHaveBeenCalled()

				mockDaysInRange(['2026-10-12', '2026-10-11', '2026-10-10', '2026-10-09'])
				await recordFood(NOW)
				expect(awardedValues()).toEqual([3])
			})

			it('with food today only extends the run by one day, no milestone yet', async () => {
				mockDaysInRange(['2026-10-12', '2026-10-11'])

				await recordFood(NOW)

				expect(repository.createMissing).not.toHaveBeenCalled()
			})

			it('pays nothing while today is empty, however long the run behind it', async () => {
				mockDaysInRange(['2026-10-11', '2026-10-10', '2026-10-09', '2026-10-08'])

				await recordFood(NOW)

				expect(repository.createMissing).not.toHaveBeenCalled()
			})
		})

		describe('two and three days ago, back-dated', () => {
			it('closes a gap two days ago and pays the milestone', async () => {
				mockDaysInRange(['2026-10-12', '2026-10-11', '2026-10-10'])

				await recordFood(NOW)

				expect(awardedValues()).toEqual([3])
			})

			it('closes a gap three days ago when the days between have food', async () => {
				mockDaysInRange(['2026-10-12', '2026-10-11', '2026-10-10', '2026-10-09'])

				await recordFood(NOW)

				expect(awardedValues()).toEqual([3])
			})

			it('does not help the streak while yesterday stays empty', async () => {
				mockDaysInRange(['2026-10-12', '2026-10-10', '2026-10-09'])

				await recordFood(NOW)

				expect(repository.createMissing).not.toHaveBeenCalled()
			})
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
					userMessageId: USER_MESSAGE_ID,
					isFoodChanged: false,
					isWeightLogged: true,
				},
				tx,
			)

		const weigh = (
			value: number,
			{
				localDate = '2026-10-12',
				source = 'CHAT',
				messageId = USER_MESSAGE_ID,
			}: { localDate?: string; source?: MeasurementSource; messageId?: string } = {},
		) => ({
			id: 'm',
			kind: 'WEIGHT' as const,
			value,
			localDate: new Date(`${localDate}T00:00:00Z`),
			measuredAt: new Date(),
			source,
			messageId,
			createdAt: new Date(),
			deletedAt: null,
		})

		/** The weights from the base to the current one, oldest first, one per day. */
		const toChain = (...values: number[]) =>
			values.map((value, index) =>
				weigh(value, { localDate: `2026-10-${String(1 + index).padStart(2, '0')}` }),
			)

		it('writes the whole kilograms between the first and the latest weight', async () => {
			measurements.findFirst.mockResolvedValue(weigh(84))
			measurements.findLatest.mockResolvedValue(weigh(81.9))
			measurements.findInRange.mockResolvedValue(toChain(84, 81.9))

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
			measurements.findInRange.mockResolvedValue(toChain(84, 83.1))

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
				measurements.findInRange.mockResolvedValue(toChain(84, 80))

				await recordWeight()

				expect(repository.createMissing).not.toHaveBeenCalled()
			},
		)

		describe('a big step from the previous weight', () => {
			it('writes nothing for a step of more than 3 kg, of any age', async () => {
				const base = weigh(90, { localDate: '2026-01-01' })
				measurements.findFirst.mockResolvedValue(base)
				measurements.findLatest.mockResolvedValue(weigh(70))
				measurements.findBefore.mockResolvedValue(base)
				measurements.findInRange.mockResolvedValue([base, weigh(70)])

				await recordWeight()

				expect(repository.createMissing).not.toHaveBeenCalled()
				expect(measurements.findBefore).toHaveBeenCalledWith(
					{
						userId: USER_ID,
						kind: 'WEIGHT',
						before: new Date('2026-10-12T00:00:00Z'),
						source: 'CHAT',
					},
					tx,
				)
			})

			it('writes a kilogram for a step of 1.5 kg', async () => {
				measurements.findFirst.mockResolvedValue(weigh(90))
				measurements.findLatest.mockResolvedValue(weigh(88.5))
				measurements.findInRange.mockResolvedValue(toChain(90, 88.5))

				await recordWeight()

				expect(repository.createMissing.mock.calls[0]?.[0].values).toEqual([1])
			})

			it('counts a step of exactly 3.0 kg', async () => {
				measurements.findFirst.mockResolvedValue(weigh(90))
				measurements.findLatest.mockResolvedValue(weigh(87))
				measurements.findInRange.mockResolvedValue(toChain(90, 87))

				await recordWeight()

				expect(repository.createMissing.mock.calls[0]?.[0].values).toEqual([1, 2, 3])
			})

			it('skips a step of 3.1 kg', async () => {
				measurements.findFirst.mockResolvedValue(weigh(90))
				measurements.findLatest.mockResolvedValue(weigh(86.9))
				measurements.findInRange.mockResolvedValue(toChain(90, 86.9))

				await recordWeight()

				expect(repository.createMissing).not.toHaveBeenCalled()
			})

			it('never pays out the interval of a skipped jump: 70 then 69.5 writes nothing', async () => {
				measurements.findFirst.mockResolvedValue(weigh(90))
				measurements.findLatest.mockResolvedValue(weigh(69.5))
				measurements.findInRange.mockResolvedValue(toChain(90, 70, 69.5))

				await recordWeight()

				expect(repository.createMissing).not.toHaveBeenCalled()
			})

			it('writes only the threshold crossed after the jump: 69.5 then 68.9 gives 21', async () => {
				measurements.findFirst.mockResolvedValue(weigh(90))
				measurements.findLatest.mockResolvedValue(weigh(68.9))
				measurements.findInRange.mockResolvedValue(toChain(90, 70, 69.5, 68.9))

				await recordWeight()

				expect(repository.createMissing.mock.calls[0]?.[0].values).toEqual([21])
			})

			it('writes nothing when the weight did not change or went up', async () => {
				measurements.findFirst.mockResolvedValue(weigh(90))
				// the earlier 88.5 was a chat weight, so it is the base the chain starts from
				measurements.findBefore.mockResolvedValue(weigh(88.5))
				measurements.findLatest.mockResolvedValue(weigh(88.5))
				measurements.findInRange.mockResolvedValue(toChain(88.5, 88.5))
				await recordWeight()
				measurements.findLatest.mockResolvedValue(weigh(89.5))
				measurements.findInRange.mockResolvedValue(toChain(88.5, 89.5))
				await recordWeight()

				expect(repository.createMissing).not.toHaveBeenCalled()
			})

			it('writes nothing for the first record: there is no previous weight', async () => {
				measurements.findFirst.mockResolvedValue(weigh(90))
				measurements.findLatest.mockResolvedValue(weigh(90))
				measurements.findInRange.mockResolvedValue([weigh(90)])

				await recordWeight()

				expect(repository.createMissing).not.toHaveBeenCalled()
			})
		})

		it('celebrates for the goal LOSE', async () => {
			profile.findWeightGoal.mockResolvedValue({
				goalType: 'LOSE',
				targetWeightKg: 75,
				paceKgPerWeek: 0.5,
			})
			measurements.findFirst.mockResolvedValue(weigh(84))
			measurements.findLatest.mockResolvedValue(weigh(83))
			measurements.findInRange.mockResolvedValue(toChain(84, 83))

			await recordWeight()

			expect(repository.createMissing.mock.calls[0]?.[0].values).toEqual([1])
		})

		describe('edited and back-dated weights', () => {
			it('does not announce a weight edited down, but pays it with the next chat weight', async () => {
				// 84 (chat) → edited to 82 by hand (a correction of 2 kg) → a chat weight of 82.5 today
				const base = weigh(84, { localDate: '2026-10-05', messageId: OLD_MESSAGE_ID })
				const edited = weigh(82, {
					localDate: '2026-10-08',
					source: 'EDIT',
					messageId: OLD_MESSAGE_ID,
				})
				measurements.findFirst.mockResolvedValue(weigh(85, { localDate: '2026-10-01' }))
				measurements.findLatest.mockResolvedValue(edited)
				await recordWeight()
				expect(repository.createMissing).not.toHaveBeenCalled()

				measurements.findLatest.mockResolvedValue(weigh(82.5))
				measurements.findBefore.mockResolvedValue(base)
				measurements.findInRange.mockResolvedValue([base, edited, weigh(82.5)])
				await recordWeight()

				expect(repository.createMissing.mock.calls[0]?.[0].values).toEqual([2])
			})

			it('keeps an edit of more than 3 kg as the new base instead of paying it', async () => {
				const base = weigh(88, { localDate: '2026-10-05', messageId: OLD_MESSAGE_ID })
				const edited = weigh(84, {
					localDate: '2026-10-08',
					source: 'EDIT',
					messageId: OLD_MESSAGE_ID,
				})
				measurements.findFirst.mockResolvedValue(weigh(88, { localDate: '2026-10-01' }))
				measurements.findLatest.mockResolvedValue(weigh(83.5))
				measurements.findBefore.mockResolvedValue(base)
				measurements.findInRange.mockResolvedValue([base, edited, weigh(83.5)])

				await recordWeight()

				// 4 kg step to the edit: the base moves to 84, only 83.5 − 84 counts: no whole kg
				expect(repository.createMissing).not.toHaveBeenCalled()
			})

			it('never takes an edited weight as the base', async () => {
				measurements.findFirst.mockResolvedValue(weigh(90, { localDate: '2026-10-01' }))
				measurements.findLatest.mockResolvedValue(weigh(88))

				await recordWeight()

				expect(measurements.findBefore).toHaveBeenCalledWith(
					expect.objectContaining({ source: 'CHAT' }),
					tx,
				)
			})

			it('does not announce a weight written for an earlier day than a newer chat weight', async () => {
				// this turn wrote 87.2 for 10-08; a chat weight of 86.4 from 10-12 is newer by day and
				// sits one small step (0.8 kg) after it, crossing the third kilogram of the 90 start
				const backDated = weigh(87.2, { localDate: '2026-10-08', messageId: USER_MESSAGE_ID })
				const newest = weigh(86.4, { localDate: '2026-10-12', messageId: OLD_MESSAGE_ID })
				measurements.findFirst.mockResolvedValue(weigh(90, { localDate: '2026-10-01' }))
				measurements.findLatest.mockResolvedValue(newest)
				measurements.findBefore.mockResolvedValue(backDated)
				measurements.findInRange.mockResolvedValue([backDated, newest])

				await recordWeight()

				expect(repository.createMissing).not.toHaveBeenCalled()
				expect(repository.attachToMessage).not.toHaveBeenCalled()
			})

			it('does not announce a back-dated chat weight even when it would cross a kilogram', async () => {
				// the step to the newest weight is small, so only the message guard can stop the payout
				const newest = weigh(88.9, { localDate: '2026-10-12', messageId: OLD_MESSAGE_ID })
				measurements.findFirst.mockResolvedValue(weigh(90, { localDate: '2026-10-01' }))
				measurements.findLatest.mockResolvedValue(newest)
				measurements.findInRange.mockResolvedValue([weigh(90), newest])

				await recordWeight()

				expect(repository.createMissing).not.toHaveBeenCalled()
				expect(repository.attachToMessage).not.toHaveBeenCalled()
			})

			it('moves the base to the previous chat weight when the base is deleted', async () => {
				// the repository no longer returns the deleted row: the nearest live chat weight is the base
				const previous = weigh(90, { localDate: '2026-09-20', messageId: OLD_MESSAGE_ID })
				measurements.findFirst.mockResolvedValue(previous)
				measurements.findLatest.mockResolvedValue(weigh(88.9))
				measurements.findBefore.mockResolvedValue(previous)
				measurements.findInRange.mockResolvedValue([previous, weigh(88.9)])

				await recordWeight()

				expect(measurements.findInRange.mock.calls[0]?.[0].from).toEqual(
					new Date('2026-09-20T00:00:00Z'),
				)
				expect(repository.createMissing.mock.calls[0]?.[0].values).toEqual([1])
			})

			it('does not revoke what was paid: a lower start after a deletion only adds', async () => {
				measurements.findFirst.mockResolvedValue(weigh(84, { localDate: '2026-10-01' }))
				measurements.findLatest.mockResolvedValue(weigh(83.9))
				measurements.findInRange.mockResolvedValue(toChain(84, 83.9))

				await recordWeight()

				expect(repository.createMissing).not.toHaveBeenCalled()
			})
		})

		describe('a weight from the profile', () => {
			it('does nothing when the latest weight comes from the profile', async () => {
				measurements.findFirst.mockResolvedValue(weigh(84))
				measurements.findLatest.mockResolvedValue(weigh(82, { source: 'PROFILE' }))
				measurements.findInRange.mockResolvedValue(toChain(84, 82))

				await recordWeight()

				expect(repository.createMissing).not.toHaveBeenCalled()
				expect(repository.attachToMessage).not.toHaveBeenCalled()
			})

			it('reads the base among the chat weights and the chain from that day on', async () => {
				const base = weigh(86, { localDate: '2026-10-05' })
				measurements.findFirst.mockResolvedValue(weigh(90, { localDate: '2026-10-01' }))
				measurements.findLatest.mockResolvedValue(weigh(84.9))
				measurements.findBefore.mockResolvedValue(base)
				measurements.findInRange.mockResolvedValue([
					base,
					weigh(85, { localDate: '2026-10-08', source: 'PROFILE' }),
					weigh(84.9),
				])

				await recordWeight()

				expect(measurements.findInRange).toHaveBeenCalledWith(
					{
						userId: USER_ID,
						kind: 'WEIGHT',
						from: new Date('2026-10-05T00:00:00Z'),
						to: new Date('2026-10-12T00:00:00Z'),
					},
					tx,
				)
				expect(repository.createMissing.mock.calls[0]?.[0].values).toEqual([5])
			})

			it('starts the chain at the first weight when there is no earlier chat weight', async () => {
				measurements.findFirst.mockResolvedValue(weigh(90, { localDate: '2026-10-03' }))
				measurements.findLatest.mockResolvedValue(weigh(88.9))
				measurements.findBefore.mockResolvedValue(null)
				measurements.findInRange.mockResolvedValue([
					weigh(90, { localDate: '2026-10-03' }),
					weigh(88.9),
				])

				await recordWeight()

				expect(measurements.findInRange.mock.calls[0]?.[0].from).toEqual(
					new Date('2026-10-03T00:00:00Z'),
				)
				expect(repository.createMissing.mock.calls[0]?.[0].values).toEqual([1])
			})

			it('passes the userId into every weight query', async () => {
				measurements.findFirst.mockResolvedValue(weigh(84))
				measurements.findLatest.mockResolvedValue(weigh(83))
				measurements.findBefore.mockResolvedValue(weigh(84, { localDate: '2026-10-05' }))
				measurements.findInRange.mockResolvedValue(toChain(84, 83))

				await recordWeight()

				for (const query of [
					measurements.findFirst,
					measurements.findLatest,
					measurements.findBefore,
					measurements.findInRange,
				]) {
					expect(query).toHaveBeenCalledOnce()
					expect(query.mock.calls[0]?.[0]).toMatchObject({ userId: USER_ID, kind: 'WEIGHT' })
					expect(query.mock.calls[0]?.[1]).toBe(tx)
				}
			})
		})
	})

	it('reaches the last milestone at exactly 100 days and reads no more than 100 days', async () => {
		const dates = Array.from({ length: 100 }, (_, index) =>
			new Date(Date.UTC(2026, 9, 12 - index)).toISOString().slice(0, 10),
		)
		entries.getDaysKcal.mockResolvedValue(toDays(dates))

		await recordFood(new Date('2026-10-12T12:00:00Z'))

		expect(entries.getDaysKcal.mock.calls[0]?.[1]).toEqual({
			from: new Date('2026-07-05T00:00:00Z'),
			to: new Date('2026-10-12T00:00:00Z'),
		})
		expect(repository.createMissing.mock.calls[0]?.[0].values).toEqual([3, 7, 14, 30, 60, 100])
		expect(repository.attachToMessage).toHaveBeenCalledWith(
			{ userId: USER_ID, id: 'row-100', messageId: REPLY_ID },
			tx,
		)
	})

	it('stops at 99 days: the 100 milestone is not reached', async () => {
		const dates = Array.from({ length: 99 }, (_, index) =>
			new Date(Date.UTC(2026, 9, 12 - index)).toISOString().slice(0, 10),
		)
		entries.getDaysKcal.mockResolvedValue(toDays(dates))

		await recordFood(new Date('2026-10-12T12:00:00Z'))

		expect(repository.createMissing.mock.calls[0]?.[0].values).toEqual([3, 7, 14, 30, 60])
	})

	it('writes no kg achievement without a first or a latest weight', async () => {
		measurements.findFirst.mockResolvedValue(null)
		measurements.findLatest.mockResolvedValue(null)

		await service.recordForTurn(
			{
				userId: USER_ID,
				timezone: TIMEZONE,
				now: new Date('2026-10-12T12:00:00Z'),
				replyMessageId: REPLY_ID,
				userMessageId: USER_MESSAGE_ID,
				isFoodChanged: false,
				isWeightLogged: true,
			},
			tx,
		)

		expect(repository.createMissing).not.toHaveBeenCalled()
	})

	it('writes no kg achievement when the weight went up from the start', async () => {
		const weigh = (value: number) => ({
			id: 'm',
			kind: 'WEIGHT' as const,
			value,
			localDate: new Date('2026-10-12T00:00:00Z'),
			measuredAt: new Date(),
			source: 'CHAT' as const,
			messageId: USER_MESSAGE_ID,
			createdAt: new Date(),
			deletedAt: null,
		})
		measurements.findFirst.mockResolvedValue(weigh(80))
		measurements.findLatest.mockResolvedValue(weigh(85))
		measurements.findInRange.mockResolvedValue([weigh(80), weigh(85)])

		await service.recordForTurn(
			{
				userId: USER_ID,
				timezone: TIMEZONE,
				now: new Date('2026-10-12T12:00:00Z'),
				replyMessageId: REPLY_ID,
				userMessageId: USER_MESSAGE_ID,
				isFoodChanged: false,
				isWeightLogged: true,
			},
			tx,
		)

		expect(repository.createMissing).not.toHaveBeenCalled()
	})

	it('checks nothing when the turn neither changed food nor logged a weight', async () => {
		await service.recordForTurn(
			{
				userId: USER_ID,
				timezone: TIMEZONE,
				now: new Date(),
				replyMessageId: REPLY_ID,
				userMessageId: USER_MESSAGE_ID,
				isFoodChanged: false,
				isWeightLogged: false,
			},
			tx,
		)

		expect(entries.getDaysKcal).not.toHaveBeenCalled()
		expect(measurements.findFirst).not.toHaveBeenCalled()
	})
})
