// @vitest-environment jsdom
import { cleanup, fireEvent, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import { renderWithProviders } from '@/shared/testing'

import { KcalTile } from './KcalTile'

afterEach(cleanup)

const plain = (text: string | null | undefined): string => (text ?? '').replace(/\s/g, ' ')

describe('KcalTile', () => {
	it('says an estimate with «≈» and that it does not touch the goal', () => {
		const { container } = renderWithProviders(
			<KcalTile burned={{ kcal: 2100, isEstimate: true }} period="month" />,
		)

		expect(plain(container.textContent)).toContain('≈ 2 100 ккал')
		expect(screen.getByText('оцінка · на ціль не впливає')).toBeTruthy()
		expect(screen.getByText('Спалено на тренуваннях за місяць')).toBeTruthy()
	})

	it('says a fully named total without «≈»', () => {
		const { container } = renderWithProviders(
			<KcalTile burned={{ kcal: 1140, isEstimate: false }} period="week" />,
		)

		expect(plain(container.textContent)).toContain('1 140 ккал')
		expect(container.textContent).not.toContain('≈')
		expect(screen.getByText('на ціль не впливає')).toBeTruthy()
		expect(screen.queryByText(/оцінка/)).toBeNull()
		expect(screen.getByText('Спалено на тренуваннях за тиждень')).toBeTruthy()
	})

	it('opens the same sheet as the session by the info button', async () => {
		renderWithProviders(<KcalTile burned={{ kcal: 2100, isEstimate: true }} period="month" />)
		expect(screen.queryByRole('dialog')).toBeNull()

		fireEvent.click(screen.getByRole('button', { name: 'Ккал на тренуванні — як рахуємо' }))

		const sheet = await screen.findByRole('dialog', { name: 'Ккал на тренуванні' })
		expect(within(sheet).getByText('До цілі на день не додається')).toBeTruthy()
	})
})
