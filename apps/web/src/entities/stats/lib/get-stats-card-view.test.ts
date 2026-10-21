import type { StatsCard } from '@kus/shared'
import { describe, expect, it } from 'vitest'

import { i18n } from '@/shared/i18n'

import { getStatsCardView } from './get-stats-card-view'

const t = i18n.t.bind(i18n)

// Monday
const TODAY = '2026-10-19'

const card = (overrides: Partial<StatsCard>): StatsCard => ({
	version: 1,
	period: 'week',
	from: '2026-10-13',
	to: TODAY,
	loggedDays: 5,
	daysInNorm: 3,
	avgKcal: 2000,
	avgProteinG: 100,
	goalKcal: 2200,
	weightChangeKg: null,
	proteinGoalG: null,
	weightStartKg: null,
	weightEndKg: null,
	days: [],
	...overrides,
})

describe('getStatsCardView', () => {
	it('30 days: the title and the dates across two months', () => {
		const view = getStatsCardView(card({ period: 'month', from: '2026-09-20' }), TODAY, t)

		expect(view.title).toBe('За 30 днів')
		expect(view.subtitle).toBe('20 вересня – 19 жовтня')
		expect(view.totalDays).toBe(30)
	})

	it('a week that ends today is «За 7 днів» with its dates', () => {
		const view = getStatsCardView(card({}), TODAY, t)

		expect(view.title).toBe('За 7 днів')
		expect(view.subtitle).toBe('13–19 жовтня')
	})

	it('a finished Monday–Sunday week is named by its dates', () => {
		const view = getStatsCardView(card({ from: '2026-10-05', to: '2026-10-11' }), TODAY, t)

		expect(view.title).toBe('Тиждень 5–11 жовтня')
		expect(view.subtitle).toBe('понеділок – неділя')
		expect(view.totalDays).toBe(7)
	})

	it('a finished week across two months names both', () => {
		const view = getStatsCardView(card({ from: '2026-09-28', to: '2026-10-04' }), TODAY, t)

		expect(view.title).toBe('Тиждень 28 вересня – 4 жовтня')
	})

	it('a finished window that is not a calendar week keeps «За 7 днів»', () => {
		const view = getStatsCardView(card({ from: '2026-10-06', to: '2026-10-12' }), TODAY, t)

		expect(view.title).toBe('За 7 днів')
		expect(view.subtitle).toBe('6–12 жовтня')
	})

	it('tells the protein goal and the weight range, and hides them without data', () => {
		const full = getStatsCardView(
			card({ proteinGoalG: 140, weightStartKg: 84, weightEndKg: 82.4 }),
			TODAY,
			t,
		)
		expect(full.proteinGoal).toBe('140 г')
		expect(full.weightRange).toBe('84,0 → 82,4')

		const bare = getStatsCardView(card({ weightStartKg: 84 }), TODAY, t)
		expect(bare.proteinGoal).toBeNull()
		expect(bare.weightRange).toBeNull()
	})

	it('names the days with entries by weekday and date', () => {
		const view = getStatsCardView(
			card({
				loggedDays: 2,
				days: [
					{ date: '2026-10-18', kcal: 2380, verdict: 'over' },
					{ date: '2026-10-19', kcal: 1370, verdict: 'under' },
				],
			}),
			TODAY,
			t,
		)

		expect(view.dayRows.map(({ label, kcal }) => [label, kcal.replace(/\s/g, ' ')])).toEqual([
			['Нд, 18.10', '2 380 ккал'],
			['Пн, 19.10', '1 370 ккал'],
		])
	})

	it('the days caption belongs to the 30-day card only', () => {
		expect(getStatsCardView(card({ period: 'month' }), TODAY, t).hasLoggedDaysCaption).toBe(true)
		expect(getStatsCardView(card({}), TODAY, t).hasLoggedDaysCaption).toBe(false)
	})

	it('is sparse below three days with entries', () => {
		expect(getStatsCardView(card({ loggedDays: 2 }), TODAY, t).isSparse).toBe(true)
		expect(getStatsCardView(card({ loggedDays: 3 }), TODAY, t).isSparse).toBe(false)
		expect(getStatsCardView(card({ loggedDays: 0 }), TODAY, t).isSparse).toBe(true)
	})
})
