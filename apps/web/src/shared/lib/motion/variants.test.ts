import { describe, expect, it } from 'vitest'

import { popInReducedVariants, sheetReducedVariants } from './variants'

const MOVING_KEYS = ['y', 'x', 'scale', 'height']

describe.each([
	['sheetReducedVariants', sheetReducedVariants],
	['popInReducedVariants', popInReducedVariants],
])('%s', (_name, variants) => {
	it('has hidden and visible states', () => {
		expect(variants.hidden).toBeTruthy()
		expect(variants.visible).toBeTruthy()
	})

	it('only fades: opacity and no travel, scale or height', () => {
		for (const state of [variants.hidden, variants.visible]) {
			const keys = Object.keys(state as object)
			for (const key of MOVING_KEYS) expect(keys).not.toContain(key)
			expect(keys).toContain('opacity')
		}
	})

	it('goes from invisible to fully visible', () => {
		expect((variants.hidden as { opacity: number }).opacity).toBe(0)
		expect((variants.visible as { opacity: number }).opacity).toBe(1)
	})
})
