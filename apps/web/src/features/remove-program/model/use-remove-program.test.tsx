// @vitest-environment jsdom
import { QueryClient } from '@tanstack/react-query'
import { act, cleanup, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { activeProgramQueryOptions } from '@/entities/program'
import { httpClient } from '@/shared/api'
import {
	apiErrorBody,
	createFakeAdapter,
	type FakeHandler,
	makeProgram,
	renderHookWithProviders,
} from '@/shared/testing'

import { useRemoveProgram } from './use-remove-program'

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
	queryClient.setQueryData(activeProgramQueryOptions.queryKey, makeProgram())
	const invalidate = vi.spyOn(queryClient, 'invalidateQueries')
	const hook = renderHookWithProviders(() => useRemoveProgram(), { queryClient })
	const invalidatedKeys = () => invalidate.mock.calls.map(([filters]) => filters?.queryKey)
	return { ...hook, queryClient, invalidatedKeys, calls: fake.calls }
}

describe('useRemoveProgram', () => {
	it('turns the cached program into none at once and reads the feed again', async () => {
		const { result, queryClient, invalidatedKeys, calls } = setup(() => ({ status: 204 }))

		act(() => {
			result.current.mutate()
		})

		await waitFor(() => {
			expect(result.current.isSuccess).toBe(true)
		})
		expect(calls).toEqual(['/programs/active'])
		expect(queryClient.getQueryData(activeProgramQueryOptions.queryKey)).toBeNull()
		expect(invalidatedKeys()).toContainEqual(['messages'])
	})

	it('a failure keeps the cached program and reads it again', async () => {
		const { result, queryClient, invalidatedKeys } = setup(() => ({
			status: 404,
			data: apiErrorBody(404, 'PROGRAM_NOT_FOUND'),
		}))

		act(() => {
			result.current.mutate()
		})

		await waitFor(() => {
			expect(result.current.isError).toBe(true)
		})
		expect(queryClient.getQueryData(activeProgramQueryOptions.queryKey)).not.toBeNull()
		expect(invalidatedKeys()).toContainEqual(['program'])
		expect(invalidatedKeys()).not.toContainEqual(['messages'])
	})
})
