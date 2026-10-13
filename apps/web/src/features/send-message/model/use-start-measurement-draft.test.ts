// @vitest-environment jsdom
import { renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'

import '@/shared/i18n'

import { useComposerDraftStore } from './composer-draft-store'
import { type MeasurementDraftKind, useStartMeasurementDraft } from './use-start-measurement-draft'

beforeEach(() => {
	useComposerDraftStore.setState({ text: '', isFocusRequested: false })
})

const CASES: { kind: MeasurementDraftKind; draft: string }[] = [
	{ kind: 'weight', draft: 'вага ' },
	{ kind: 'waist', draft: 'талія ' },
]

describe.each(CASES)('useStartMeasurementDraft($kind)', ({ kind, draft }) => {
	it(`puts «${draft}» in an empty composer and asks for focus`, () => {
		const { result } = renderHook(() => useStartMeasurementDraft(kind))

		result.current()

		expect(useComposerDraftStore.getState()).toMatchObject({
			text: draft,
			isFocusRequested: true,
		})
	})

	it('treats a whitespace-only draft as empty', () => {
		useComposerDraftStore.setState({ text: '   ' })
		const { result } = renderHook(() => useStartMeasurementDraft(kind))

		result.current()

		expect(useComposerDraftStore.getState().text).toBe(draft)
	})

	it('does not overwrite what the user already typed', () => {
		useComposerDraftStore.setState({ text: 'гречка 200 г' })
		const { result } = renderHook(() => useStartMeasurementDraft(kind))

		result.current()

		expect(useComposerDraftStore.getState()).toMatchObject({
			text: 'гречка 200 г',
			isFocusRequested: true,
		})
	})
})
