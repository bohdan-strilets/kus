// @vitest-environment jsdom
import type { RecipeDetail } from '@kus/shared'
import { QueryClient } from '@tanstack/react-query'
import { cleanup, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { DAY_QUERY_KEY } from '@/entities/day'
import { RECIPES_QUERY_KEY } from '@/entities/recipe'
import { renderWithProviders } from '@/shared/testing'

import { logRecipePortion } from '../api/log-recipe-portion'
import { LogRecipePortion } from './LogRecipePortion'

vi.mock('../api/log-recipe-portion', () => ({ logRecipePortion: vi.fn() }))
vi.mock('@/shared/lib', async () => ({
	...(await vi.importActual<Record<string, unknown>>('@/shared/lib')),
	playSound: vi.fn(),
}))

const logMock = vi.mocked(logRecipePortion)
const values = { protein: 0, fat: 0, carbs: 0 }
const recipe: Pick<RecipeDetail, 'id' | 'portions'> = {
	id: '0199b3a4-0000-7000-8000-000000000001',
	portions: [
		{ share: 0.5, grams: 225, kcal: 270, ...values },
		{ share: 1, grams: 450, kcal: 540, ...values },
		{ share: 1.5, grams: 675, kcal: 810, ...values },
	],
}

const renderFeature = () => {
	const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
	const invalidate = vi.spyOn(queryClient, 'invalidateQueries')
	renderWithProviders(<LogRecipePortion recipe={recipe} />, { queryClient })
	return { invalidate }
}

const addButton = () => screen.getByRole('button', { name: 'Додати на сьогодні' })

beforeEach(() => {
	logMock.mockReset()
})

afterEach(() => {
	cleanup()
})

describe('LogRecipePortion', () => {
	it('shows the portions with server kcal and 1 selected by default', () => {
		renderFeature()

		const group = screen.getByRole('radiogroup', { name: 'Порція' })
		expect(group).toBeTruthy()
		expect(screen.getByRole('radio', { name: '½ · 270' }).getAttribute('aria-checked')).toBe(
			'false',
		)
		expect(screen.getByRole('radio', { name: '1 · 540' }).getAttribute('aria-checked')).toBe('true')
		expect(screen.getByRole('radio', { name: '1½ · 810' })).toBeTruthy()
	})

	it('sends the chosen share', async () => {
		logMock.mockResolvedValue({} as never)
		renderFeature()

		await userEvent.click(screen.getByRole('radio', { name: '1½ · 810' }))
		await userEvent.click(addButton())

		await waitFor(() => {
			expect(logMock.mock.calls[0]?.[0]).toEqual({ id: recipe.id, share: 1.5 })
		})
	})

	it('sends one request on a double tap while it is pending', async () => {
		logMock.mockReturnValue(new Promise(() => undefined))
		renderFeature()

		await userEvent.click(addButton())
		await waitFor(() => {
			expect(addButton().getAttribute('aria-busy')).toBe('true')
		})
		await userEvent.click(addButton())

		expect(logMock).toHaveBeenCalledTimes(1)
	})

	it('on success shows the toast and refreshes the day and the recipes', async () => {
		logMock.mockResolvedValue({} as never)
		const { invalidate } = renderFeature()

		await userEvent.click(addButton())

		await waitFor(() => {
			expect(screen.getByText('Додано на сьогодні')).toBeTruthy()
		})
		const keys = invalidate.mock.calls.map((call) => call[0]?.queryKey)
		expect(keys).toContainEqual(DAY_QUERY_KEY)
		expect(keys).toContainEqual(RECIPES_QUERY_KEY)
	})

	it('on failure shows the translated error and no success toast', async () => {
		logMock.mockRejectedValue(new Error('boom'))
		renderFeature()

		await userEvent.click(addButton())

		await waitFor(() => {
			expect(screen.getByText('Не вдалося. Спробуй ще раз.')).toBeTruthy()
		})
		expect(screen.queryByText('Додано на сьогодні')).toBeNull()
	})
})
