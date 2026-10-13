import { describe, expect, it } from 'vitest'

import { i18n } from '@/shared/i18n'

import { formatMeasurement, formatTargetWeight } from './format-measurement'

describe('formatTargetWeight', () => {
	it('drops a useless zero and keeps a real decimal with the Ukrainian comma', () => {
		expect(formatTargetWeight(78, i18n.t)).toBe('78 кг')
		expect(formatTargetWeight(78.0, i18n.t)).toBe('78 кг')
		expect(formatTargetWeight(78.5, i18n.t)).toBe('78,5 кг')
	})

	it('leaves the current weight with one decimal', () => {
		expect(formatMeasurement(78, 'WEIGHT', i18n.t)).toBe('78,0 кг')
	})
})
