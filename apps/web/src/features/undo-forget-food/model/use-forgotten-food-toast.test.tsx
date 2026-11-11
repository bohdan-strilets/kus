// @vitest-environment jsdom
import { QueryClient } from '@tanstack/react-query'
import { act, cleanup, fireEvent, screen, waitFor } from '@testing-library/react'
import { MotionGlobalConfig } from 'motion/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { MY_FOODS_QUERY_KEY, restoreMyFood, useForgottenFoodsStore } from '@/entities/my-food'
import { renderHookWithProviders } from '@/shared/testing'

import { useForgottenFoodToast } from './use-forgotten-food-toast'

vi.mock('@/entities/my-food', async (importOriginal) => ({
	...(await importOriginal<Record<string, unknown>>()),
	restoreMyFood: vi.fn(),
}))

const bar = { id: '0199b3a4-0000-7000-8000-000000000001', name: 'Батончик Olimp' }
const skyr = { id: '0199b3a4-0000-7000-8000-000000000002', name: 'Скир' }

beforeEach(() => {
	MotionGlobalConfig.skipAnimations = true
	useForgottenFoodsStore.setState({ foods: [] })
	vi.mocked(restoreMyFood).mockReset()
})

afterEach(() => {
	MotionGlobalConfig.skipAnimations = false
	cleanup()
})

describe('useForgottenFoodToast', () => {
	it('shows nothing while no food was removed (also on a replayed turn)', () => {
		renderHookWithProviders(() => {
			useForgottenFoodToast()
		})
		act(() => {
			useForgottenFoodsStore.getState().announce([])
		})

		expect(screen.queryByText('Скасувати')).toBeNull()
	})

	it('names one removed food and restores it on «Скасувати»', async () => {
		vi.mocked(restoreMyFood).mockResolvedValue()
		const queryClient = new QueryClient()
		const invalidate = vi.spyOn(queryClient, 'invalidateQueries')
		renderHookWithProviders(
			() => {
				useForgottenFoodToast()
			},
			{ queryClient },
		)

		act(() => {
			useForgottenFoodsStore.getState().announce([bar])
		})
		expect(await screen.findByText("Прибрав «Батончик Olimp» з пам'яті")).not.toBeNull()
		fireEvent.click(screen.getByText('Скасувати'))

		await waitFor(() => {
			expect(restoreMyFood).toHaveBeenCalledWith(bar.id)
		})
		await waitFor(() => {
			expect(invalidate).toHaveBeenCalledWith({ queryKey: MY_FOODS_QUERY_KEY })
		})
		expect(useForgottenFoodsStore.getState().foods).toEqual([])
	})

	it('lists several foods in one toast and restores all of them', async () => {
		vi.mocked(restoreMyFood).mockResolvedValue()
		renderHookWithProviders(() => {
			useForgottenFoodToast()
		})

		act(() => {
			useForgottenFoodsStore.getState().announce([bar, skyr])
		})
		expect(await screen.findByText("Прибрав з пам'яті: Батончик Olimp, Скир")).not.toBeNull()
		fireEvent.click(screen.getByText('Скасувати'))

		await waitFor(() => {
			expect(restoreMyFood).toHaveBeenCalledTimes(2)
		})
	})

	it('says so when the food cannot be brought back', async () => {
		vi.mocked(restoreMyFood).mockRejectedValue(new Error('boom'))
		renderHookWithProviders(() => {
			useForgottenFoodToast()
		})

		act(() => {
			useForgottenFoodsStore.getState().announce([bar])
		})
		fireEvent.click(await screen.findByText('Скасувати'))

		expect(await screen.findByText('Не вдалося повернути продукт. Спробуй ще раз.')).not.toBeNull()
	})
})
