// @vitest-environment jsdom
import { QueryClient } from '@tanstack/react-query'
import { act, cleanup, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { MESSAGES_QUERY_KEY } from '@/entities/message'
import type { ProfileFieldKey } from '@/entities/profile'
import { httpClient } from '@/shared/api'
import { apiErrorBody, createFakeAdapter, renderHookWithProviders } from '@/shared/testing'

import { useSaveProfileField } from './use-save-profile-field'

const originalAdapter = httpClient.defaults.adapter
const profile = {
	email: 'me@kus.app',
	name: null,
	addressAs: null,
	addressForm: 'NEUTRAL',
	profile: {
		sex: 'FEMALE',
		age: 30,
		heightCm: 170,
		activityLevel: 'MODERATE',
		targetWeightKg: null,
		goalType: 'MAINTAIN',
		paceKgPerWeek: null,
	},
	weight: { kg: 65, localDate: '2026-10-10' },
	waist: null,
	goals: null,
}

afterEach(() => {
	cleanup()
	httpClient.defaults.adapter = originalAdapter
	vi.restoreAllMocks()
})

const setup = (field: ProfileFieldKey, status = 200) => {
	httpClient.defaults.adapter = createFakeAdapter(() =>
		status === 200
			? { status, data: { data: profile } }
			: { status, data: apiErrorBody(status, 'INTERNAL_ERROR') },
	).adapter
	const queryClient = new QueryClient()
	const invalidate = vi.spyOn(queryClient, 'invalidateQueries')
	const onSaved = vi.fn()
	const hook = renderHookWithProviders(() => useSaveProfileField({ field, onSaved }), {
		queryClient,
	})
	const invalidatedKeys = () => invalidate.mock.calls.map(([filters]) => filters?.queryKey)
	return { ...hook, onSaved, invalidatedKeys }
}

describe('useSaveProfileField', () => {
	it('saving the weight refreshes the profile and the day', async () => {
		const { result, onSaved, invalidatedKeys } = setup('weightKg')

		act(() => {
			result.current.save(65)
		})

		await waitFor(() => {
			expect(onSaved).toHaveBeenCalledTimes(1)
		})
		expect(invalidatedKeys()).toContainEqual(['profile'])
		expect(invalidatedKeys()).toContainEqual(['day'])
	})

	it('saving the age refreshes only the profile', async () => {
		const { result, onSaved, invalidatedKeys } = setup('age')

		act(() => {
			result.current.save(30)
		})

		await waitFor(() => {
			expect(onSaved).toHaveBeenCalledTimes(1)
		})
		expect(invalidatedKeys()).toEqual([['profile']])
	})

	it('saving the waist refreshes the profile and the day (the progress screen)', async () => {
		const { result, onSaved, invalidatedKeys } = setup('waistCm')

		act(() => {
			result.current.save(82.4)
		})

		await waitFor(() => {
			expect(onSaved).toHaveBeenCalledTimes(1)
		})
		expect(invalidatedKeys()).toContainEqual(['profile'])
		expect(invalidatedKeys()).toContainEqual(['day'])
	})

	it.each(['weightKg', 'waistCm'] as const)(
		'saving %s also refreshes the messages (the chat card shows the new number)',
		async (field) => {
			const { result, onSaved, invalidatedKeys } = setup(field)

			act(() => {
				result.current.save(65)
			})

			await waitFor(() => {
				expect(onSaved).toHaveBeenCalledTimes(1)
			})
			expect(invalidatedKeys()).toContainEqual(MESSAGES_QUERY_KEY)
			expect(invalidatedKeys()).toContainEqual(['day'])
		},
	)

	it('saving the age does not refresh the messages', async () => {
		const { result, onSaved, invalidatedKeys } = setup('age')

		act(() => {
			result.current.save(30)
		})

		await waitFor(() => {
			expect(onSaved).toHaveBeenCalledTimes(1)
		})
		expect(invalidatedKeys()).not.toContainEqual(MESSAGES_QUERY_KEY)
	})

	it('a failure shows a toast, does not call onSaved and refreshes nothing', async () => {
		const { result, onSaved, invalidatedKeys } = setup('weightKg', 500)

		act(() => {
			result.current.save(65)
		})

		expect(await screen.findByText('Не вдалося зберегти. Спробуй ще раз.')).toBeTruthy()
		expect(onSaved).not.toHaveBeenCalled()
		expect(invalidatedKeys()).toEqual([])
	})
})
