import { describe, expect, it } from 'vitest'

import { getDisplayVersion } from './get-display-version'

describe('getDisplayVersion', () => {
	it('keeps major and minor', () => {
		expect(getDisplayVersion('0.1.0')).toBe('0.1')
		expect(getDisplayVersion('1.12.3')).toBe('1.12')
	})

	it('leaves a short version as it is', () => {
		expect(getDisplayVersion('2')).toBe('2')
	})
})
