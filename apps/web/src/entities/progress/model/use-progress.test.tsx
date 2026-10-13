// @vitest-environment jsdom
import { QueryClient } from '@tanstack/react-query'
import { cleanup, renderHook, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { createWrapper, makeProgress, renderHookWithProviders } from '@/shared/testing'

import { getProgress } from '../api/get-progress'
import type { ProgressRange } from './progress.types'
import { useProgress } from './use-progress'

vi.mock('../api/get-progress', () => ({ getProgress: vi.fn() }))

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

	it('reports a failure', async () => {
		getProgressMock.mockRejectedValue(new Error('boom'))

		const { result } = renderHookWithProviders(() => useProgress(7))

		await waitFor(() => {
			expect(result.current.isError).toBe(true)
		})
		expect(result.current.data).toBeUndefined()
	})
})
