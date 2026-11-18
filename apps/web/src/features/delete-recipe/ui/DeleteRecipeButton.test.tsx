// @vitest-environment jsdom
import { QueryClient } from '@tanstack/react-query'
import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { RECIPES_QUERY_KEY, restoreRecipe } from '@/entities/recipe'
import { renderWithProviders } from '@/shared/testing'

import { deleteRecipe } from '../api/delete-recipe'
import { DeleteRecipeButton } from './DeleteRecipeButton'

vi.mock('../api/delete-recipe', () => ({ deleteRecipe: vi.fn() }))
vi.mock('@/entities/recipe', async () => ({
	...(await vi.importActual<Record<string, unknown>>('@/entities/recipe')),
	restoreRecipe: vi.fn(),
}))

const deleteMock = vi.mocked(deleteRecipe)
const restoreMock = vi.mocked(restoreRecipe)
const RECIPE_ID = '0199b3a4-0000-7000-8000-000000000001'

const renderButton = (onDeleted = vi.fn()) => {
	const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
	const invalidate = vi.spyOn(queryClient, 'invalidateQueries')
	renderWithProviders(<DeleteRecipeButton recipeId={RECIPE_ID} onDeleted={onDeleted} />, {
		queryClient,
	})
	return { invalidate, onDeleted }
}

const deleteButton = () => screen.getByRole('button', { name: 'Видалити рецепт' })

beforeEach(() => {
	deleteMock.mockReset()
	restoreMock.mockReset()
})

afterEach(() => {
	cleanup()
})

describe('DeleteRecipeButton', () => {
	it('deletes, refreshes the recipes, tells the page and offers an undo toast', async () => {
		deleteMock.mockResolvedValue(undefined)
		const { invalidate, onDeleted } = renderButton()

		await userEvent.click(deleteButton())

		await waitFor(() => {
			expect(screen.getByText('Рецепт видалено')).toBeTruthy()
		})
		expect(deleteMock.mock.calls[0]?.[0]).toBe(RECIPE_ID)
		expect(onDeleted).toHaveBeenCalledTimes(1)
		expect(invalidate.mock.calls.map((call) => call[0]?.queryKey)).toContainEqual(RECIPES_QUERY_KEY)
		expect(screen.getByRole('button', { name: 'Скасувати' })).toBeTruthy()
	})

	it('restores the recipe from «Скасувати»', async () => {
		deleteMock.mockResolvedValue(undefined)
		restoreMock.mockResolvedValue(undefined)
		const { invalidate } = renderButton()

		await userEvent.click(deleteButton())
		await screen.findByRole('button', { name: 'Скасувати' })
		invalidate.mockClear()
		fireEvent.click(screen.getByRole('button', { name: 'Скасувати' }))

		await waitFor(() => {
			expect(restoreMock.mock.calls[0]?.[0]).toBe(RECIPE_ID)
		})
		// the ['recipes'] prefix covers both the list and the detail queries
		await waitFor(() => {
			expect(invalidate.mock.calls.map((call) => call[0]?.queryKey)).toContainEqual(
				RECIPES_QUERY_KEY,
			)
		})
	})

	it('sends one request on a double tap', async () => {
		deleteMock.mockReturnValue(new Promise(() => undefined))
		renderButton()

		await userEvent.click(deleteButton())
		await userEvent.click(deleteButton())

		expect(deleteMock).toHaveBeenCalledTimes(1)
	})

	it('on a failed delete shows the error, stays on the page', async () => {
		deleteMock.mockRejectedValue(new Error('boom'))
		const { onDeleted } = renderButton()

		await userEvent.click(deleteButton())

		await waitFor(() => {
			expect(screen.getByText('Не вдалося. Спробуй ще раз.')).toBeTruthy()
		})
		expect(onDeleted).not.toHaveBeenCalled()
	})
})
