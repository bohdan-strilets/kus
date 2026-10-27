import { describe, expect, it } from 'vitest'

import { getCallFacts } from './call-facts.js'

const TODAY = '2026-10-07'
const call = (name: string, input: unknown) => ({
	id: name,
	name,
	arguments: JSON.stringify(input),
})

describe('getCallFacts', () => {
	it('takes the first log_food date, and today when it is null', () => {
		const dated = getCallFacts([call('log_food', { date: '2026-10-08', items: [] })], TODAY)
		expect(dated.logDate).toBe('2026-10-08')
		expect(getCallFacts([call('log_food', { date: null, items: [] })], TODAY).logDate).toBe(TODAY)
		expect(getCallFacts([call('log_food', { items: [] })], TODAY).logDate).toBe(TODAY)
	})

	it('has no log day when nothing was logged', () => {
		expect(getCallFacts([call('reply', { text: 'x' })], TODAY).logDate).toBeNull()
	})

	it('gives items their own day, else the call day, else today', () => {
		const facts = getCallFacts(
			[
				call('log_food', {
					date: '2026-10-06',
					items: [
						{ name: 'Піца', date: null },
						{ name: 'Омлет', date: '2026-10-07' },
					],
				}),
			],
			TODAY,
		)
		expect(facts.itemDates).toEqual([
			{ name: 'Піца', date: '2026-10-06' },
			{ name: 'Омлет', date: '2026-10-07' },
		])
	})

	it('reads show_day and delete_measurement by name', () => {
		const facts = getCallFacts(
			[
				call('show_day', { date: null }),
				call('show_day', { date: '2026-10-06' }),
				call('delete_measurement', { kind: 'WEIGHT', date: '2026-10-06' }),
			],
			TODAY,
		)
		expect(facts.dayCards).toEqual([{ date: TODAY }, { date: '2026-10-06' }])
		expect(facts.deletedMeasurements).toEqual([{ kind: 'WEIGHT', date: '2026-10-06' }])
	})

	it('reads close_day (null day = today, null total) and show_stats', () => {
		const facts = getCallFacts(
			[
				call('close_day', { date: null, estimatedTotalKcal: null }),
				call('close_day', { date: '2026-10-06', estimatedTotalKcal: 4000 }),
				call('show_stats', { days: 7, endDate: null }),
				call('show_stats', { days: 15, endDate: '2026-10-06' }),
			],
			TODAY,
		)
		expect(facts.closeDays).toEqual([
			{ date: TODAY, estimatedTotalKcal: null },
			{ date: '2026-10-06', estimatedTotalKcal: 4000 },
		])
		expect(facts.statsCards).toEqual([
			{ days: 7, endDate: null },
			{ days: 15, endDate: '2026-10-06' },
		])
	})

	it('skips broken arguments', () => {
		const facts = getCallFacts([{ name: 'show_day', arguments: '{oops' }], TODAY)
		expect(facts.dayCards).toEqual([])
	})
})
