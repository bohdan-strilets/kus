import { describe, expect, it } from 'vitest'

import {
	formatDecimal,
	formatInteger,
	formatSignedDecimal,
	formatSignedInteger,
	MINUS_SIGN,
} from './format-number'

describe('formatInteger', () => {
	it('separates thousands the Ukrainian way (no-break space)', () => {
		expect(formatInteger(1370)).toBe('1 370')
	})

	it('rounds to a whole number', () => {
		expect(formatInteger(829.6)).toBe('830')
	})
})

describe('formatDecimal', () => {
	it('uses a decimal comma and fixed digits', () => {
		expect(formatDecimal(82.4)).toBe('82,4')
		expect(formatDecimal(84)).toBe('84,0')
	})
})

describe('formatSignedInteger', () => {
	it('adds a plus to positive deltas', () => {
		expect(formatSignedInteger(180)).toBe('+180')
		expect(formatSignedInteger(1100)).toBe('+1 100')
	})

	it('uses the typographic minus and leaves zero bare', () => {
		expect(formatSignedInteger(-40)).toBe(`${MINUS_SIGN}40`)
		expect(formatSignedInteger(0)).toBe('0')
	})

	it('rounds once, so the sign matches the digits', () => {
		expect(formatSignedInteger(-0.5)).toBe('0')
		expect(formatSignedInteger(-1.5)).toBe(`${MINUS_SIGN}1`)
		expect(formatSignedInteger(179.6)).toBe('+180')
	})
})

describe('formatSignedDecimal', () => {
	it('formats weight deltas', () => {
		expect(formatSignedDecimal(-1.6)).toBe(`${MINUS_SIGN}1,6`)
		expect(formatSignedDecimal(0.3)).toBe('+0,3')
	})

	it('treats a delta that rounds to zero as zero', () => {
		expect(formatSignedDecimal(-0.04)).toBe('0,0')
	})
})
