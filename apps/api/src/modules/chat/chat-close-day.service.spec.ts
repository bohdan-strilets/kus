import { Logger } from '@nestjs/common'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { ChatCloseDayService } from './chat-close-day.service'
import { TurnDateOutOfRangeException } from './chat.exceptions'

beforeEach(() => {
	vi.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined)
})

const TIMEZONE = 'Europe/Warsaw'
// 22:20 on Sunday 2026-10-18 in Warsaw (UTC+2)
const NOW = new Date('2026-10-18T20:20:00Z')
// 13:00 the same day: the clock would say lunch
const NOON = new Date('2026-10-18T11:00:00Z')
const TODAY = new Date('2026-10-18T00:00:00Z')
const CARD = { version: 1, localDate: '2026-10-18', isClosing: true }

const createService = (eatenKcal = 1500) => {
	const getDayMeals = vi.fn().mockResolvedValue({ meals: [], totals: { kcal: eatenKcal } })
	const logEntries = vi.fn().mockResolvedValue({ meals: [], entryIds: ['n1'] })
	const build = vi.fn().mockResolvedValue(CARD)
	const service = new ChatCloseDayService({ getDayMeals, logEntries } as never, { build } as never)
	const tx = {} as never
	const close = (date: string | null, estimatedTotalKcal: number | null, now: Date = NOW) =>
		service.close(
			{
				userId: 'u1',
				messageId: 'm1',
				date,
				estimatedTotalKcal,
				localDate: TODAY,
				timezone: TIMEZONE,
				now,
			},
			tx,
		)
	return { close, getDayMeals, logEntries, build, tx }
}

const getLogged = (logEntries: ReturnType<typeof vi.fn>) => {
	const params: unknown = logEntries.mock.calls[0]?.[0]
	return params as {
		sourceMessageId: string
		entries: { mealType: string; localDate: Date; entry: Record<string, number | string | null> }[]
	}
}

describe('ChatCloseDayService.close', () => {
	it('builds the closing card of today inside the transaction when there is no estimate', async () => {
		const { close, build, getDayMeals, logEntries, tx } = createService()

		const result = await close(null, null)

		expect(result).toEqual({ dayCard: CARD, isLogged: false })
		expect(getDayMeals).not.toHaveBeenCalled()
		expect(logEntries).not.toHaveBeenCalled()
		expect(build).toHaveBeenCalledWith({
			userId: 'u1',
			localDate: '2026-10-18',
			today: '2026-10-18',
			now: NOW,
			isClosing: true,
			tx,
		})
	})

	it('logs one "Без деталей" estimate for exactly the gap up to the user total', async () => {
		const { close, logEntries, tx } = createService(1500)

		const result = await close('2026-10-17', 1800)

		expect(result.isLogged).toBe(true)
		const { sourceMessageId, entries } = getLogged(logEntries)
		expect(sourceMessageId).toBe('m1')
		expect(entries).toHaveLength(1)
		expect(entries[0]?.localDate).toEqual(new Date('2026-10-17T00:00:00Z'))
		expect(entries[0]?.entry).toMatchObject({
			name: 'Без деталей',
			kcal: 300,
			source: 'ESTIMATE',
			confidence: 0.3,
			category: 'plate',
			myFoodId: null,
			fromPhoto: false,
			quantity: null,
			fiber: null,
			assumption: null,
		})
		expect(logEntries.mock.calls[0]?.[1]).toBe(tx)
	})

	it('puts the gap into a snack at any hour, with macros in the fixed proportion', async () => {
		const { close, logEntries } = createService(0)

		await close(null, 1000, NOON)

		const logged = getLogged(logEntries).entries[0]
		const [protein, carbs, fat] = [
			logged?.entry.protein,
			logged?.entry.carbs,
			logged?.entry.fat,
		].map(Number)
		expect(logged?.mealType).toBe('SNACK')
		expect([(protein ?? 0) * 4, (carbs ?? 0) * 4, (fat ?? 0) * 9].map(Math.round)).toEqual([
			200, 500, 300,
		])
	})

	it.each([
		['equal to what is logged', 1500],
		['below what is logged', 1200],
	])('logs nothing and subtracts nothing when the estimate is %s', async (_, estimate) => {
		const { close, logEntries } = createService(1500)

		const result = await close(null, estimate)

		expect(result).toEqual({ dayCard: CARD, isLogged: false })
		expect(logEntries).not.toHaveBeenCalled()
	})

	it('treats a gap that rounds to zero as no gap', async () => {
		const { close, logEntries } = createService(1799.6)

		expect((await close(null, 1800)).isLogged).toBe(false)
		expect(logEntries).not.toHaveBeenCalled()
	})

	it('hands back no card for an empty day', async () => {
		const { close, build } = createService()
		build.mockResolvedValue(null)

		expect(await close(null, null)).toEqual({ dayCard: null, isLogged: false })
	})

	it.each(['2026-10-19', '2026-10-14'])(
		'stops the turn for %s, outside today − 3 … today',
		async (date) => {
			const { close, getDayMeals, logEntries, build } = createService()

			await expect(close(date, 1800)).rejects.toBeInstanceOf(TurnDateOutOfRangeException)
			expect(getDayMeals).not.toHaveBeenCalled()
			expect(logEntries).not.toHaveBeenCalled()
			expect(build).not.toHaveBeenCalled()
		},
	)

	it('accepts the oldest loggable day', async () => {
		const { close } = createService()

		await expect(close('2026-10-15', null)).resolves.toMatchObject({ isLogged: false })
	})
})
