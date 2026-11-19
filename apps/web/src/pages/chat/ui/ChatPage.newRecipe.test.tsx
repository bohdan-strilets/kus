// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import type { ReactNode } from 'react'
import { MemoryRouter, useLocation } from 'react-router'
import { I18nextProvider } from 'react-i18next'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { useComposerDraftStore, useSendMessage } from '@/features/send-message'
import { i18n } from '@/shared/i18n'
import { stubMatchMedia } from '@/shared/testing'

import { ChatPage } from './ChatPage'

const USER = { id: 'u1', name: 'Богдан', addressAs: 'NEUTRAL', timezone: 'Europe/Warsaw' }

vi.mock('@/entities/session', () => ({ useSessionUser: () => USER }))
vi.mock('@/entities/day', () => ({ useLocalToday: () => '2026-11-19' }))
vi.mock('@/features/edit-entry', () => ({ EditEntrySheet: () => null }))
vi.mock('@/features/edit-measurement', () => ({ EditMeasurementSheet: () => null }))
vi.mock('@/widgets/chat-header', () => ({
	ChatHeader: () => null,
	COMPACT_HEADER_HEIGHT_PX: 0,
	DEFAULT_FULL_HEADER_HEIGHT_PX: 0,
}))
vi.mock('../model/use-chat-header-mode', () => ({
	useChatHeaderMode: () => ({
		mode: 'full',
		onComposerFocusChange: vi.fn(),
		onScrolledUpChange: vi.fn(),
		expand: vi.fn(),
	}),
}))
// the feed is its own widget: here it only has to place the footer
vi.mock('@/widgets/chat-feed', async (importOriginal) => ({
	...(await importOriginal<object>()),
	ChatFeed: ({ footer }: { footer?: ReactNode }) => <div>{footer}</div>,
}))
vi.mock('@/features/send-message', async (importOriginal) => {
	const send = vi.fn()
	return {
		...(await importOriginal<object>()),
		useSendMessage: () => ({ send, retry: vi.fn() }),
	}
})

const LocationProbe = () => {
	const location = useLocation()
	return <output data-testid="state">{JSON.stringify(location.state)}</output>
}

const renderChat = (state: unknown) => {
	stubMatchMedia()
	// jsdom has none; the field only observes its own size
	vi.stubGlobal(
		'ResizeObserver',
		class {
			observe = () => undefined
			unobserve = () => undefined
			disconnect = () => undefined
		},
	)
	return render(
		<I18nextProvider i18n={i18n}>
			<QueryClientProvider client={new QueryClient()}>
				<MemoryRouter initialEntries={[{ pathname: '/app', state }]}>
					<ChatPage />
					<LocationProbe />
				</MemoryRouter>
			</QueryClientProvider>
		</I18nextProvider>,
	)
}

beforeEach(() => {
	useComposerDraftStore.setState({ text: '', isFocusRequested: false })
	vi.mocked(useSendMessage().send).mockClear()
})

afterEach(cleanup)

describe('ChatPage in «Новий рецепт»', () => {
	it('shows the explanation and the placeholder of the state', () => {
		renderChat({ intent: 'new_recipe' })

		expect(screen.getByText(/^Опиши страву, як розповів би другу/)).toBeTruthy()
		expect(screen.getByPlaceholderText('Опиши страву…')).toBeTruthy()
	})

	it('is the plain chat without the state', () => {
		renderChat(null)

		expect(screen.queryByText(/^Опиши страву, як розповів би другу/)).toBeNull()
		expect(screen.getByPlaceholderText('Напиши, що їси, або спитай…')).toBeTruthy()
	})

	it('sends the first message with the intent, then the state ends and the next goes plain', () => {
		renderChat({ intent: 'new_recipe' })
		const field = screen.getByLabelText('Повідомлення')

		fireEvent.change(field, { target: { value: 'борщ на 3 літри' } })
		fireEvent.submit(field.closest('form') as HTMLFormElement)

		const { send } = useSendMessage()
		expect(vi.mocked(send).mock.calls[0]?.[0]).toMatchObject({
			text: 'борщ на 3 літри',
			intent: 'new_recipe',
		})
		expect(screen.getByTestId('state').textContent).toBe('null')
		expect(screen.queryByText(/^Опиши страву, як розповів би другу/)).toBeNull()

		fireEvent.change(field, { target: { value: 'ще' } })
		fireEvent.submit(field.closest('form') as HTMLFormElement)

		expect(vi.mocked(send).mock.calls[1]?.[0].intent).toBeUndefined()
	})
})
