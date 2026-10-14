// @vitest-environment jsdom
import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react'
import { useState } from 'react'
import { afterEach, describe, expect, it } from 'vitest'

import { renderWithProviders } from '@/shared/testing'

import { MeasureInfoSheet } from './MeasureInfoSheet'

afterEach(cleanup)

const Harness = ({ startOpen }: { startOpen: boolean }) => {
	const [isOpen, setIsOpen] = useState(startOpen)
	return <MeasureInfoSheet isOpen={isOpen} onOpenChange={setIsOpen} />
}

describe('MeasureInfoSheet', () => {
	it('renders nothing while closed', () => {
		renderWithProviders(<Harness startOpen={false} />)

		expect(screen.queryByText('Як міряти талію')).toBeNull()
	})

	it('shows all three sections when opened', () => {
		renderWithProviders(<Harness startOpen />)

		expect(screen.getByText('Навіщо')).toBeTruthy()
		expect(screen.getByText('Як зважуватись')).toBeTruthy()
		expect(screen.getByText('Як міряти талію')).toBeTruthy()
	})

	it('shows an icon for each section', () => {
		const { baseElement } = renderWithProviders(<Harness startOpen />)

		const names = Array.from(baseElement.querySelectorAll('section [data-icon]')).map((el) =>
			el.getAttribute('data-icon'),
		)
		expect(names).toEqual(['info', 'scale', 'tape'])
	})

	it('closes with «Зрозуміло»', async () => {
		renderWithProviders(<Harness startOpen />)

		fireEvent.click(screen.getByRole('button', { name: 'Зрозуміло' }))

		await waitFor(() => {
			expect(screen.queryByText('Як міряти талію')).toBeNull()
		})
	})
})
