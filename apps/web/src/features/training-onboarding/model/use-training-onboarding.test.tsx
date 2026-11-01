// @vitest-environment jsdom
import { QueryClient } from '@tanstack/react-query'
import { act, cleanup, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { httpClient } from '@/shared/api'
import {
	apiErrorBody,
	createFakeAdapter,
	type FakeHandler,
	makeChatMessage,
	renderHookWithProviders,
} from '@/shared/testing'

import { useTrainingOnboarding } from './use-training-onboarding'

const originalAdapter = httpClient.defaults.adapter

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
	const hook = renderHookWithProviders(() => useTrainingOnboarding(), { queryClient })
	const invalidatedKeys = () => invalidate.mock.calls.map(([filters]) => filters?.queryKey)
	return { ...hook, invalidatedKeys, calls: fake.calls }
}

describe('useTrainingOnboarding', () => {
	it('start: asks for the first question and reads the feed and the profile again', async () => {
		const { result, invalidatedKeys, calls } = setup(() => ({
			status: 200,
			data: { data: makeChatMessage() },
		}))

		act(() => {
			result.current.start.mutate()
		})

		await waitFor(() => {
			expect(result.current.start.isSuccess).toBe(true)
		})
		expect(calls).toEqual(['/programs/onboarding/start'])
		expect(invalidatedKeys()).toContainEqual(['messages'])
		expect(invalidatedKeys()).toContainEqual(['profile'])
	})

	it('dismiss: closes the invitation and reads the feed and the profile again', async () => {
		const { result, invalidatedKeys, calls } = setup(() => ({ status: 204 }))

		act(() => {
			result.current.dismiss.mutate()
		})

		await waitFor(() => {
			expect(result.current.dismiss.isSuccess).toBe(true)
		})
		expect(calls).toEqual(['/programs/onboarding/dismiss'])
		expect(invalidatedKeys()).toContainEqual(['messages'])
		expect(invalidatedKeys()).toContainEqual(['profile'])
	})

	it('start on a closed question still reads the feed and the profile again', async () => {
		const { result, invalidatedKeys } = setup(() => ({
			status: 409,
			data: apiErrorBody(409, 'TRAINING_ONBOARDING_CLOSED'),
		}))

		act(() => {
			result.current.start.mutate()
		})

		await waitFor(() => {
			expect(result.current.start.isError).toBe(true)
		})
		expect(invalidatedKeys()).toContainEqual(['messages'])
		expect(invalidatedKeys()).toContainEqual(['profile'])
	})

	it('a failed dismiss reads them again too', async () => {
		const { result, invalidatedKeys } = setup(() => 'network')

		act(() => {
			result.current.dismiss.mutate()
		})

		await waitFor(() => {
			expect(result.current.dismiss.isError).toBe(true)
		})
		expect(invalidatedKeys()).toContainEqual(['messages'])
		expect(invalidatedKeys()).toContainEqual(['profile'])
	})
})
