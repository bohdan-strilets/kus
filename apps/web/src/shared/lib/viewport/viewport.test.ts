import { describe, expect, it } from 'vitest'

import { isTextField } from './use-text-field-focus'
import { getNextViewportBox, isSameBox, NO_VIEWPORT_BOX, readViewportBox } from './viewport-box'

describe('isTextField', () => {
	it('counts fields that bring up the keyboard', () => {
		expect(isTextField({ tagName: 'TEXTAREA' })).toBe(true)
		expect(isTextField({ tagName: 'INPUT', type: 'email' })).toBe(true)
		expect(isTextField({ tagName: 'INPUT', type: 'password' })).toBe(true)
		expect(isTextField({ tagName: 'DIV', isContentEditable: true })).toBe(true)
	})

	it('ignores buttons, checkboxes, read-only fields and nothing focused', () => {
		expect(isTextField({ tagName: 'INPUT', type: 'checkbox' })).toBe(false)
		expect(isTextField({ tagName: 'INPUT', type: 'text', readOnly: true })).toBe(false)
		expect(isTextField({ tagName: 'BUTTON' })).toBe(false)
		expect(isTextField(null)).toBe(false)
	})
})

describe('viewport box', () => {
	it('rounds the visual viewport and falls back without one', () => {
		const keyboardUp = { height: 455.6, offsetTop: 290.2 } as VisualViewport
		expect(readViewportBox(keyboardUp)).toEqual({ height: 456, offsetTop: 290 })
		expect(readViewportBox(undefined)).toBe(NO_VIEWPORT_BOX)
	})

	it('keeps the unzoomed box while the user pinch-zooms', () => {
		const unzoomed = { height: 844, offsetTop: 0 }
		const pinched = { height: 422, offsetTop: 210, scale: 2 } as VisualViewport
		expect(getNextViewportBox(unzoomed, pinched)).toBe(unzoomed)

		const keyboardUp = { height: 456, offsetTop: 290, scale: 1 } as VisualViewport
		expect(getNextViewportBox(unzoomed, keyboardUp)).toEqual({ height: 456, offsetTop: 290 })
		// nothing changed: the same object, no re-render
		expect(
			getNextViewportBox(unzoomed, { height: 844, offsetTop: 0, scale: 1 } as VisualViewport),
		).toBe(unzoomed)
	})

	it('treats the same numbers as the same box', () => {
		expect(isSameBox({ height: 844, offsetTop: 0 }, { height: 844, offsetTop: 0 })).toBe(true)
		expect(isSameBox({ height: 844, offsetTop: 0 }, { height: 456, offsetTop: 0 })).toBe(false)
	})
})
