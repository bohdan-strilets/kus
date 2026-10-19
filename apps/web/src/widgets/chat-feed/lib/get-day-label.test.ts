import { describe, expect, it } from 'vitest'

import { i18n } from '@/shared/i18n'

import { getDayBadgeLabel, getDayCardTitle } from './get-day-label'

const TODAY = '2026-10-18'
const t = i18n.t.bind(i18n)

describe('getDayBadgeLabel', () => {
	it('is null for today', () => {
		expect(getDayBadgeLabel(TODAY, TODAY, t)).toBeNull()
	})

	it('says «На завтра» for tomorrow', () => {
		expect(getDayBadgeLabel('2026-10-19', TODAY, t)).toBe('На завтра, 19.10')
	})

	it('says «Вчора» for yesterday', () => {
		expect(getDayBadgeLabel('2026-10-17', TODAY, t)).toBe('Вчора, 17.10')
	})

	it('names the weekday for older days', () => {
		expect(getDayBadgeLabel('2026-10-16', TODAY, t)).toBe('Пт, 16.10')
		expect(getDayBadgeLabel('2026-10-15', TODAY, t)).toBe('Чт, 15.10')
	})
})

describe('getDayCardTitle', () => {
	it('titles every relation', () => {
		expect(getDayCardTitle(TODAY, TODAY, t)).toBe('Сьогодні')
		expect(getDayCardTitle('2026-10-19', TODAY, t)).toBe('Завтра, 19.10')
		expect(getDayCardTitle('2026-10-17', TODAY, t)).toBe('Вчора, 17.10')
		expect(getDayCardTitle('2026-10-16', TODAY, t)).toBe('Пт, 16.10')
	})
})
