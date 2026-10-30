import { describe, expect, it } from 'vitest'

import { i18n } from '@/shared/i18n'

import { getRememberedLabel, lowercaseFirst } from './get-remembered-label'

describe('lowercaseFirst', () => {
	it('lowers the first letter of a name', () => {
		expect(lowercaseFirst('Кабаноси Tarczyński')).toBe('кабаноси Tarczyński')
	})

	it('keeps an acronym', () => {
		expect(lowercaseFirst('KFC бургер')).toBe('KFC бургер')
	})

	it('handles a one-letter and an empty name', () => {
		expect(lowercaseFirst('Я')).toBe('я')
		expect(lowercaseFirst('')).toBe('')
	})
})

describe('getRememberedLabel', () => {
	const t = i18n.t.bind(i18n)

	it('names a single food', () => {
		expect(getRememberedLabel(['Кабаноси Tarczyński'], t)).toBe("Запам'ятав: кабаноси Tarczyński")
	})

	it('counts several foods with the Ukrainian plural', () => {
		expect(getRememberedLabel(['A', 'B'], t)).toBe("Запам'ятав: 2 продукти")
		expect(getRememberedLabel(['A', 'B', 'C', 'D', 'E'], t)).toBe("Запам'ятав: 5 продуктів")
	})
})
