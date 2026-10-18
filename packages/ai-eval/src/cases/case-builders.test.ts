import { describe, expect, it } from 'vitest'

import { atClock } from './case-builders.js'
import { PENDING_CASES, REPO_CASES } from './index.js'

describe('atClock', () => {
	it('sets the clock and the measurements day together', () => {
		const context = atClock('2026-10-08 00:40, Thursday')
		expect(context.localTime).toBe('2026-10-08 00:40, Thursday')
		expect(context.measurements?.today).toBe('2026-10-08')
	})

	it('rejects a clock without a date', () => {
		expect(() => atClock('00:40, Thursday')).toThrow()
	})
})

describe('case clocks', () => {
	it('never let localTime and measurements.today name different days', () => {
		for (const { id, context } of [...REPO_CASES, ...PENDING_CASES]) {
			if (!context?.localTime) continue
			expect(context.localTime.slice(0, 10), id).toBe(context.measurements?.today)
		}
	})
})
