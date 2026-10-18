import { describe, expect, it, vi } from 'vitest'

import { keepFieldFocus } from './keep-field-focus'

describe('keepFieldFocus', () => {
	it('prevents the default of the event so the field keeps focus', () => {
		const preventDefault = vi.fn()

		keepFieldFocus({ preventDefault })

		expect(preventDefault).toHaveBeenCalledTimes(1)
	})
})
