// @vitest-environment jsdom
import { type StatsCard as StatsCardData, statsCardSchema } from '@kus/shared'
import { cleanup, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import { renderWithProviders } from '@/shared/testing'

import { StatsCard } from './StatsCard'

const TODAY = '2026-10-19'

const createCard = (overrides: Partial<StatsCardData> = {}): StatsCardData => ({
	version: 1,
	period: 'month',
	from: '2026-09-20',
	to: TODAY,
	loggedDays: 26,
	daysInNorm: 19,
	avgKcal: 2160,
	avgProteinG: 121,
	goalKcal: 2200,
	weightChangeKg: -1.6,
	proteinGoalG: 140,
	weightStartKg: 84,
	weightEndKg: 82.4,
	days: [],
	...overrides,
})

const renderCard = (card: StatsCardData) =>
	renderWithProviders(<StatsCard card={card} today={TODAY} />)

afterEach(cleanup)

describe('StatsCard', () => {
	it('30 days: title, dates and the four tiles', () => {
		renderCard(createCard())

		expect(screen.getByText('За 30 днів')).toBeTruthy()
		expect(screen.getByText('20 вересня – 19 жовтня')).toBeTruthy()
		expect(screen.getByText('Калорії, середнє')).toBeTruthy()
		expect(screen.getByText(/^2\s160$/)).toBeTruthy()
		expect(screen.getByText(/^ціль 2\s200$/)).toBeTruthy()
		expect(screen.getByText('Білок, середнє')).toBeTruthy()
		expect(screen.getByText(/^121\sг$/)).toBeTruthy()
		expect(screen.getByText('Днів у нормі')).toBeTruthy()
		expect(screen.getByText('19 з 26')).toBeTruthy()
		expect(screen.getByText('серед днів із записами')).toBeTruthy()
		expect(screen.getByText('Вага')).toBeTruthy()
		expect(screen.getByText('−1,6 кг')).toBeTruthy()
	})

	it('30 days: the protein goal under the protein and the weight from → to', () => {
		renderCard(createCard())

		expect(screen.getByText(/^ціль 140\sг$/)).toBeTruthy()
		expect(screen.getByText('84,0 → 82,4')).toBeTruthy()
	})

	it('without a protein goal or two weigh-ins those lines are gone', () => {
		renderCard(createCard({ proteinGoalG: null, weightStartKg: null, weightEndKg: null }))

		expect(screen.queryByText(/^ціль 140/)).toBeNull()
		expect(screen.queryByText(/→/)).toBeNull()
		expect(screen.getByText('−1,6 кг')).toBeTruthy()
	})

	it('a finished week: the date range as the title', () => {
		renderCard(
			createCard({
				period: 'week',
				from: '2026-10-05',
				to: '2026-10-11',
				loggedDays: 7,
				daysInNorm: 5,
			}),
		)

		expect(screen.getByText('Тиждень 5–11 жовтня')).toBeTruthy()
		expect(screen.getByText('понеділок – неділя')).toBeTruthy()
		expect(screen.getByText('5 з 7')).toBeTruthy()
		// the caption is the 30-day card's: the week is short enough without it
		expect(screen.queryByText('серед днів із записами')).toBeNull()
	})

	it('without weigh-ins there is no weight tile; without a goal no goal caption', () => {
		renderCard(createCard({ weightChangeKg: null, goalKcal: null, proteinGoalG: null }))

		expect(screen.queryByText('Вага')).toBeNull()
		expect(screen.queryByText(/^ціль/)).toBeNull()
		expect(screen.getByText('Калорії, середнє')).toBeTruthy()
	})

	it('too little data: the count and the days, no averages', () => {
		renderCard(
			createCard({
				loggedDays: 2,
				daysInNorm: 1,
				days: [
					{ date: '2026-10-18', kcal: 2380, verdict: 'over' },
					{ date: '2026-10-19', kcal: 1370, verdict: 'under' },
				],
			}),
		)

		expect(screen.getByText('Днів із записами')).toBeTruthy()
		expect(screen.getByText('2 з 30')).toBeTruthy()
		expect(screen.getByText('Нд, 18.10')).toBeTruthy()
		expect(screen.getByText(/^2\s380 ккал$/)).toBeTruthy()
		expect(screen.getByText('Пн, 19.10')).toBeTruthy()
		expect(screen.getByText(/^1\s370 ккал$/)).toBeTruthy()
		expect(screen.queryByText('Калорії, середнє')).toBeNull()
		expect(screen.queryByText('Білок, середнє')).toBeNull()
		expect(screen.queryByText('Днів у нормі')).toBeNull()
		expect(screen.queryByText('Вага')).toBeNull()
	})

	it('a snapshot of an older server (no new fields) parses and draws without them', () => {
		const {
			proteinGoalG: _p,
			weightStartKg: _s,
			weightEndKg: _e,
			days: _d,
			...older
		} = createCard()
		renderCard(statsCardSchema.parse(older))

		expect(screen.getByText('Білок, середнє')).toBeTruthy()
		expect(screen.queryByText(/^ціль 140/)).toBeNull()
		expect(screen.queryByText(/→/)).toBeNull()
		cleanup()

		const { container } = renderCard(
			statsCardSchema.parse({ ...older, loggedDays: 2, daysInNorm: 1 }),
		)

		expect(screen.getByText('2 з 30')).toBeTruthy()
		expect(container.querySelector('ul')).toBeNull()
	})

	it('15 days: one-line title, the bars per day with the dates at the ends', () => {
		const { container } = renderCard(
			createCard({
				period: 'week',
				periodDays: 15,
				from: '2026-10-05',
				loggedDays: 12,
				daysInNorm: 9,
			}),
		)

		expect(screen.getByText('15 днів · 05.10–19.10')).toBeTruthy()
		expect(screen.getByRole('img', { name: 'Калорії по днях' }).children).toHaveLength(15 + 1)
		expect(screen.getByText('05.10')).toBeTruthy()
		expect(screen.getByText('19.10')).toBeTruthy()
		expect(screen.queryByText('стовпчик — середнє за тиждень')).toBeNull()
		expect(container.querySelector('p')?.textContent).toBe('15 днів · 05.10–19.10')
	})

	it('7 days: weekday labels under the bars', () => {
		renderCard(createCard({ period: 'week', from: '2026-10-13', loggedDays: 5 }))

		expect(screen.getByText('Вт')).toBeTruthy()
		expect(screen.getByText('Пн')).toBeTruthy()
	})

	it('60 days: weekly bars and their caption', () => {
		renderCard(createCard({ period: 'month', periodDays: 60, from: '2026-08-21', loggedDays: 41 }))

		expect(screen.getByRole('img', { name: 'Середні калорії по тижнях' })).toBeTruthy()
		expect(screen.getByText('стовпчик — середнє за тиждень')).toBeTruthy()
	})

	it('no bars for too little data', () => {
		renderCard(createCard({ loggedDays: 2 }))

		expect(screen.queryByRole('img')).toBeNull()
	})
})
