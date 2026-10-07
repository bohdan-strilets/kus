import { describe, expect, it } from 'vitest'

import { type EnterKeyState, getEnterAction } from './get-enter-action'

const enter: EnterKeyState = {
	key: 'Enter',
	shiftKey: false,
	isComposing: false,
	isCoarsePointer: false,
	hasText: true,
}

describe('getEnterAction', () => {
	it('sends on Enter with a physical keyboard', () => {
		expect(getEnterAction(enter)).toBe('send')
	})

	it('leaves Shift+Enter to the browser: a new line', () => {
		expect(getEnterAction({ ...enter, shiftKey: true })).toBe('default')
	})

	it('makes Enter a new line on a touch device, only the button sends', () => {
		expect(getEnterAction({ ...enter, isCoarsePointer: true })).toBe('default')
	})

	it('does not send while an IME is composing', () => {
		expect(getEnterAction({ ...enter, isComposing: true })).toBe('default')
	})

	it('swallows Enter with empty or whitespace-only text', () => {
		expect(getEnterAction({ ...enter, hasText: false })).toBe('block')
	})

	it('ignores other keys', () => {
		expect(getEnterAction({ ...enter, key: 'a' })).toBe('default')
	})
})
