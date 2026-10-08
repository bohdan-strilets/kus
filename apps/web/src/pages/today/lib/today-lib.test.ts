import { describe, expect, it } from 'vitest'

import { i18n } from '@/shared/i18n'

import { getDayTitle } from './get-day-title'
import { getMealSummary } from './get-meal-summary'
import { getSupportKey } from './get-support-key'
import { getWeekDays, getWeekStart } from './get-week-days'
import { resolveSelectedDate } from './resolve-selected-date'

const t = i18n.t.bind(i18n)

describe('getWeekDays', () => {
	it('lists the seven days that end on the window end, with their statuses', () => {
		const week = getWeekDays('2026-10-05', [
			{ localDate: '2026-09-30', kcal: 2600, goalKcal: 2200, status: 'over' },
			{ localDate: '2026-10-05', kcal: 1370, goalKcal: 2200, status: 'normal' },
		])
		expect(getWeekStart('2026-10-05')).toBe('2026-09-29')
		expect(week.map((day) => day.date.getDate())).toEqual([29, 30, 1, 2, 3, 4, 5])
		expect(week.map((day) => day.status)).toEqual([
			'empty',
			'over',
			'empty',
			'empty',
			'empty',
			'empty',
			'normal',
		])
	})
})

describe('getDayTitle', () => {
	it('names today and yesterday, other days by the weekday', () => {
		expect(getDayTitle({ localDate: '2026-10-05', today: '2026-10-05', t })).toBe('Сьогодні')
		expect(getDayTitle({ localDate: '2026-10-04', today: '2026-10-05', t })).toBe('Вчора')
		expect(getDayTitle({ localDate: '2026-10-01', today: '2026-10-05', t })).toBe('Четвер')
	})
})

describe('getSupportKey', () => {
	it('compares with a sandwich only when it is about one', () => {
		expect(getSupportKey(180)).toBe('today.support.small')
		expect(getSupportKey(650)).toBe('today.support.large')
	})
})

describe('getMealSummary', () => {
	it('joins the entry names', () => {
		expect(getMealSummary([{ name: 'Яйця' }, { name: 'Гречка' }])).toBe('Яйця, Гречка')
	})
})

describe('resolveSelectedDate', () => {
	it('keeps a real past day and falls back to today otherwise', () => {
		expect(resolveSelectedDate('2026-10-01', '2026-10-05')).toBe('2026-10-01')
		expect(resolveSelectedDate(null, '2026-10-05')).toBe('2026-10-05')
		expect(resolveSelectedDate('2026-02-31', '2026-10-05')).toBe('2026-10-05')
		expect(resolveSelectedDate('2026-10-09', '2026-10-05')).toBe('2026-10-05')
		expect(resolveSelectedDate('yesterday', '2026-10-05')).toBe('2026-10-05')
	})
})
