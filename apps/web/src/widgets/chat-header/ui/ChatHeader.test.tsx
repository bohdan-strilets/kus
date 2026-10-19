// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'

import { COMPACT_HEADER_HEIGHT_PX } from '../model/chat-header.constants'
import { ChatHeader } from './ChatHeader'

vi.mock('react-router', () => ({ useNavigate: () => vi.fn() }))
vi.mock('@tanstack/react-query', () => ({ useQuery: () => ({ data: undefined, isPending: true }) }))
vi.mock('@/entities/day', () => ({ dayQueryOptions: () => ({}) }))
vi.mock('@/entities/session', () => ({ useSessionUser: () => ({ id: 'user-1' }) }))
vi.mock('@/entities/stats', () => ({
	CompactDayBar: () => <div data-testid="compact-bar" />,
	getDayStats: () => null,
}))
vi.mock('@/entities/user', () => ({
	useGreeting: () => 'Hello',
	UserAvatar: () => <div data-testid="avatar" />,
}))
vi.mock('@/shared/ui', () => ({
	Heading: ({ children }: { children: ReactNode }) => <h1>{children}</h1>,
	LogoMark: () => <i />,
	Text: ({ children }: { children: ReactNode }) => <span>{children}</span>,
	WORDMARK: 'Kusik',
}))
vi.mock('./DaySummarySlot', () => ({ DaySummarySlot: () => <div data-testid="day-slot" /> }))

const FULL_HEIGHT_PX = 219
const addressee = { name: 'Test', addressAs: null }

const renderHeader = (isCompact: boolean) =>
	render(
		<ChatHeader
			addressee={addressee}
			timeZone="Europe/Warsaw"
			today="2026-10-19"
			isCompact={isCompact}
			fullHeight={FULL_HEIGHT_PX}
			onFullHeightChange={() => undefined}
		/>,
	)

beforeAll(() => {
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

describe('ChatHeader', () => {
	it('renders the full header with the day card', () => {
		renderHeader(false)

		expect(screen.getByRole('heading', { name: 'Hello' })).toBeTruthy()
		expect(screen.getByTestId('day-slot')).toBeTruthy()
		expect(screen.queryByTestId('compact-bar')).toBeNull()
	})

	it('renders the compact header with the avatar and no day card', () => {
		renderHeader(true)

		expect(screen.getByTestId('avatar')).toBeTruthy()
		expect(screen.queryByTestId('day-slot')).toBeNull()
	})

	it('covers the measured height and catches touches in the full mode', () => {
		renderHeader(false)
		const header = screen.getByTestId('chat-header')

		expect(header.style.height).toBe(`${FULL_HEIGHT_PX}px`)
		expect(header.className).not.toContain('pointer-events-none')
	})

	it('covers the compact height and catches touches in the compact mode', () => {
		renderHeader(true)
		const header = screen.getByTestId('chat-header')

		expect(header.style.height).toBe(`${COMPACT_HEADER_HEIGHT_PX}px`)
		expect(header.className).not.toContain('pointer-events-none')
	})

	it('floats over the feed instead of taking part in the layout', () => {
		renderHeader(false)

		expect(screen.getByTestId('chat-header').className).toContain('absolute')
	})
})
