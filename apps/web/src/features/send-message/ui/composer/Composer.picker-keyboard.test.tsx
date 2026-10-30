// @vitest-environment jsdom
import { cleanup, fireEvent, screen } from '@testing-library/react'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

import { COARSE_POINTER_QUERY } from '@/shared/lib'
import { renderWithProviders } from '@/shared/testing'

import { Composer } from './Composer'

let isCoarse = false
const pickerClick = vi.fn()

beforeAll(() => {
	window.matchMedia = (query: string): MediaQueryList => ({
		matches: query === COARSE_POINTER_QUERY && isCoarse,
		media: query,
		onchange: null,
		addEventListener: () => undefined,
		removeEventListener: () => undefined,
		addListener: () => undefined,
		removeListener: () => undefined,
		dispatchEvent: () => false,
	})
	vi.stubGlobal(
		'ResizeObserver',
		class {
			observe = () => undefined
			unobserve = () => undefined
			disconnect = () => undefined
		},
	)
})

beforeEach(() => {
	pickerClick.mockClear()
	vi.spyOn(HTMLInputElement.prototype, 'click').mockImplementation(pickerClick)
})

afterEach(() => {
	cleanup()
	vi.restoreAllMocks()
})

/** Focuses the field (the keyboard is up) and taps the camera. */
const tapCameraWhileTyping = (): HTMLElement => {
	renderWithProviders(
		<Composer value="" onValueChange={() => undefined} onSubmit={() => undefined} />,
	)
	const field = screen.getByRole('textbox', { name: 'Повідомлення' })
	field.focus()
	fireEvent.click(screen.getByRole('button', { name: 'Додати фото їжі' }))
	return field
}

describe('Composer photo picker', () => {
	it('closes the keyboard before the picker on a phone', () => {
		isCoarse = true

		const field = tapCameraWhileTyping()

		expect(document.activeElement).not.toBe(field)
		expect(pickerClick).toHaveBeenCalledTimes(1)
	})

	it('keeps the field focused on a desktop', () => {
		isCoarse = false

		const field = tapCameraWhileTyping()

		expect(document.activeElement).toBe(field)
		expect(pickerClick).toHaveBeenCalledTimes(1)
	})
})
