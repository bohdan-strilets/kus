import type { TFunction } from 'i18next'
import { describe, expect, it } from 'vitest'

import { i18n } from '@/shared/i18n'

import { getMemorySubtitle } from './get-memory-subtitle'

const t = i18n.t.bind(i18n) as TFunction

describe('getMemorySubtitle', () => {
	it('puts the facts before the products, as in the mockup', () => {
		expect(getMemorySubtitle({ productsCount: 8, factsCount: 5 }, t)).toBe('5 фактів · 8 продуктів')
	})

	it('leaves out a part that is empty or not loaded', () => {
		expect(getMemorySubtitle({ productsCount: 8, factsCount: 0 }, t)).toBe('8 продуктів')
		expect(getMemorySubtitle({ productsCount: null, factsCount: 1 }, t)).toBe('1 факт')
		expect(getMemorySubtitle({ productsCount: 0, factsCount: null }, t)).toBeUndefined()
	})

	it('uses the plural forms', () => {
		expect(getMemorySubtitle({ productsCount: 2, factsCount: 22 }, t)).toBe('22 факти · 2 продукти')
		expect(getMemorySubtitle({ productsCount: 21, factsCount: 11 }, t)).toBe(
			'11 фактів · 21 продукт',
		)
	})
})
