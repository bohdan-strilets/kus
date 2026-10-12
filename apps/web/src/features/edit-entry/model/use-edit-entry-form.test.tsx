// @vitest-environment jsdom
import type { FoodEntryResponse, LoggedMeal } from '@kus/shared'
import { act, cleanup, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { useGoalCelebrationStore } from '@/entities/stats'
import { renderHookWithProviders } from '@/shared/testing'

import { deleteFoodEntry } from '../api/delete-food-entry'
import { patchFoodEntry } from '../api/patch-food-entry'
import { useEditEntryForm } from './use-edit-entry-form'

vi.mock('../api/patch-food-entry', () => ({ patchFoodEntry: vi.fn() }))
vi.mock('../api/delete-food-entry', () => ({ deleteFoodEntry: vi.fn() }))

const patchMock = vi.mocked(patchFoodEntry)
const deleteMock = vi.mocked(deleteFoodEntry)
const onDone = vi.fn()

// only what the hook reads
const entry = { id: 'entry-1', grams: 100, category: 'MEAT' } as unknown as FoodEntryResponse
const meal = { type: 'LUNCH' } as unknown as LoggedMeal

const renderForm = () => renderHookWithProviders(() => useEditEntryForm({ entry, meal, onDone }))

const isArmed = (): boolean => useGoalCelebrationStore.getState().isArmed()

beforeEach(() => {
	patchMock.mockReset()
	deleteMock.mockReset()
	onDone.mockReset()
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
			expect(onDone).toHaveBeenCalledTimes(1)
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
			expect(onDone).toHaveBeenCalledTimes(1)
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

		expect(onDone).toHaveBeenCalledTimes(1)
		expect(patchMock).not.toHaveBeenCalled()
		expect(isArmed()).toBe(false)
	})
})
