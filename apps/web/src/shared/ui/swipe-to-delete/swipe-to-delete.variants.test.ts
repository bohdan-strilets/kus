import { describe, expect, it } from 'vitest'

import { swipeFrameVariants } from './swipe-to-delete.variants'

describe('swipeFrameVariants', () => {
	it('never shrinks in a flex column: overflow-hidden would zero its min-height', () => {
		expect(swipeFrameVariants().split(' ')).toContain('shrink-0')
		expect(swipeFrameVariants({ radius: 'chip' }).split(' ')).toContain('shrink-0')
	})
})
