import { describe, expect, it, vi } from 'vitest'

import { ChatDayCardService } from './chat-day-card.service'

const NOW = new Date('2026-10-18T12:20:00Z')
const TODAY = '2026-10-18'

const toMeal = (type: string, kcal: number, isUndetailed = false) => ({
	id: `meal-${type}`,
	type,
	localDate: TODAY,
	eatenAt: '2026-10-17T11:00:00.000Z',
	totals: { kcal, protein: 0, fat: 0, carbs: 0, fiber: 0 },
	mealTotalKcal: null,
	entries: [{ id: `entry-${type}`, isUndetailed }],
})

const GOAL = { kcal: 2000, protein: 120, fat: 70, carbs: 220 }

const createService = ({
	meals = [toMeal('BREAKFAST', 400), toMeal('DINNER', 700)],
	goal = GOAL,
}: { meals?: ReturnType<typeof toMeal>[]; goal?: typeof GOAL | null } = {}) => {
	const getDayMeals = vi.fn().mockResolvedValue({
		meals,
		totals: { kcal: 1100, protein: 60, fat: 40, carbs: 130, fiber: 9 },
	})
	const getGoalForDate = vi.fn().mockResolvedValue(goal)
	const service = new ChatDayCardService({ getDayMeals } as never, { getGoalForDate } as never)
	const build = (localDate: string, extra: Partial<Parameters<typeof service.build>[0]> = {}) =>
		service.build({ userId: 'u1', localDate, today: TODAY, now: NOW, ...extra })
	return { build, getDayMeals, getGoalForDate }
}

describe('ChatDayCardService.build', () => {
	it('snapshots a past day: totals and meals from the backend, no asOf', async () => {
		const { build, getDayMeals, getGoalForDate } = createService()

		const card = await build('2026-10-17')

		expect(card).toEqual({
			version: 1,
			localDate: '2026-10-17',
			kind: 'past',
			asOf: null,
			totals: { kcal: 1100, protein: 60, fat: 40, carbs: 130 },
			goal: GOAL,
			remainingKcal: 900,
			verdict: 'far_under',
			meals: [
				{ type: 'BREAKFAST', eatenAt: '2026-10-17T11:00:00.000Z', kcal: 400, hasUndetailed: false },
				{ type: 'DINNER', eatenAt: '2026-10-17T11:00:00.000Z', kcal: 700, hasUndetailed: false },
			],
		})
		expect(getDayMeals).toHaveBeenCalledWith('u1', new Date('2026-10-17T00:00:00Z'))
		expect(getGoalForDate).toHaveBeenCalledWith('u1', new Date('2026-10-17T00:00:00Z'))
	})

	it('flags the meal that holds the «Без деталей» estimate', async () => {
		const { build } = createService({
			meals: [toMeal('BREAKFAST', 400), toMeal('SNACK', 300, true)],
		})

		const card = await build('2026-10-17')

		expect(card?.meals.map(({ hasUndetailed }) => hasUndetailed)).toEqual([false, true])
	})

	it('marks today with the moment of the snapshot', async () => {
		const { build } = createService()

		const card = await build(TODAY)

		expect(card).toMatchObject({ kind: 'today', asOf: NOW.toISOString() })
	})

	it('marks tomorrow as planned', async () => {
		const { build } = createService()

		const card = await build('2026-10-19')

		expect(card).toMatchObject({ kind: 'planned', asOf: null })
	})

	it('goes negative over the goal', async () => {
		const { build } = createService({ goal: { ...GOAL, kcal: 1000 } })

		expect(await build('2026-10-17')).toMatchObject({ remainingKcal: -100 })
	})

	it('has no goal and no remainder without a goal', async () => {
		const { build } = createService({ goal: null })

		expect(await build('2026-10-17')).toMatchObject({ goal: null, remainingKcal: null })
	})

	it('judges the day against the goal with the shared thresholds', async () => {
		const goal = (kcal: number) => createService({ goal: { ...GOAL, kcal } })

		// 1100 kcal eaten
		expect(await goal(1100).build('2026-10-17')).toMatchObject({ verdict: 'on_goal' })
		expect(await goal(1400).build('2026-10-17')).toMatchObject({ verdict: 'under' })
		expect(await goal(1000).build('2026-10-17')).toMatchObject({ verdict: 'over' })
		expect(await createService({ goal: null }).build('2026-10-17')).toMatchObject({
			verdict: 'no_goal',
		})
	})

	it('gives a planned day no verdict', async () => {
		const { build } = createService()

		expect(await build('2026-10-19')).not.toHaveProperty('verdict')
	})

	it('marks a closing card only when asked', async () => {
		const { build } = createService()

		expect(await build('2026-10-17')).not.toHaveProperty('isClosing')
		expect(await build('2026-10-17', { isClosing: true })).toMatchObject({ isClosing: true })
	})

	it('reads the day inside the given transaction', async () => {
		const { build, getDayMeals } = createService()
		const tx = {} as never

		await build('2026-10-17', { tx })

		expect(getDayMeals).toHaveBeenCalledWith('u1', new Date('2026-10-17T00:00:00Z'), tx)
	})

	it('returns null for a day without entries', async () => {
		const { build } = createService({ meals: [] })

		expect(await build('2026-10-17')).toBeNull()
	})
})
