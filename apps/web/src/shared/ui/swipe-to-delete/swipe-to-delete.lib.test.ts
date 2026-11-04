import { describe, expect, it } from 'vitest'

import { getSwipeOutcome, isHorizontalSwipe } from './swipe-to-delete.lib'

const WIDTH = 300

describe('getSwipeOutcome', () => {
	it('0 and a short pull go back', () => {
		expect(getSwipeOutcome(0, WIDTH)).toBe('close')
		expect(getSwipeOutcome(-71, WIDTH)).toBe('close')
	})

	it('72 px is the first that stays open', () => {
		expect(getSwipeOutcome(-72, WIDTH)).toBe('open')
		expect(getSwipeOutcome(-100, WIDTH)).toBe('open')
	})

	it('exactly 50 % of the width stays open, past it runs', () => {
		expect(getSwipeOutcome(-150, WIDTH)).toBe('open')
		expect(getSwipeOutcome(-150.5, WIDTH)).toBe('commit')
		expect(getSwipeOutcome(-WIDTH, WIDTH)).toBe('commit')
	})

	it('a shift to the right never opens or runs anything', () => {
		expect(getSwipeOutcome(40, WIDTH)).toBe('close')
		expect(getSwipeOutcome(WIDTH, WIDTH)).toBe('close')
	})

	it('a zero width row does not run on a 0 shift', () => {
		expect(getSwipeOutcome(0, 0)).toBe('close')
	})
})

describe('isHorizontalSwipe', () => {
	it('needs more than 10 px', () => {
		expect(isHorizontalSwipe(10, 0)).toBe(false)
		expect(isHorizontalSwipe(-10, 0)).toBe(false)
		expect(isHorizontalSwipe(11, 0)).toBe(true)
		expect(isHorizontalSwipe(-11, 0)).toBe(true)
	})

	it('needs |dx| more than 1,5 times |dy|', () => {
		expect(isHorizontalSwipe(30, 20)).toBe(false) // exactly 1,5
		expect(isHorizontalSwipe(31, 20)).toBe(true)
		expect(isHorizontalSwipe(20, 40)).toBe(false)
		expect(isHorizontalSwipe(-31, -20)).toBe(true)
	})
})
