import { describe, expect, it } from 'vitest'

import { getMacroHint } from './get-macro-hint'

describe('getMacroHint', () => {
	it('is consistent when the macros fit the kcal', () => {
		expect(getMacroHint({ kcal: '2000', protein: '150', carbs: '190', fat: '70' })).toMatchObject({
			macroKcal: 1990,
			isConsistent: true,
		})
	})

	it('names the macro kcal when they are far off', () => {
		expect(getMacroHint({ kcal: '2000', protein: '100', carbs: '100', fat: '50' })).toEqual({
			macroKcal: 1250,
			deltaPct: -38,
			isConsistent: false,
		})
	})

	it('waits until every field is a number', () => {
		expect(getMacroHint({ kcal: '2000', protein: '', carbs: '190', fat: '70' })).toBeNull()
		expect(getMacroHint({ kcal: '0', protein: '1', carbs: '1', fat: '1' })).toBeNull()
	})
})
