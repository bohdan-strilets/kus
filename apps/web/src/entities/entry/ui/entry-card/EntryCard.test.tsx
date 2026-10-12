// @vitest-environment jsdom
import { cleanup } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { renderWithProviders } from '@/shared/testing'

import { EntryCard } from './EntryCard'
import { EntryCardRow } from './EntryCardRow'

// countUp runs on motion's animate: mocking it shows where the count starts and ends
vi.mock('motion', () => ({ animate: vi.fn(() => ({ stop: vi.fn() })) }))

const { animate } = await import('motion')

const MACROS = { protein: 20, carbs: 40, fat: 10 }
const REVEAL_COUNT_MS = 500

interface RenderCardOptions {
	isRevealing?: boolean
	badge?: ReactNode
}

const renderCard = (options: RenderCardOptions = {}) =>
	renderWithProviders(
		<EntryCard mealLabel="Обід" time="13:00" kcal={370} macros={MACROS} {...options}>
			<EntryCardRow>
				<p>row</p>
			</EntryCardRow>
		</EntryCard>,
	)

beforeEach(() => {
	vi.mocked(animate).mockClear()
})

afterEach(() => {
	cleanup()
})

describe('EntryCard', () => {
	it('shows the final kcal at once and does not count from 0 when not revealing', () => {
		const { getByText } = renderCard()

		expect(getByText('370 ккал')).toBeTruthy()
		expect(animate).not.toHaveBeenCalled()
	})

	it('renders the rows without a hidden initial state when not revealing', () => {
		const { getByText } = renderCard()

		expect(getByText('row').parentElement?.style.opacity).not.toBe('0')
	})

	it('renders the badge slot in the wrapper, outside the clipped article', () => {
		const { getByTestId, container } = renderCard({ badge: <span data-testid="badge" /> })

		const badge = getByTestId('badge')
		expect(badge.parentElement).toBe(container.firstElementChild)
		expect(badge.closest('article')).toBeNull()
	})

	it('renders no badge by default', () => {
		const { container } = renderCard()

		expect(container.firstElementChild?.children).toHaveLength(1)
	})

	it('keeps the final kcal as the markup text and counts up from 0 when revealing', () => {
		const { getByText } = renderCard({ isRevealing: true })

		expect(getByText('370 ккал')).toBeTruthy()
		expect(animate).toHaveBeenCalledTimes(1)
		expect(animate).toHaveBeenCalledWith(
			0,
			370,
			expect.objectContaining({ duration: REVEAL_COUNT_MS / 1000 }),
		)
	})

	it('hides the rows initially when revealing', () => {
		const { getByText } = renderCard({ isRevealing: true })

		expect(getByText('row').parentElement?.style.opacity).toBe('0')
	})
})
