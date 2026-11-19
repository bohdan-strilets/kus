// @vitest-environment jsdom
import { act, cleanup } from '@testing-library/react'
import { useLocation } from 'react-router'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { renderHookWithProviders } from '@/shared/testing'

import { useComposerDraftStore } from './composer-draft-store'
import { useStartRecipeEditDraft } from './use-start-recipe-edit-draft'

beforeEach(() => {
	useComposerDraftStore.setState({ text: '', isFocusRequested: false, focusCaret: null })
})

afterEach(cleanup)

const PREFIX = 'Зміни склад «Борщ»: '

const setup = () =>
	renderHookWithProviders(() => ({
		start: useStartRecipeEditDraft(),
		location: useLocation(),
	}))

describe('useStartRecipeEditDraft', () => {
	it('fills the field with the name, asks for focus and opens the chat', () => {
		const { result } = setup()

		act(() => {
			result.current.start('Борщ')
		})

		expect(useComposerDraftStore.getState()).toMatchObject({
			text: 'Зміни склад «Борщ»: ',
			isFocusRequested: true,
		})
		expect(result.current.location.pathname).toBe('/app')
		// a plain message: no «Новий рецепт» state
		expect(result.current.location.state).toBeNull()
	})

	it('puts the cursor right behind the prefix', () => {
		const { result } = setup()

		act(() => {
			result.current.start('Борщ')
		})

		expect(useComposerDraftStore.getState().focusCaret).toBe(PREFIX.length)
	})

	it('keeps what the user already typed after the prefix', () => {
		useComposerDraftStore.setState({ text: 'гречка 200 г' })
		const { result } = setup()

		act(() => {
			result.current.start('Борщ')
		})

		expect(useComposerDraftStore.getState()).toMatchObject({
			text: `${PREFIX}гречка 200 г`,
			focusCaret: PREFIX.length,
		})
	})

	it('does not repeat the prefix when the draft already starts with it', () => {
		useComposerDraftStore.setState({ text: `${PREFIX}без цибулі` })
		const { result } = setup()

		act(() => {
			result.current.start('Борщ')
		})

		expect(useComposerDraftStore.getState()).toMatchObject({
			text: `${PREFIX}без цибулі`,
			focusCaret: PREFIX.length,
		})
	})
})
