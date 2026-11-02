// @vitest-environment jsdom
import type { WorkoutKcal } from '@kus/shared'
import { cleanup, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import { makeWorkout, renderWithProviders } from '@/shared/testing'

import { SessionSummaryCard } from './SessionSummaryCard'

afterEach(cleanup)

const renderCard = (kcal: WorkoutKcal | null) =>
	renderWithProviders(<SessionSummaryCard workout={makeWorkout({ kcal })} hasTail={false} />)

describe('SessionSummaryCard kcal', () => {
	it('shows the estimate with the number in bold', () => {
		renderCard({ value: 350, source: 'ESTIMATE' })

		expect(screen.getByText('≈ 350 ккал').tagName).toBe('B')
		expect(screen.getByText('≈ 350 ккал').parentElement?.textContent).toBe('≈ 350 ккал · оцінка')
	})

	it('shows a number the person named, with «зі слів»', () => {
		renderCard({ value: 380, source: 'MANUAL' })

		expect(screen.getByText('380 ккал').parentElement?.textContent).toBe('380 ккал · зі слів')
	})

	it('shows a number from a device, with «з табло»', () => {
		renderCard({ value: 320, source: 'DEVICE' })

		expect(screen.getByText('320 ккал').parentElement?.textContent).toBe('320 ккал · з табло')
	})

	it('says nothing about kcal without a number', () => {
		const { container } = renderCard(null)

		expect(container.textContent).not.toContain('ккал')
	})

	it('does not use the old note «на ціль не впливає» in the card', () => {
		const { container } = renderCard({ value: 380, source: 'MANUAL' })

		expect(container.textContent).not.toContain('на ціль не впливає')
	})
})
