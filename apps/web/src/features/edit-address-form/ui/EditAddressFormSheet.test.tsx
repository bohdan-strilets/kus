// @vitest-environment jsdom
import type { AuthUser } from '@kus/shared'
import { cleanup, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { renderWithProviders } from '@/shared/testing'

import { patchMe } from '../api/patch-me'
import { EditAddressFormSheet } from './EditAddressFormSheet'

vi.mock('../api/patch-me', () => ({ patchMe: vi.fn() }))

const patchMock = vi.mocked(patchMe)
const onOpenChange = vi.fn()

const renderSheet = () =>
	renderWithProviders(<EditAddressFormSheet isOpen onOpenChange={onOpenChange} value="NEUTRAL" />)

beforeEach(() => {
	patchMock.mockReset()
	onOpenChange.mockReset()
})

afterEach(cleanup)

describe('EditAddressFormSheet', () => {
	it('shows the explanation and three cards with a Kusik phrase each, the saved one chosen', () => {
		renderSheet()

		expect(screen.getByText(/а не обходив слова на кшталт/)).toBeTruthy()
		expect(
			screen.getByText('Діє з наступної відповіді — минулі повідомлення не змінюються.'),
		).toBeTruthy()
		// the second half of the mockup's note is the designer's annotation, not a text for the user
		expect(screen.queryByText(/Kusik про себе/)).toBeNull()
		expect(screen.getAllByRole('radio')).toHaveLength(3)
		expect(screen.getByText('Записав. Ти вже ситий?')).toBeTruthy()
		expect(screen.getByText('Записав. Ти вже сита?')).toBeTruthy()
		expect(screen.getByText('Записав. Як настрій після обіду?')).toBeTruthy()
		expect(screen.getByText('за замовчуванням')).toBeTruthy()
		expect(screen.getByRole('radio', { name: /Нейтрально/ }).getAttribute('aria-checked')).toBe(
			'true',
		)
	})

	it('sends nothing until «Зберегти», then saves the chosen form and closes', async () => {
		patchMock.mockResolvedValue({ addressForm: 'FEMININE' } as AuthUser)
		renderSheet()

		await userEvent.click(screen.getByRole('radio', { name: /У жіночому роді/ }))
		expect(patchMock).not.toHaveBeenCalled()
		await userEvent.click(screen.getByRole('button', { name: 'Зберегти' }))

		await waitFor(() => {
			expect(patchMock.mock.calls[0]?.[0]).toEqual({ addressForm: 'FEMININE' })
		})
		await waitFor(() => {
			expect(onOpenChange).toHaveBeenCalledWith(false)
		})
	})

	it('keeps the sheet open and shows a toast when saving fails', async () => {
		patchMock.mockRejectedValue(new Error('boom'))
		renderSheet()

		await userEvent.click(screen.getByRole('button', { name: 'Зберегти' }))

		await waitFor(() => {
			expect(screen.getByText('Не вдалося зберегти. Спробуй ще раз.')).toBeTruthy()
		})
		expect(onOpenChange).not.toHaveBeenCalled()
	})
})
