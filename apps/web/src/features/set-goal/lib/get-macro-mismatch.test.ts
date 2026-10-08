import { describe, expect, it } from 'vitest'

import { getMacroMismatch } from './get-macro-mismatch'

describe('getMacroMismatch', () => {
	it('stays quiet when the macros fit the kcal within 10 %', () => {
		// 140·4 + 225·4 + 80·9 = 2180 of 2200
		expect(getMacroMismatch({ kcal: '2200', protein: '140', carbs: '225', fat: '80' })).toBeNull()
	})

	it('names the macro kcal and how far off they are', () => {
		expect(getMacroMismatch({ kcal: '2200', protein: '200', carbs: '300', fat: '100' })).toEqual({
			macroKcal: 2900,
			deltaPct: 32,
		})
		expect(getMacroMismatch({ kcal: '2200', protein: '100', carbs: '150', fat: '50' })).toEqual({
			macroKcal: 1450,
			deltaPct: -34,
		})
	})

	it('waits until every field is a number', () => {
		expect(getMacroMismatch({ kcal: '2200', protein: '', carbs: '225', fat: '80' })).toBeNull()
		expect(getMacroMismatch({ kcal: '0', protein: '1', carbs: '1', fat: '1' })).toBeNull()
	})
})
