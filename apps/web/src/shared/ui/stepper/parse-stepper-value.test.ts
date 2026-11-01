import { describe, expect, it } from 'vitest'

import { parseStepperValue } from './parse-stepper-value'

const DECIMAL = { min: 0, max: 500, decimals: 1 }
const INTEGER = { min: 1, max: 10, decimals: 0 }

describe('parseStepperValue', () => {
	it('accepts a comma and a dot', () => {
		expect(parseStepperValue('2,5', DECIMAL)).toBe(2.5)
		expect(parseStepperValue('2.5', DECIMAL)).toBe(2.5)
	})

	it('rejects more digits than the decimals instead of rounding', () => {
		expect(parseStepperValue('2.55', DECIMAL)).toBeNull()
		expect(parseStepperValue('2,56', DECIMAL)).toBeNull()
		expect(parseStepperValue('2,50', { ...DECIMAL, decimals: 2 })).toBe(2.5)
	})

	it('rejects text, empty, negatives and out of range', () => {
		expect(parseStepperValue('abc', DECIMAL)).toBeNull()
		expect(parseStepperValue('', DECIMAL)).toBeNull()
		expect(parseStepperValue('-1', DECIMAL)).toBeNull()
		expect(parseStepperValue('501', DECIMAL)).toBeNull()
		expect(parseStepperValue('0', INTEGER)).toBeNull()
		expect(parseStepperValue('11', INTEGER)).toBeNull()
	})

	it('rejects a fraction in a whole-number field', () => {
		expect(parseStepperValue('3,5', INTEGER)).toBeNull()
		expect(parseStepperValue('3', INTEGER)).toBe(3)
	})
})
