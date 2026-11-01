import { describe, expect, it } from 'vitest'

import { BAR_CHART_DENSE_THRESHOLD, getBarDensity } from './get-bar-density'

describe('getBarDensity', () => {
	it('keeps every value and caption up to the threshold', () => {
		expect(getBarDensity(BAR_CHART_DENSE_THRESHOLD)).toEqual({ isDense: false, labelStep: 1 })
		expect(getBarDensity(4)).toEqual({ isDense: false, labelStep: 1 })
	})

	it('drops values and thins captions above it', () => {
		expect(getBarDensity(BAR_CHART_DENSE_THRESHOLD + 1)).toEqual({ isDense: true, labelStep: 2 })
		expect(getBarDensity(13)).toEqual({ isDense: true, labelStep: 3 })
		expect(getBarDensity(14)).toEqual({ isDense: true, labelStep: 3 })
	})
})
