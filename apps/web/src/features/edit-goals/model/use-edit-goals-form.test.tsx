// @vitest-environment jsdom
import { QueryClient } from '@tanstack/react-query'
import { act, cleanup, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { httpClient } from '@/shared/api'
import { apiErrorBody, createFakeAdapter, renderHookWithProviders } from '@/shared/testing'

import { useEditGoalsForm } from './use-edit-goals-form'

const originalAdapter = httpClient.defaults.adapter
const goals = {
	kcal: 2000,
	proteinG: 120,
	carbsG: 220,
	fatG: 60,
	source: 'MANUAL',
	validFrom: '2026-10-10',
	updatedAt: '2026-10-10T08:00:00.000Z',
}
const currentGoal = { kcal: 2000, protein: 120, carbs: 220, fat: 60 }

afterEach(() => {
	cleanup()
	httpClient.defaults.adapter = originalAdapter
	vi.restoreAllMocks()
})

const setup = () => {
	const queryClient = new QueryClient()
	const invalidate = vi.spyOn(queryClient, 'invalidateQueries')
	const onSaved = vi.fn()
	const hook = renderHookWithProviders(
		() => useEditGoalsForm({ goal: currentGoal, isOpen: false, onSaved }),
		{ queryClient },
	)
	return { ...hook, invalidate, onSaved }
}

describe('useEditGoalsForm', () => {
	it('manual save sends the typed numbers, refreshes day and profile, then calls onSaved', async () => {
		const bodies: unknown[] = []
		httpClient.defaults.adapter = createFakeAdapter(() => ({
			status: 200,
			data: { data: goals },
		})).adapter
		const inner = httpClient.defaults.adapter
		httpClient.defaults.adapter = (config) => {
			bodies.push(JSON.parse(String(config.data)))
			return (inner as NonNullable<typeof inner> & ((c: typeof config) => Promise<never>))(config)
		}
		const { result, invalidate, onSaved } = setup()

		await act(async () => {
			await result.current.onSubmit()
		})

		await waitFor(() => {
			expect(onSaved).toHaveBeenCalledTimes(1)
		})
		expect(bodies).toEqual([{ source: 'manual', kcal: 2000, proteinG: 120, carbsG: 220, fatG: 60 }])
		const keys = invalidate.mock.calls.map(([filters]) => filters?.queryKey)
		expect(keys).toContainEqual(['day'])
		expect(keys).toContainEqual(['profile'])
	})

	it('restoreCalculated sends only { source: "calculated" }', async () => {
		const bodies: unknown[] = []
		httpClient.defaults.adapter = async (config) => {
			bodies.push(JSON.parse(String(config.data)))
			return Promise.resolve({
				data: { data: goals },
				status: 200,
				statusText: '200',
				headers: {},
				config,
			})
		}
		const { result, onSaved } = setup()

		act(() => {
			result.current.restoreCalculated()
		})

		await waitFor(() => {
			expect(onSaved).toHaveBeenCalledTimes(1)
		})
		expect(bodies).toEqual([{ source: 'calculated' }])
	})

	it('a failed save does not call onSaved', async () => {
		httpClient.defaults.adapter = createFakeAdapter(() => ({
			status: 500,
			data: apiErrorBody(500, 'INTERNAL_ERROR'),
		})).adapter
		const { result, onSaved } = setup()

		await act(async () => {
			await result.current.onSubmit()
		})
		await waitFor(() => {
			expect(result.current.isSaving).toBe(false)
		})

		expect(onSaved).not.toHaveBeenCalled()
	})
})
