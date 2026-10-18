// @vitest-environment jsdom
import { cleanup, createEvent, fireEvent, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { i18n } from '@/shared/i18n'
import { renderWithProviders } from '@/shared/testing'

import { ScrollToEndButton } from './ScrollToEndButton'

afterEach(cleanup)

const getLabel = (): string => i18n.t('chat.scrollToEnd')

describe('ScrollToEndButton', () => {
	it('has a translated label (uk)', () => {
		expect(i18n.exists('chat.scrollToEnd')).toBe(true)
		expect(getLabel()).toBe('До останніх повідомлень')
	})

	it('renders nothing while hidden', () => {
		renderWithProviders(<ScrollToEndButton isShown={false} onPress={vi.fn()} />)

		expect(screen.queryByRole('button')).toBeNull()
	})

	it('renders a button with the accessible name when shown', () => {
		renderWithProviders(<ScrollToEndButton isShown onPress={vi.fn()} />)

		expect(screen.getByRole('button', { name: getLabel() })).toBeTruthy()
	})

	it('calls onPress on click', () => {
		const onPress = vi.fn()
		renderWithProviders(<ScrollToEndButton isShown onPress={onPress} />)

		fireEvent.click(screen.getByRole('button', { name: getLabel() }))

		expect(onPress).toHaveBeenCalledTimes(1)
	})

	it('keeps the field focus: mousedown is default-prevented', () => {
		renderWithProviders(<ScrollToEndButton isShown onPress={vi.fn()} />)
		const button = screen.getByRole('button', { name: getLabel() })

		const mouseDown = createEvent.mouseDown(button)
		fireEvent(button, mouseDown)

		expect(mouseDown.defaultPrevented).toBe(true)
	})

	// iOS/WebKit: preventDefault on pointerdown swallows the click of a touch tap
	it('does not cancel pointerdown', () => {
		renderWithProviders(<ScrollToEndButton isShown onPress={vi.fn()} />)
		const button = screen.getByRole('button', { name: getLabel() })

		const pointerDown = createEvent.pointerDown(button)
		fireEvent(button, pointerDown)

		expect(pointerDown.defaultPrevented).toBe(false)
	})
})
