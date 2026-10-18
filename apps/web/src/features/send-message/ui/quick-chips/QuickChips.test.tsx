// @vitest-environment jsdom
import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { renderWithProviders } from '@/shared/testing'

import { useComposerDraftStore } from '../../model/composer-draft-store'
import { QuickChips } from './QuickChips'

beforeEach(() => {
	useComposerDraftStore.setState({ text: '', isFocusRequested: false })
})

afterEach(cleanup)

describe('QuickChips', () => {
	it('puts «вага » into the draft and asks for focus', () => {
		renderWithProviders(<QuickChips isShown />)

		fireEvent.click(screen.getByRole('button', { name: 'Додати вагу' }))

		expect(useComposerDraftStore.getState().text).toBe('вага ')
		expect(useComposerDraftStore.getState().isFocusRequested).toBe(true)
	})

	it('renders both chips', () => {
		renderWithProviders(<QuickChips isShown />)

		expect(screen.getByRole('button', { name: 'Додати вагу' })).toBeTruthy()
		expect(screen.getByRole('button', { name: 'Додати талію' })).toBeTruthy()
	})

	it('puts «талія » into the draft and asks for focus', () => {
		renderWithProviders(<QuickChips isShown />)

		fireEvent.click(screen.getByRole('button', { name: 'Додати талію' }))

		expect(useComposerDraftStore.getState().text).toBe('талія ')
		expect(useComposerDraftStore.getState().isFocusRequested).toBe(true)
	})

	it('keeps the text the user already has when the waist chip is tapped', () => {
		useComposerDraftStore.setState({ text: 'гречка 200 г' })
		renderWithProviders(<QuickChips isShown />)

		fireEvent.click(screen.getByRole('button', { name: 'Додати талію' }))

		expect(useComposerDraftStore.getState().text).toBe('гречка 200 г')
		expect(useComposerDraftStore.getState().isFocusRequested).toBe(true)
	})

	it('keeps the text the user already has, but still asks for focus', () => {
		useComposerDraftStore.setState({ text: 'гречка 200 г' })
		renderWithProviders(<QuickChips isShown />)

		fireEvent.click(screen.getByRole('button', { name: 'Додати вагу' }))

		expect(useComposerDraftStore.getState().text).toBe('гречка 200 г')
		expect(useComposerDraftStore.getState().isFocusRequested).toBe(true)
	})
})

describe('QuickChips ask the chat to scroll to the end', () => {
	it.each(['Додати вагу', 'Додати талію'] as const)(
		'a tap on «%s» bumps scrollToEndRequest, also when the field is focused already',
		(name) => {
			useComposerDraftStore.setState({ scrollToEndRequest: 0 })
			renderWithProviders(
				<>
					<textarea aria-label="field" />
					<QuickChips isShown />
				</>,
			)
			screen.getByRole('textbox', { name: 'field' }).focus()

			fireEvent.click(screen.getByRole('button', { name }))
			expect(useComposerDraftStore.getState().scrollToEndRequest).toBe(1)

			fireEvent.click(screen.getByRole('button', { name }))
			expect(useComposerDraftStore.getState().scrollToEndRequest).toBe(2)
		},
	)
})

describe('QuickChips visibility', () => {
	it('removes the row once it is hidden, after the exit animation', async () => {
		const view = renderWithProviders(<QuickChips isShown />)
		expect(screen.getByRole('group', { name: 'Швидкі дії' })).toBeTruthy()

		view.rerender(<QuickChips isShown={false} />)

		await waitFor(() => {
			expect(screen.queryByRole('group', { name: 'Швидкі дії' })).toBeNull()
		})
	})
})

describe('QuickChips keep the field focused (iOS keyboard stays up)', () => {
	const CHIP_NAMES = ['Додати вагу', 'Додати талію'] as const

	it.each(CHIP_NAMES)('«%s»: pointerdown default is prevented', (name) => {
		renderWithProviders(<QuickChips isShown />)

		expect(fireEvent.pointerDown(screen.getByRole('button', { name }))).toBe(false)
	})

	it.each(CHIP_NAMES)('«%s»: mousedown default is prevented', (name) => {
		renderWithProviders(<QuickChips isShown />)

		expect(fireEvent.mouseDown(screen.getByRole('button', { name }))).toBe(false)
	})

	it.each([
		['Додати вагу', 'вага '],
		['Додати талію', 'талія '],
	] as const)('a tap on «%s» acts at once and leaves the field focused', async (name, draft) => {
		const user = userEvent.setup()
		renderWithProviders(
			<>
				<textarea aria-label="field" />
				<QuickChips isShown />
			</>,
		)
		const field = screen.getByRole('textbox', { name: 'field' })
		field.focus()

		await user.click(screen.getByRole('button', { name }))

		expect(useComposerDraftStore.getState().text).toBe(draft)
		expect(useComposerDraftStore.getState().isFocusRequested).toBe(true)
		expect(document.activeElement).toBe(field)
	})
})
