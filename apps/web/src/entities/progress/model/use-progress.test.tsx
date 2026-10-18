// @vitest-environment jsdom
import { QueryClient } from '@tanstack/react-query'
import type { AuthUser } from '@kus/shared'
import { act, cleanup, renderHook, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { SESSION_QUERY_KEY } from '@/entities/session'
import { createWrapper, makeProgress, renderHookWithProviders } from '@/shared/testing'

import { getProgress } from '../api/get-progress'
import { PROGRESS_QUERY_KEY, progressQueryOptions } from './progress-query'
import type { ProgressRange } from './progress.types'
import { useProgress } from './use-progress'

vi.mock('../api/get-progress', () => ({ getProgress: vi.fn() }))

const MINUTE_MS = 60_000
/** watch-day-goal reads only ['day', <date>] keys, i.e. of this length. */
const DAY_KEY_LENGTH = 2

const getProgressMock = vi.mocked(getProgress)

afterEach(() => {
	cleanup()
	vi.clearAllMocks()
})

describe('useProgress', () => {
	it('asks for the chosen range and returns the response', async () => {
		getProgressMock.mockResolvedValue(makeProgress({ range: 90 }))

		const { result } = renderHookWithProviders(() => useProgress(90))

		await waitFor(() => {
			expect(result.current.data?.range).toBe(90)
		})
		expect(getProgressMock).toHaveBeenCalledWith(90)
	})

	it('keeps the previous numbers while another range loads', async () => {
		const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
		getProgressMock.mockResolvedValueOnce(makeProgress({ range: 30 }))
		const { result, rerender } = renderHook(
			({ range }: { range: ProgressRange }) => useProgress(range),
			{ wrapper: createWrapper({ queryClient }), initialProps: { range: 30 } },
		)
		await waitFor(() => {
			expect(result.current.data?.range).toBe(30)
		})

		getProgressMock.mockReturnValueOnce(new Promise(() => undefined))
		rerender({ range: 7 })

		expect(result.current.data?.range).toBe(30)
		expect(result.current.isPlaceholderData).toBe(true)
		expect(getProgressMock).toHaveBeenLastCalledWith(7)
	})

	describe('at midnight', () => {
		const user: AuthUser = {
			id: '0199b3a4-0000-7000-8000-00000000000a',
			email: 'user@example.com',
			name: null,
			addressAs: null,
			locale: 'uk',
			timezone: 'Europe/Warsaw',
			createdAt: '2026-10-01T10:00:00.000Z',
			pendingDeletion: false,
			purgeAt: null,
		}

		afterEach(() => {
			vi.useRealTimers()
		})

		it('keys the cache by today and asks again when the day changes', () => {
			vi.useFakeTimers()
			// 23:59:30 in Warsaw (UTC+2) on 12 October
			vi.setSystemTime(new Date('2026-10-12T21:59:30.000Z'))
			const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
			queryClient.setQueryData(SESSION_QUERY_KEY, user)
			getProgressMock.mockResolvedValue(makeProgress({ range: 7 }))

			renderHook(() => useProgress(7), { wrapper: createWrapper({ queryClient }) })

			expect(queryClient.getQueryState([...PROGRESS_QUERY_KEY, 7, '2026-10-12'])).toBeDefined()
			expect(getProgressMock).toHaveBeenCalledTimes(1)

			act(() => {
				vi.advanceTimersByTime(MINUTE_MS)
			})

			expect(queryClient.getQueryState([...PROGRESS_QUERY_KEY, 7, '2026-10-13'])).toBeDefined()
			expect(getProgressMock).toHaveBeenCalledTimes(2)
		})

		it('is not taken for a single day by watch-day-goal, whatever the date in its key', () => {
			const { queryKey } = progressQueryOptions(7, '2026-10-12')

			expect(queryKey.length).not.toBe(DAY_KEY_LENGTH)
		})
	})

	it('reports a failure', async () => {
		getProgressMock.mockRejectedValue(new Error('boom'))

		const { result } = renderHookWithProviders(() => useProgress(7))

		await waitFor(() => {
			expect(result.current.isError).toBe(true)
		})
		expect(result.current.data).toBeUndefined()
	})
})
