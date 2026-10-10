import { describe, expect, it } from 'vitest'

import { parseDecimalInput } from './parse-decimal-input'

describe('parseDecimalInput', () => {
	it.each([
		['82,4', 82.4],
		['82.4', 82.4],
		[' 82,4 ', 82.4],
		['182', 182],
	])('parses %j', (raw, expected) => {
		expect(parseDecimalInput(raw)).toBe(expected)
	})

	it.each(['82,,4', 'abc', '-5', '', '   ', '1,2,3'])('rejects %j', (raw) => {
		expect(parseDecimalInput(raw)).toBeNull()
	})
})
