// @vitest-environment jsdom
import type { FoodEntryResponse, LoggedMeal } from '@kus/shared'
import { QueryClient } from '@tanstack/react-query'
import { act, cleanup, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { useGoalCelebrationStore } from '@/entities/stats'
import { useIsOverlayOpen } from '@/shared/lib'
import { renderHookWithProviders } from '@/shared/testing'

import { deleteFoodEntry } from '../api/delete-food-entry'
import { patchFoodEntry } from '../api/patch-food-entry'
import { useEditEntryForm } from './use-edit-entry-form'

vi.mock('../api/patch-food-entry', () => ({ patchFoodEntry: vi.fn() }))
vi.mock('../api/delete-food-entry', () => ({ deleteFoodEntry: vi.fn() }))

const patchMock = vi.mocked(patchFoodEntry)
const deleteMock = vi.mocked(deleteFoodEntry)
const onSettled = vi.fn()

// only what the hook reads
const entry = { id: 'entry-1', grams: 100, category: 'MEAT' } as unknown as FoodEntryResponse
const meal = { type: 'LUNCH' } as unknown as LoggedMeal

const renderForm = () => renderHookWithProviders(() => useEditEntryForm({ entry, meal, onSettled }))

const isArmed = (): boolean => useGoalCelebrationStore.getState().isArmed()

beforeEach(() => {
	patchMock.mockReset()
	deleteMock.mockReset()
	onSettled.mockReset()
	useGoalCelebrationStore.setState({ armed: null, pending: null, ownerId: null })
})

afterEach(cleanup)

describe('useEditEntryForm', () => {
	it('arms the goal detector (no message) after a saved change', async () => {
		patchMock.mockResolvedValue({} as FoodEntryResponse)
		const { result } = renderForm()

		await act(async () => {
			result.current.form.setValue('grams', '250')
			await result.current.onSubmit()
		})

		await waitFor(() => {
			expect(onSettled).toHaveBeenCalledTimes(1)
		})
		expect(patchMock.mock.calls[0]?.[0]).toEqual({ id: 'entry-1', grams: 250 })
		expect(isArmed()).toBe(true)
		expect(useGoalCelebrationStore.getState().armed?.messageId).toBeNull()
	})

	it('arms after a delete', async () => {
		deleteMock.mockResolvedValue(undefined)
		const { result } = renderForm()

		act(() => {
			result.current.remove()
		})

		await waitFor(() => {
			expect(onSettled).toHaveBeenCalledTimes(1)
		})
		expect(deleteMock.mock.calls[0]?.[0]).toBe('entry-1')
		expect(isArmed()).toBe(true)
	})

	it('does not arm when saving fails', async () => {
		patchMock.mockRejectedValue(new Error('boom'))
		const { result } = renderForm()

		await act(async () => {
			result.current.form.setValue('grams', '250')
			await result.current.onSubmit()
		})

		await waitFor(() => {
			expect(patchMock).toHaveBeenCalledTimes(1)
			expect(result.current.isSaving).toBe(false)
		})
		expect(isArmed()).toBe(false)
	})

	it('does not arm when deleting fails', async () => {
		deleteMock.mockRejectedValue(new Error('boom'))
		const { result } = renderForm()

		act(() => {
			result.current.remove()
		})

		await waitFor(() => {
			expect(deleteMock).toHaveBeenCalledTimes(1)
			expect(result.current.isDeleting).toBe(false)
		})
		expect(isArmed()).toBe(false)
	})

	it('does not arm when nothing changed: closes without a request', async () => {
		const { result } = renderForm()

		await act(async () => {
			await result.current.onSubmit()
		})

		expect(onSettled).toHaveBeenCalledTimes(1)
		expect(patchMock).not.toHaveBeenCalled()
		expect(isArmed()).toBe(false)
	})
	it('holds the feed through the delete and the refetch behind it', async () => {
		deleteMock.mockResolvedValue(undefined)
		const refetches: (() => void)[] = []
		const queryClient = new QueryClient()
		vi.spyOn(queryClient, 'invalidateQueries').mockImplementation(
			() =>
				new Promise<void>((resolve) => {
					refetches.push(resolve)
				}),
		)
		const { result } = renderHookWithProviders(
			() => ({
				form: useEditEntryForm({ entry, meal, onSettled }),
				isOverlayOpen: useIsOverlayOpen(),
			}),
			{ queryClient },
		)

		act(() => {
			result.current.form.remove()
		})
		await waitFor(() => {
			expect(onSettled).toHaveBeenCalledTimes(1)
		})
		// the request is done, the refetch is not: still held
		expect(result.current.isOverlayOpen).toBe(true)

		act(() => {
			refetches.forEach((finish) => {
				finish()
			})
		})
		await waitFor(() => {
			expect(result.current.isOverlayOpen).toBe(false)
		})
	})
})
