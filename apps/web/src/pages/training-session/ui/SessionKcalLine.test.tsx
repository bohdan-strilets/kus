// @vitest-environment jsdom
import type { WorkoutKcal } from '@kus/shared'
import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import { makeWorkout, renderWithProviders } from '@/shared/testing'

import { SessionKcalLine } from './SessionKcalLine'

afterEach(cleanup)

const renderLine = (kcal: WorkoutKcal | null) =>
	renderWithProviders(<SessionKcalLine workout={makeWorkout({ kcal })} />)

describe('SessionKcalLine', () => {
	it('draws nothing without a number', () => {
		const { container } = renderLine(null)

		expect(container.textContent).toBe('')
		expect(screen.queryByRole('button')).toBeNull()
	})

	it('shows the estimate with the number in bold', () => {
		renderLine({ value: 350, source: 'ESTIMATE' })

		const button = screen.getByRole('button', {
			name: '≈ 350 ккал · оцінка. Ккал на тренуванні — як рахуємо',
		})
		expect(button.querySelector('b')?.textContent).toBe('≈ 350 ккал')
		expect(button.textContent).toBe('≈ 350 ккал · оцінка')
	})

	it.each([
		['MANUAL', 'зі слів'],
		['DEVICE', 'з табло'],
	] as const)('shows a %s number without «≈»', (source, label) => {
		renderLine({ value: 380, source })

		const button = screen.getByRole('button')
		expect(button.textContent).toBe(`380 ккал · ${label}`)
		expect(button.textContent).not.toContain('≈')
	})

	it('opens the sheet by the info button and closes it again', async () => {
		renderLine({ value: 350, source: 'ESTIMATE' })
		expect(screen.queryByRole('dialog')).toBeNull()

		fireEvent.click(screen.getByRole('button', { name: /Ккал на тренуванні — як рахуємо/ }))

		expect(await screen.findByRole('dialog', { name: 'Ккал на тренуванні' })).toBeTruthy()
		expect(screen.getByText('До цілі на день не додається')).toBeTruthy()
		fireEvent.click(screen.getByRole('button', { name: 'Зрозуміло' }))
		await waitFor(() => {
			expect(screen.queryByRole('dialog')).toBeNull()
		})
	})
})
