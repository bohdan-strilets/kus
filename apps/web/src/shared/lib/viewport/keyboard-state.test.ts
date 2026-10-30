import { describe, expect, it } from 'vitest'

import {
	getKeyboardPhase,
	getKeyboardPx,
	getNextFullHeight,
	KEYBOARD_GRACE_MS,
	type KeyboardPhaseInput,
} from './keyboard-state'
import { readViewportBox } from './viewport-box'

const phase = (input: Partial<KeyboardPhaseInput>) =>
	getKeyboardPhase({
		isFieldFocused: false,
		keyboardPx: 0,
		msSinceFocusIn: KEYBOARD_GRACE_MS,
		hasVisualViewport: true,
		...input,
	})

describe('getKeyboardPhase', () => {
	it('focus and a shrunk viewport: open', () => {
		expect(phase({ isFieldFocused: true, keyboardPx: 415, msSinceFocusIn: 2000 })).toBe('open')
	})

	it('focus within the grace period, no shrink yet: open', () => {
		expect(phase({ isFieldFocused: true, msSinceFocusIn: KEYBOARD_GRACE_MS - 1 })).toBe('open')
	})

	it('focus after the grace period without a shrink: closed', () => {
		expect(phase({ isFieldFocused: true, msSinceFocusIn: KEYBOARD_GRACE_MS })).toBe('closed')
	})

	it('blur while still shrunk: open until the box grows back', () => {
		expect(phase({ isFieldFocused: false, keyboardPx: 415 })).toBe('open')
	})

	it('blur and grown: closed', () => {
		expect(phase({ isFieldFocused: false, keyboardPx: 0 })).toBe('closed')
	})

	it('the accessory bar alone (~55 px) is not a keyboard', () => {
		expect(phase({ isFieldFocused: true, keyboardPx: 55, msSinceFocusIn: 2000 })).toBe('closed')
	})

	it('without visualViewport falls back to focus', () => {
		expect(phase({ hasVisualViewport: false, isFieldFocused: true })).toBe('open')
		expect(phase({ hasVisualViewport: false, isFieldFocused: false, keyboardPx: 500 })).toBe(
			'closed',
		)
	})
})

describe('getNextFullHeight', () => {
	const base = { scale: 1, isFieldFocused: false, isReseeding: false }

	it('seeds from the first value and keeps the maximum', () => {
		expect(getNextFullHeight({ ...base, previous: null, height: 800 })).toBe(800)
		expect(getNextFullHeight({ ...base, previous: 800, height: 873 })).toBe(873)
		expect(getNextFullHeight({ ...base, previous: 873, height: 458 })).toBe(873)
	})

	it('ignores values while a field is focused or zoomed', () => {
		expect(getNextFullHeight({ ...base, previous: 800, height: 900, isFieldFocused: true })).toBe(
			800,
		)
		expect(getNextFullHeight({ ...base, previous: 800, height: 900, scale: 2 })).toBe(800)
	})

	it('reseeds to the given value after an orientation change', () => {
		expect(getNextFullHeight({ ...base, previous: 873, height: 400, isReseeding: true })).toBe(400)
	})
})

describe('keyboard height from the author measurements (PWA, keyboard open)', () => {
	it('lays the box over 415…873 and never past the full height', () => {
		const fullHeight = 873
		const box = readViewportBox({ height: 458, offsetTop: 415 } as VisualViewport)
		expect(box).toEqual({ height: 458, offsetTop: 415 })
		expect(box.offsetTop + (box.height ?? 0)).toBeLessThanOrEqual(fullHeight + 1)
		// innerHeight shrinks to 458 too, so it must not be what the keyboard height is taken from
		expect(getKeyboardPx(fullHeight, box.height)).toBe(415)
		expect(getKeyboardPx(null, box.height)).toBe(0)
	})
})
