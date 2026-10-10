import { describe, expect, it } from 'vitest'

import { i18n } from '@/shared/i18n'

import { formatEta } from './format-eta'

const t = i18n.t.bind(i18n)

describe('formatEta', () => {
	it('counts weeks below eight', () => {
		expect(formatEta(5, t)).toBe('5 тижнів')
		expect(formatEta(1, t)).toBe('1 тиждень')
		expect(formatEta(3, t)).toBe('3 тижні')
	})

	it('switches to months from eight weeks', () => {
		expect(formatEta(8, t)).toBe('2 місяці')
		expect(formatEta(17.6, t)).toBe('4 місяці')
		expect(formatEta(24, t)).toBe('6 місяців')
	})
})
