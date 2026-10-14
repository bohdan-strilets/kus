import { describe, expect, it } from 'vitest'

import type { PhotoDraftStatus } from '../model/photo-draft-store'
import { shouldShowQuickChips } from './should-show-quick-chips'

const options = {
	isEnabled: true,
	draftText: '',
	photoStatus: 'idle' as PhotoDraftStatus,
}

describe('shouldShowQuickChips', () => {
	it('shows for an empty draft without a photo', () => {
		expect(shouldShowQuickChips(options)).toBe(true)
	})

	it('hides when the draft has text', () => {
		expect(shouldShowQuickChips({ ...options, draftText: 'гречка' })).toBe(false)
	})

	it('treats whitespace as empty', () => {
		expect(shouldShowQuickChips({ ...options, draftText: '  \n ' })).toBe(true)
	})

	it.each<PhotoDraftStatus>(['processing', 'ready', 'error'])(
		'hides while the photo is %s',
		(photoStatus) => {
			expect(shouldShowQuickChips({ ...options, photoStatus })).toBe(false)
		},
	)

	it('hides when the feature is off', () => {
		expect(shouldShowQuickChips({ ...options, isEnabled: false })).toBe(false)
	})
})
