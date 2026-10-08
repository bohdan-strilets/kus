import { describe, expect, it } from 'vitest'

import { getHeaderMode } from './get-header-mode'

describe('getHeaderMode', () => {
	const base = { isScrolledUp: false, isComposerFocused: false, isExpandedByTap: false }

	it('is full at the bottom of the feed with the field idle', () => {
		expect(getHeaderMode(base)).toBe('full')
	})

	it('collapses while typing and expands on a tap without losing the field', () => {
		expect(getHeaderMode({ ...base, isComposerFocused: true })).toBe('focused')
		expect(getHeaderMode({ ...base, isComposerFocused: true, isExpandedByTap: true })).toBe('full')
	})

	it('stays the history bar when scrolled up, typing or not', () => {
		expect(getHeaderMode({ ...base, isScrolledUp: true })).toBe('compact')
		expect(
			getHeaderMode({ isScrolledUp: true, isComposerFocused: true, isExpandedByTap: true }),
		).toBe('compact')
	})
})
