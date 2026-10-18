// @vitest-environment jsdom
import { QueryClient } from '@tanstack/react-query'
import { act, cleanup, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { httpClient } from '@/shared/api'
import {
	apiErrorBody,
	createFakeAdapter,
	type FakeHandler,
	renderHookWithProviders,
} from '@/shared/testing'

import { useMeasurementActions } from './use-measurement-actions'

const ID = '0199b3a4-0000-7000-8000-000000000001'
const originalAdapter = httpClient.defaults.adapter
const card = {
	id: ID,
	kind: 'WEIGHT',
	value: 81.9,
	localDate: '2026-10-18',
	source: 'EDIT',
	chart: [],
	fromStart: null,
	toGoal: null,
	isGoalReached: null,
	weekChange: null,
	planPaceKgPerWeek: null,
}

afterEach(() => {
	cleanup()
	httpClient.defaults.adapter = originalAdapter
	vi.restoreAllMocks()
})

const setup = (handler: FakeHandler) => {
	const fake = createFakeAdapter(handler)
	httpClient.defaults.adapter = fake.adapter
	const queryClient = new QueryClient()
	const invalidate = vi.spyOn(queryClient, 'invalidateQueries')
	const onGone = vi.fn()
	const hook = renderHookWithProviders(() => useMeasurementActions({ onGone }), { queryClient })
	const invalidatedKeys = () => invalidate.mock.calls.map(([filters]) => filters?.queryKey)
	return { ...hook, onGone, invalidatedKeys, calls: fake.calls }
}

describe('useMeasurementActions', () => {
	it('a saved value refreshes the chat, the day and the profile', async () => {
		const { result, invalidatedKeys } = setup(() => ({ status: 200, data: { data: card } }))
		const onSuccess = vi.fn()

		act(() => {
			result.current.save({ id: ID, value: 81.9 }, { onSuccess, onBound: vi.fn() })
		})

		await waitFor(() => {
			expect(onSuccess).toHaveBeenCalledTimes(1)
		})
		expect(invalidatedKeys()).toContainEqual(['messages'])
		expect(invalidatedKeys()).toContainEqual(['day'])
		expect(invalidatedKeys()).toContainEqual(['profile'])
	})

	it('a value out of range goes to the field, not to a toast', async () => {
		const { result } = setup(() => ({
			status: 422,
			data: apiErrorBody(422, 'VALIDATION_ERROR', { fields: { value: 'TOO_LARGE' } }),
		}))
		const onBound = vi.fn()

		act(() => {
			result.current.save({ id: ID, value: 999 }, { onSuccess: vi.fn(), onBound })
		})

		await waitFor(() => {
			expect(onBound).toHaveBeenCalledWith('TOO_LARGE')
		})
		expect(screen.queryByText('Не вдалося зберегти замір. Спробуй ще раз.')).toBeNull()
	})

	it('a delete offers «Повернути», and the toast button restores', async () => {
		const { result, calls } = setup(({ url }) =>
			url.endsWith('/restore') ? { status: 200, data: { data: card } } : { status: 204 },
		)
		const onSuccess = vi.fn()

		act(() => {
			result.current.remove(ID, onSuccess)
		})

		await waitFor(() => {
			expect(onSuccess).toHaveBeenCalledTimes(1)
		})
		expect(await screen.findByText('Замір видалено')).toBeTruthy()
		act(() => {
			screen.getByRole('button', { name: 'Повернути' }).click()
		})

		await waitFor(() => {
			expect(calls).toContain(`/measurements/${ID}/restore`)
		})
		expect(calls[0]).toBe(`/measurements/${ID}`)
	})

	it('a measurement that is already gone closes the sheet and says so', async () => {
		const { result, onGone } = setup(() => ({
			status: 404,
			data: apiErrorBody(404, 'MEASUREMENT_NOT_FOUND'),
		}))

		act(() => {
			result.current.remove(ID, vi.fn())
		})

		await waitFor(() => {
			expect(onGone).toHaveBeenCalledTimes(1)
		})
		expect(await screen.findByText('Цього заміру вже немає. Онови екран.')).toBeTruthy()
	})
})
