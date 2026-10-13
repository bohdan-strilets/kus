// @vitest-environment jsdom
import { renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'

import '@/shared/i18n'

import { useComposerDraftStore } from './composer-draft-store'
import { useStartWeightDraft } from './use-start-weight-draft'

beforeEach(() => {
	useComposerDraftStore.setState({ text: '', isFocusRequested: false })
})

describe('useStartWeightDraft', () => {
	it('puts «вага » in an empty composer and asks for focus', () => {
		const { result } = renderHook(() => useStartWeightDraft())

		result.current()

		expect(useComposerDraftStore.getState()).toMatchObject({
			text: 'вага ',
			isFocusRequested: true,
		})
	})

	it('treats a whitespace-only draft as empty', () => {
		useComposerDraftStore.setState({ text: '   ' })
		const { result } = renderHook(() => useStartWeightDraft())

		result.current()

		expect(useComposerDraftStore.getState().text).toBe('вага ')
	})

	it('does not overwrite what the user already typed', () => {
		useComposerDraftStore.setState({ text: 'гречка 200 г' })
		const { result } = renderHook(() => useStartWeightDraft())

		result.current()

		expect(useComposerDraftStore.getState()).toMatchObject({
			text: 'гречка 200 г',
			isFocusRequested: true,
		})
	})
})
