import { describe, expect, it } from 'vitest'

import { limitDecimals } from './limit-decimals'

describe('limitDecimals', () => {
	it.each([
		['85,55', '85,5'],
		['85.55', '85.5'],
		['85,5', '85,5'],
		['85,', '85,'],
		['85', '85'],
		['', ''],
		['85,5,5', '85,5'],
	])('turns «%s» into «%s»', (input, expected) => {
		expect(limitDecimals(input, 1)).toBe(expected)
	})
})
