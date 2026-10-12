import { describe, expect, it } from 'vitest'

import { formatMeasurements } from './context.js'

describe('formatMeasurements', () => {
	it('lists the last weights, the waist and the target', () => {
		expect(
			formatMeasurements({
				today: '2026-10-07',
				weights: [
					{ value: 82.8, localDate: '2026-10-05' },
					{ value: 83.1, localDate: '2026-09-29' },
				],
				waist: { value: 94, localDate: '2026-10-01' },
				targetWeightKg: 78,
			}),
		).toBe(
			'Weight: 82.8 kg on 2026-10-05; 83.1 kg on 2026-09-29. Waist: 94 cm on 2026-10-01. Target weight: 78 kg.',
		)
	})

	it('says so when nothing is logged and skips the missing parts', () => {
		expect(
			formatMeasurements({ today: '2026-10-07', weights: [], waist: null, targetWeightKg: null }),
		).toBe('Weight: none logged.')
	})
})
