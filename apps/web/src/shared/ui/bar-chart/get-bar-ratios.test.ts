import { describe, expect, it } from 'vitest'

import { getBarRatios, MIN_BAR_RATIO } from './get-bar-ratios'

describe('getBarRatios', () => {
	it('scales to the tallest bar', () => {
		expect(getBarRatios([2, 4, 1])).toEqual([0.5, 1, 0.25])
	})

	it('keeps zero as zero and lifts tiny values to the minimum', () => {
		expect(getBarRatios([0, 1, 1000])).toEqual([0, MIN_BAR_RATIO, 1])
	})

	it('handles empty, all-zero and invalid input', () => {
		expect(getBarRatios([])).toEqual([])
		expect(getBarRatios([0, 0])).toEqual([0, 0])
		expect(getBarRatios([Number.NaN, -3, 5])).toEqual([0, 0, 1])
	})
})
