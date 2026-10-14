import { describe, expect, it } from 'vitest'

import { shouldShowQuickChips } from './should-show-quick-chips'

const options = { isEnabled: true, draftText: '' }

describe('shouldShowQuickChips', () => {
	it('shows for an empty draft', () => {
		expect(shouldShowQuickChips(options)).toBe(true)
	})

	it('hides when the draft has text', () => {
		expect(shouldShowQuickChips({ ...options, draftText: 'гречка' })).toBe(false)
	})

	it('treats whitespace as empty', () => {
		expect(shouldShowQuickChips({ ...options, draftText: '  \n ' })).toBe(true)
	})

	it('hides when the feature is off', () => {
		expect(shouldShowQuickChips({ ...options, isEnabled: false })).toBe(false)
	})
})
