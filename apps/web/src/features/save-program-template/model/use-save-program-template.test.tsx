// @vitest-environment jsdom
import type { SaveTemplateRequest } from '@kus/shared'
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

import { useSaveProgramTemplate } from './use-save-program-template'

const originalAdapter = httpClient.defaults.adapter
const request = {
	baseVersionId: '0199b3a4-0000-7000-8000-0000000000a2',
	templateId: '0199b3a4-0000-7000-8000-0000000000c1',
	exercises: [],
} as unknown as SaveTemplateRequest

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
	const hook = renderHookWithProviders(() => useSaveProgramTemplate(), { queryClient })
	const invalidatedKeys = () => invalidate.mock.calls.map(([filters]) => filters?.queryKey)
	return { ...hook, queryClient, invalidatedKeys, calls: fake.calls }
}

describe('useSaveProgramTemplate', () => {
	it('caches the new version and reads the feed (its cards may be outdated now)', async () => {
		const program = makeProgram({ title: 'Нова версія' })
		const { result, queryClient, invalidatedKeys, calls } = setup(() => ({
			status: 200,
			data: { data: program },
		}))

		act(() => {
			result.current.mutate(request)
		})

		await waitFor(() => {
			expect(result.current.isSuccess).toBe(true)
		})
		expect(calls).toEqual(['/programs/active/versions'])
		expect(queryClient.getQueryData(activeProgramQueryOptions.queryKey)).toEqual(program)
		expect(invalidatedKeys()).toContainEqual(['messages'])
		expect(invalidatedKeys()).toContainEqual(['workouts', 'dictionary'])
	})

	it('a version conflict reads the program for the screen to merge, not the feed', async () => {
		const { result, queryClient, invalidatedKeys } = setup(() => ({
			status: 409,
			data: apiErrorBody(409, 'PROGRAM_VERSION_CONFLICT'),
		}))

		act(() => {
			result.current.mutate(request)
		})

		await waitFor(() => {
			expect(result.current.isError).toBe(true)
		})
		expect(queryClient.getQueryData(activeProgramQueryOptions.queryKey)).toBeUndefined()
		expect(invalidatedKeys()).toContainEqual(['program'])
		expect(invalidatedKeys()).not.toContainEqual(['messages'])
		expect(invalidatedKeys()).not.toContainEqual(['workouts', 'dictionary'])
	})
})
