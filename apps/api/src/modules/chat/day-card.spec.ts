import { describe, expect, it } from 'vitest'

import { readStoredDayCard } from './day-card'

const CARD = {
	version: 1,
	localDate: '2026-10-17',
	kind: 'past',
	asOf: null,
	totals: { kcal: 1100, protein: 60, fat: 40, carbs: 130 },
	goal: null,
	remainingKcal: null,
	meals: [{ type: 'LUNCH', eatenAt: '2026-10-17T11:00:00.000Z', kcal: 1100 }],
}

describe('readStoredDayCard', () => {
	it('reads a valid snapshot', () => {
		expect(readStoredDayCard(CARD)).toEqual({ card: CARD, isUnreadable: false })
	})

	it('reads a missing value as no card, without complaint', () => {
		expect(readStoredDayCard(null)).toEqual({ card: null, isUnreadable: false })
		expect(readStoredDayCard(undefined)).toEqual({ card: null, isUnreadable: false })
	})

	it('drops a broken value and says so', () => {
		for (const broken of [{ version: 2 }, 'text', 42, { ...CARD, kind: 'later' }]) {
			expect(readStoredDayCard(broken)).toEqual({ card: null, isUnreadable: true })
		}
	})
})
