// @vitest-environment jsdom
import { cleanup, fireEvent, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { useLiveWorkoutStore } from '@/features/live-workout'
import { TRAINING_LIVE_ROUTE } from '@/shared/config'
import { makeLiveResponse, renderWithProviders } from '@/shared/testing'

import { SessionErrorState } from './SessionErrorState'

const OWNER = '0199b3a4-0000-7000-8000-00000000000a'
const RETRY = 'Спробувати ще раз'
const STRIP_LABEL = /без мережі\. Відкрити$/

beforeEach(() => {
	useLiveWorkoutStore.setState({ ownerId: null, snapshots: {}, lastSeen: null })
})

afterEach(() => {
	cleanup()
	vi.clearAllMocks()
})

describe('SessionErrorState', () => {
	it('tells the connection is lost and retries on the button', () => {
		const onRetry = vi.fn()
		renderWithProviders(<SessionErrorState onRetry={onRetry} />)

		expect(screen.getByRole('heading', { name: "Немає зв'язку з Kusik" })).toBeTruthy()
		expect(screen.getByText(/Перевір інтернет і спробуй ще раз/)).toBeTruthy()
		fireEvent.click(screen.getByRole('button', { name: RETRY }))

		expect(onRetry).toHaveBeenCalledTimes(1)
	})

	it('sits in the app shell: the bottom nav is there with its tabs', () => {
		renderWithProviders(<SessionErrorState onRetry={vi.fn()} />)

		const nav = screen.getByRole('navigation')

		expect(nav).toBeTruthy()
		expect(nav.querySelectorAll('a').length).toBeGreaterThan(1)
	})

	it('has no «Продовжити тренування» button, even with a kept workout', () => {
		useLiveWorkoutStore.setState({ ownerId: OWNER, lastSeen: makeLiveResponse() })
		renderWithProviders(<SessionErrorState onRetry={vi.fn()} canOpenLive />)

		expect(screen.queryByText('Продовжити тренування')).toBeNull()
		expect(screen.getAllByRole('button')).toHaveLength(1)
	})

	it('shows the offline mini strip from the kept copy when the live screen can be opened', () => {
		useLiveWorkoutStore.setState({
			ownerId: OWNER,
			lastSeen: makeLiveResponse({ templateName: 'Верх А' }),
		})
		renderWithProviders(<SessionErrorState onRetry={vi.fn()} canOpenLive />)

		const link = screen.getByRole('link', { name: STRIP_LABEL })

		expect(link.getAttribute('href')).toBe(TRAINING_LIVE_ROUTE)
		expect(link.getAttribute('aria-label')).toContain('Іде тренування: Верх А · ')
		expect(link.querySelector('.bg-success')).toBeNull()
		expect(link.querySelector('.border-2')).toBeTruthy()
	})

	it('shows no strip without canOpenLive, even with a kept workout', () => {
		useLiveWorkoutStore.setState({ ownerId: OWNER, lastSeen: makeLiveResponse() })
		renderWithProviders(<SessionErrorState onRetry={vi.fn()} />)

		expect(screen.queryByRole('link', { name: STRIP_LABEL })).toBeNull()
	})

	it('shows no strip when the device holds no lastSeen', () => {
		renderWithProviders(<SessionErrorState onRetry={vi.fn()} canOpenLive />)

		expect(screen.queryByRole('link', { name: STRIP_LABEL })).toBeNull()
		expect(screen.getByRole('button', { name: RETRY })).toBeTruthy()
	})

	it('renders without a session user: no loader, an alert on the screen', () => {
		renderWithProviders(<SessionErrorState onRetry={vi.fn()} />)

		expect(screen.getByRole('alert')).toBeTruthy()
		expect(screen.queryByText('Завантаження')).toBeNull()
	})
})
