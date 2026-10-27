import { describe, expect, it, vi } from 'vitest'

import { ProgressStatsService } from './progress-stats.service'

const TODAY = '2026-10-19'

type Days = Record<string, { kcal: number; proteinG: number; entryCount: number }>

const createService = ({
	days = {},
	goalKcal = 2000,
	proteinGoal = 120,
	weights = [],
}: {
	days?: Days
	goalKcal?: number | null
	proteinGoal?: number | null
	weights?: { value: number }[]
} = {}) => {
	const getDaysTotals = vi.fn().mockResolvedValue(new Map(Object.entries(days)))
	const getGoalKcalByDay = vi
		.fn()
		.mockImplementation((_: string, dates: string[]) =>
			Promise.resolve(new Map(dates.map((date) => [date, goalKcal]))),
		)
	const getGoalForDate = vi
		.fn()
		.mockResolvedValue(proteinGoal === null ? null : { kcal: goalKcal, protein: proteinGoal })
	const findInRange = vi.fn().mockResolvedValue(weights)
	const service = new ProgressStatsService(
		{ getDaysTotals } as never,
		{ getGoalKcalByDay, getGoalForDate } as never,
		{ findInRange } as never,
	)
	const build = (days: number, endDate: string | null = null) =>
		service.build({ userId: 'u1', days, endDate, today: TODAY })
	return { build, getDaysTotals, getGoalKcalByDay, getGoalForDate, findInRange }
}

const day = (kcal: number, proteinG = 100) => ({ kcal, proteinG, entryCount: 3 })

describe('ProgressStatsService.build', () => {
	it('covers the 7 days up to today by default', async () => {
		const { build, getDaysTotals, getGoalKcalByDay, findInRange } = createService({
			days: { '2026-10-18': day(1900) },
		})

		const card = await build(7)

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

		expect(await build(30)).toMatchObject({
			period: 'month',
			periodDays: 30,
			from: '2026-09-20',
			to: TODAY,
		})
	})

	it('covers any length; period stays week|month (the nearer) for older clients', async () => {
		const { build } = createService({ days: { '2026-10-18': day(1900) } })

		expect(await build(15)).toMatchObject({
			period: 'week',
			periodDays: 15,
			from: '2026-10-05',
			to: TODAY,
		})
		expect(await build(92)).toMatchObject({ period: 'month', periodDays: 92, from: '2026-07-20' })
	})

	it('ends on the named day, but never after today', async () => {
		const { build } = createService({ days: { '2026-10-10': day(1900), '2026-10-18': day(1900) } })

		expect(await build(7, '2026-10-10')).toMatchObject({
			from: '2026-10-04',
			to: '2026-10-10',
		})
		expect(await build(7, TODAY)).toMatchObject({ to: TODAY })
		expect(await build(7, '2026-10-25')).toMatchObject({ to: TODAY })
	})

	it('counts today like «Прогрес» does: once something is logged', async () => {
		const { build } = createService({ days: { [TODAY]: day(1900), '2026-10-17': day(1000) } })

		expect(await build(7, TODAY)).toMatchObject({ loggedDays: 2, avgKcal: 1450 })
		expect(
			await createService({ days: { '2026-10-17': day(1000) } }).build(7, TODAY),
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

		expect(await build(7)).toMatchObject({
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

		expect(await build(7)).toMatchObject({ loggedDays: 4, daysInNorm: 3 })
	})

	it('counts a day without a goal as in the norm, like «Прогрес»', async () => {
		const { build } = createService({ days: { '2026-10-17': day(1800) }, goalKcal: null })

		expect(await build(7)).toMatchObject({ daysInNorm: 1, goalKcal: null, avgKcal: 1800 })
	})

	it('is null when nothing was logged in the period', async () => {
		const { build } = createService({ days: {} })

		expect(await build(7)).toBeNull()
	})

	it('reports the protein goal in force on the last day, null without a goal', async () => {
		const days = { '2026-10-17': day(1800) }

		const { build, getGoalForDate } = createService({ days })
		expect(await build(7)).toMatchObject({ proteinGoalG: 120 })
		expect(getGoalForDate).toHaveBeenCalledWith('u1', new Date(`${TODAY}T00:00:00Z`))
		expect(await createService({ days, proteinGoal: null }).build(7)).toMatchObject({
			proteinGoalG: null,
		})
	})

	it('gives the first and last weight with two or more weigh-ins, null with fewer', async () => {
		const days = { '2026-10-17': day(1800) }

		expect(
			await createService({
				days,
				weights: [{ value: 82.4 }, { value: 82.1 }, { value: 81.8 }],
			}).build(7),
		).toMatchObject({ weightStartKg: 82.4, weightEndKg: 81.8, weightChangeKg: -0.6 })
		expect(await createService({ days, weights: [{ value: 82.4 }] }).build(7)).toMatchObject({
			weightStartKg: null,
			weightEndKg: null,
			weightChangeKg: null,
		})
		expect(await createService({ days }).build(7)).toMatchObject({
			weightStartKg: null,
			weightEndKg: null,
		})
	})

	it('lists the logged days oldest first with their verdict against the goal in force', async () => {
		const { build } = createService({
			days: { '2026-10-15': day(2000), '2026-10-13': day(2300), '2026-10-17': day(900) },
		})

		expect((await build(7))?.days).toEqual([
			{ date: '2026-10-13', kcal: 2300, verdict: 'over' },
			{ date: '2026-10-15', kcal: 2000, verdict: 'on_goal' },
			{ date: '2026-10-17', kcal: 900, verdict: 'far_under' },
		])
		expect(
			(await createService({ days: { '2026-10-17': day(900) }, goalKcal: null }).build(7))?.days,
		).toEqual([{ date: '2026-10-17', kcal: 900, verdict: 'no_goal' }])
	})

	it('reports the weight change from the first to the last weigh-in, null with one', async () => {
		const days = { '2026-10-17': day(1800) }

		expect(
			await createService({ days, weights: [{ value: 82.4 }, { value: 82.1 }, { value: 81.8 }] })
				.build(7)
				.then((card) => card?.weightChangeKg),
		).toBe(-0.6)
		expect(
			await createService({ days, weights: [{ value: 82.4 }] })
				.build(7)
				.then((card) => card?.weightChangeKg),
		).toBeNull()
		expect(
			await createService({ days })
				.build(7)
				.then((card) => card?.weightChangeKg),
		).toBeNull()
	})
})
