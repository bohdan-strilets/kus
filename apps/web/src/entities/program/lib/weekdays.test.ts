import { describe, expect, it } from 'vitest'

import {
	getWeekdayLongName,
	getWeekdayShortName,
	PROGRAM_WEEKDAYS,
	toggleWeekday,
} from './weekdays'

describe('program weekdays', () => {
	it('lists Monday to Sunday', () => {
		expect(PROGRAM_WEEKDAYS).toEqual([1, 2, 3, 4, 5, 6, 7])
		expect(PROGRAM_WEEKDAYS.map(getWeekdayShortName)).toEqual([
			'Пн',
			'Вт',
			'Ср',
			'Чт',
			'Пт',
			'Сб',
			'Нд',
		])
	})

	it('names a day in full', () => {
		expect(getWeekdayLongName(1)).toBe('Понеділок')
		expect(getWeekdayLongName(7)).toBe('Неділя')
	})

	it('adds and removes a day keeping the list sorted', () => {
		expect(toggleWeekday([1, 5], 3)).toEqual([1, 3, 5])
		expect(toggleWeekday([1, 3, 5], 3)).toEqual([1, 5])
		expect(toggleWeekday([], 7)).toEqual([7])
	})
})
