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

import { useUpdateProgramSettings } from './use-update-program-settings'

const TEMPLATE_ID = '0199b3a4-0000-7000-8000-0000000000c1'
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
	const hook = renderHookWithProviders(() => useUpdateProgramSettings(), { queryClient })
	const invalidatedKeys = () => invalidate.mock.calls.map(([filters]) => filters?.queryKey)
	return { ...hook, queryClient, invalidatedKeys, calls: fake.calls }
}

describe('useUpdateProgramSettings', () => {
	it('settings: the answered program replaces the cached one', async () => {
		const program = makeProgram({ mode: 'SINGLE', pinnedTemplateId: TEMPLATE_ID })
		const { result, queryClient, calls } = setup(() => ({ status: 200, data: { data: program } }))

		act(() => {
			result.current.updateSettings.mutate({ mode: 'SINGLE', pinnedTemplateId: TEMPLATE_ID })
		})

		await waitFor(() => {
			expect(result.current.updateSettings.isSuccess).toBe(true)
		})
		expect(calls).toEqual(['/programs/active'])
		expect(queryClient.getQueryData(activeProgramQueryOptions.queryKey)).toEqual(program)
	})

	it('weekdays: patches the template and caches the answered program', async () => {
		const program = makeProgram()
		const { result, queryClient, calls } = setup(() => ({ status: 200, data: { data: program } }))

		act(() => {
			result.current.updateWeekdays.mutate({ templateId: TEMPLATE_ID, weekdays: [1, 3] })
		})

		await waitFor(() => {
			expect(result.current.updateWeekdays.isSuccess).toBe(true)
		})
		expect(calls).toEqual([`/programs/active/templates/${TEMPLATE_ID}`])
		expect(queryClient.getQueryData(activeProgramQueryOptions.queryKey)).toEqual(program)
	})

	it('a failure reads the program again and keeps the cached one', async () => {
		const { result, queryClient, invalidatedKeys } = setup(() => ({
			status: 404,
			data: apiErrorBody(404, 'PROGRAM_NOT_FOUND'),
		}))
		const cached = makeProgram({ title: 'Стара' })
		queryClient.setQueryData(activeProgramQueryOptions.queryKey, cached)

		act(() => {
			result.current.updateSettings.mutate({ perWeek: 4 })
		})

		await waitFor(() => {
			expect(result.current.updateSettings.isError).toBe(true)
		})
		expect(queryClient.getQueryData(activeProgramQueryOptions.queryKey)).toEqual(cached)
		expect(invalidatedKeys()).toContainEqual(['program'])
	})

	it('a failed weekdays save reads the program again too', async () => {
		const { result, invalidatedKeys } = setup(() => 'network')

		act(() => {
			result.current.updateWeekdays.mutate({ templateId: TEMPLATE_ID, weekdays: [2] })
		})

		await waitFor(() => {
			expect(result.current.updateWeekdays.isError).toBe(true)
		})
		expect(invalidatedKeys()).toContainEqual(['program'])
	})
})
