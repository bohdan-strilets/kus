// @vitest-environment jsdom
import { act, cleanup, renderHook } from '@testing-library/react'
import type { ReactNode } from 'react'
import { MemoryRouter, useLocation } from 'react-router'
import { afterEach, describe, expect, it } from 'vitest'

import { getChatEntryIntent, NEW_RECIPE_ENTRY_STATE } from '../lib/chat-entry-state'
import { useChatIntent } from './use-chat-intent'

afterEach(cleanup)

const renderAt = (state: unknown) =>
	renderHook(() => ({ chat: useChatIntent(), location: useLocation() }), {
		wrapper: ({ children }: { children: ReactNode }) => (
			<MemoryRouter initialEntries={[{ pathname: '/app', state }]}>{children}</MemoryRouter>
		),
	})

describe('getChatEntryIntent', () => {
	it('reads the intent of the navigation state', () => {
		expect(getChatEntryIntent(NEW_RECIPE_ENTRY_STATE)).toBe('new_recipe')
	})

	it.each([null, undefined, 'new_recipe', {}, { intent: 'hack' }, { intent: 5 }])(
		'treats %j as the plain chat',
		(state) => {
			expect(getChatEntryIntent(state)).toBeNull()
		},
	)
})

describe('useChatIntent', () => {
	it('is «Новий рецепт» when the chat is opened with its state', () => {
		const { result } = renderAt(NEW_RECIPE_ENTRY_STATE)

		expect(result.current.chat.intent).toBe('new_recipe')
	})

	it('is the plain chat without a state', () => {
		const { result } = renderAt(null)

		expect(result.current.chat.intent).toBeNull()
	})

	it('ends the state in place: same path, no state', () => {
		const { result } = renderAt(NEW_RECIPE_ENTRY_STATE)

		act(() => {
			result.current.chat.end()
		})

		expect(result.current.chat.intent).toBeNull()
		expect(result.current.location.pathname).toBe('/app')
		expect(result.current.location.state).toBeNull()
	})
})
