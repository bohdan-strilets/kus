// @vitest-environment jsdom
import { cleanup, screen } from '@testing-library/react'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'

import { renderWithProviders, stubMatchMedia } from '@/shared/testing'

import { Composer } from './Composer'

// jsdom has neither; the field only observes its own size
beforeAll(() => {
	stubMatchMedia()
	vi.stubGlobal(
		'ResizeObserver',
		class {
			observe = () => undefined
			unobserve = () => undefined
			disconnect = () => undefined
		},
	)
})

afterEach(cleanup)

const renderComposer = (shouldFocus: boolean, onFocusHandled: () => void) =>
	renderWithProviders(
		<Composer
			value=""
			onValueChange={() => undefined}
			onSubmit={() => undefined}
			shouldFocus={shouldFocus}
			onFocusHandled={onFocusHandled}
		/>,
	)

describe('Composer focus request', () => {
	it('focuses the field and reports it handled', () => {
		const onFocusHandled = vi.fn()

		renderComposer(true, onFocusHandled)

		expect(document.activeElement).toBe(screen.getByRole('textbox', { name: 'Повідомлення' }))
		expect(onFocusHandled).toHaveBeenCalledTimes(1)
	})

	it('leaves focus alone without a request', () => {
		const onFocusHandled = vi.fn()

		renderComposer(false, onFocusHandled)

		expect(document.activeElement).not.toBe(screen.getByRole('textbox'))
		expect(onFocusHandled).not.toHaveBeenCalled()
	})

	it('puts the cursor at the asked position, not at the end', () => {
		renderWithProviders(
			<Composer
				value="Зміни склад: гречка"
				onValueChange={() => undefined}
				onSubmit={() => undefined}
				shouldFocus
				focusCaret={13}
			/>,
		)

		const field = screen.getByRole<HTMLTextAreaElement>('textbox', { name: 'Повідомлення' })
		expect(field.selectionStart).toBe(13)
		expect(field.selectionEnd).toBe(13)
	})
})
