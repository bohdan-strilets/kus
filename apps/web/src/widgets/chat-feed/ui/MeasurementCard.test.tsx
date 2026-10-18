// @vitest-environment jsdom
import type { MeasurementCard as MeasurementCardData } from '@kus/shared'
import { cleanup, fireEvent, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import { useEditMeasurementStore } from '@/features/edit-measurement'
import { renderWithProviders } from '@/shared/testing'

import { MeasurementCard } from './MeasurementCard'

const TODAY = '2026-10-18'

const createCard = (overrides: Partial<MeasurementCardData> = {}): MeasurementCardData => ({
	id: '0199b3a4-0000-7000-8000-000000000001',
	kind: 'WEIGHT',
	value: 82.4,
	localDate: TODAY,
	source: 'CHAT',
	measuredAt: null,
	isDeleted: false,
	fromStart: -1.6,
	toGoal: 4.4,
	isGoalReached: false,
	weekChange: -0.4,
	planPaceKgPerWeek: 0.25,
	chart: [{ localDate: TODAY, value: 82.4 }],
	...overrides,
})

afterEach(() => {
	cleanup()
	useEditMeasurementStore.getState().close()
})

describe('MeasurementCard (chat feed)', () => {
	it('«Редагувати» opens the sheet with this card', () => {
		const card = createCard()
		renderWithProviders(<MeasurementCard card={card} today={TODAY} hasTail />)

		fireEvent.click(screen.getByRole('button', { name: 'Редагувати' }))

		expect(useEditMeasurementStore.getState().target).toEqual(card)
	})

	it('a deleted measurement is one line instead of the card', () => {
		renderWithProviders(
			<MeasurementCard card={createCard({ isDeleted: true })} today={TODAY} hasTail />,
		)

		expect(screen.getByText('Замір 82,4 кг за 18.10 видалено.')).toBeTruthy()
		expect(screen.queryByRole('button', { name: 'Редагувати' })).toBeNull()
		expect(screen.queryByText('Відкрити прогрес')).toBeNull()
	})
})
