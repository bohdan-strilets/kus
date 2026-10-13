// @vitest-environment jsdom
import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react'
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

	it('keeps the text the user already has, but still asks for focus', () => {
		useComposerDraftStore.setState({ text: 'гречка 200 г' })
		renderWithProviders(<QuickChips isShown />)

		fireEvent.click(screen.getByRole('button', { name: 'Додати вагу' }))

		expect(useComposerDraftStore.getState().text).toBe('гречка 200 г')
		expect(useComposerDraftStore.getState().isFocusRequested).toBe(true)
	})
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
