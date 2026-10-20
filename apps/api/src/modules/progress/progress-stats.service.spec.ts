import { describe, expect, it, vi } from 'vitest'

import { ProgressStatsService } from './progress-stats.service'

const TODAY = '2026-10-19'

type Days = Record<string, { kcal: number; proteinG: number; entryCount: number }>

const createService = ({
	days = {},
	goalKcal = 2000,
	weights = [],
}: { days?: Days; goalKcal?: number | null; weights?: { value: number }[] } = {}) => {
	const getDaysTotals = vi.fn().mockResolvedValue(new Map(Object.entries(days)))
	const getGoalKcalByDay = vi
		.fn()
		.mockImplementation((_: string, dates: string[]) =>
			Promise.resolve(new Map(dates.map((date) => [date, goalKcal]))),
		)
	const findInRange = vi.fn().mockResolvedValue(weights)
	const service = new ProgressStatsService(
		{ getDaysTotals } as never,
		{ getGoalKcalByDay } as never,
		{ findInRange } as never,
	)
	const build = (period: 'week' | 'month', endDate: string | null = null) =>
		service.build({ userId: 'u1', period, endDate, today: TODAY })
	return { build, getDaysTotals, getGoalKcalByDay, findInRange }
}

const day = (kcal: number, proteinG = 100) => ({ kcal, proteinG, entryCount: 3 })

describe('ProgressStatsService.build', () => {
	it('covers the 7 days up to today by default', async () => {
		const { build, getDaysTotals, getGoalKcalByDay, findInRange } = createService({
			days: { '2026-10-18': day(1900) },
		})

		const card = await build('week')

		expect(card).toMatchObject({ period: 'week', from: '2026-10-13', to: TODAY })
		expect(getDaysTotals).toHaveBeenCalledWith('u1', {
			from: new Date('2026-10-13T00:00:00Z'),
			to: new Date('2026-10-19T00:00:00Z'),
		})
		expect(getGoalKcalByDay.mock.calls[0]?.[0]).toBe('u1')
		expect(findInRange).toHaveBeenCalledWith(
			expect.objectContaining({ userId: 'u1', kind: 'WEIGHT' }),
		)
	})

	it('covers 30 days for a month', async () => {
		const { build } = createService({ days: { '2026-10-18': day(1900) } })

		expect(await build('month')).toMatchObject({ from: '2026-09-20', to: TODAY })
	})

	it('ends on the named day, but never after today', async () => {
		const { build } = createService({ days: { '2026-10-10': day(1900), '2026-10-18': day(1900) } })

		expect(await build('week', '2026-10-10')).toMatchObject({
			from: '2026-10-04',
			to: '2026-10-10',
		})
		expect(await build('week', TODAY)).toMatchObject({ to: TODAY })
		expect(await build('week', '2026-10-25')).toMatchObject({ to: TODAY })
	})

	it('counts today like «Прогрес» does: once something is logged', async () => {
		const { build } = createService({ days: { [TODAY]: day(1900), '2026-10-17': day(1000) } })

		expect(await build('week', TODAY)).toMatchObject({ loggedDays: 2, avgKcal: 1450 })
		expect(
			await createService({ days: { '2026-10-17': day(1000) } }).build('week', TODAY),
		).toMatchObject({
			loggedDays: 1,
		})
	})

	it('averages kcal and protein over the logged days only', async () => {
		const { build } = createService({
			days: {
				'2026-10-13': day(1800, 90),
				'2026-10-15': day(2100, 120),
				'2026-10-17': day(1500, 60),
			},
		})

		expect(await build('week')).toMatchObject({
			loggedDays: 3,
			avgKcal: 1800,
			avgProteinG: 90,
			goalKcal: 2000,
		})
	})

	it('counts days in the norm like «Прогрес»: logged and not above 103 % of the goal', async () => {
		const { build } = createService({
			days: {
				'2026-10-13': day(2060), // 103 % — in the norm
				'2026-10-14': day(2061), // over
				'2026-10-15': day(1000), // far below, still not over
				'2026-10-16': day(1700),
			},
		})

		expect(await build('week')).toMatchObject({ loggedDays: 4, daysInNorm: 3 })
	})

	it('counts a day without a goal as in the norm, like «Прогрес»', async () => {
		const { build } = createService({ days: { '2026-10-17': day(1800) }, goalKcal: null })

		expect(await build('week')).toMatchObject({ daysInNorm: 1, goalKcal: null, avgKcal: 1800 })
	})

	it('is null when nothing was logged in the period', async () => {
		const { build } = createService({ days: {} })

		expect(await build('week')).toBeNull()
	})

	it('reports the weight change from the first to the last weigh-in, null with one', async () => {
		const days = { '2026-10-17': day(1800) }

		expect(
			await createService({ days, weights: [{ value: 82.4 }, { value: 82.1 }, { value: 81.8 }] })
				.build('week')
				.then((card) => card?.weightChangeKg),
		).toBe(-0.6)
		expect(
			await createService({ days, weights: [{ value: 82.4 }] })
				.build('week')
				.then((card) => card?.weightChangeKg),
		).toBeNull()
		expect(
			await createService({ days })
				.build('week')
				.then((card) => card?.weightChangeKg),
		).toBeNull()
	})
})
