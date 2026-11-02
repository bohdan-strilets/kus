// @vitest-environment jsdom
import type { WorkoutResponse } from '@kus/shared'
import { act, cleanup, waitFor } from '@testing-library/react'
import { AxiosHeaders, type AxiosResponse } from 'axios'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { httpClient } from '@/shared/api'
import { makeWorkout, renderHookWithProviders } from '@/shared/testing'

import { useTrainingWeek } from './use-training-week'

const getMock = vi.spyOn(httpClient, 'get')

// Monday: the journal reads from 2026-09-01, so the week of 31.08 is the first one it does not cover
const TODAY = '2026-10-26'
const OLD_WEEK_MONDAY = '2026-08-31'
const OLD_WEEK_SUNDAY = '2026-09-06'

const reply = (data: unknown): AxiosResponse => ({
	data: { data },
	status: 200,
	statusText: 'OK',
	headers: {},
	config: { headers: new AxiosHeaders() },
})

afterEach(() => {
	cleanup()
	vi.clearAllMocks()
})

const goBack = (weeks: number, result: { current: ReturnType<typeof useTrainingWeek> }): void => {
	for (let step = 0; step < weeks; step += 1) {
		act(() => {
			result.current.showPrevious()
		})
	}
}

describe('useTrainingWeek', () => {
	it('cuts the current week from the journal without a request and cannot go forward', () => {
		const journal = [makeWorkout({ localDate: TODAY })]

		const { result } = renderHookWithProviders(() => useTrainingWeek({ today: TODAY, journal }))

		expect(result.current.isCurrent).toBe(true)
		expect(result.current.summary?.count).toBe(1)
		expect(result.current.showNext).toBeNull()
		expect(getMock).not.toHaveBeenCalled()
	})

	it('has no summary while the journal loads', () => {
		const { result } = renderHookWithProviders(() =>
			useTrainingWeek({ today: TODAY, journal: undefined }),
		)

		expect(result.current.summary).toBeNull()
		expect(result.current.isError).toBe(false)
	})

	it('goes back through the weeks the journal covers without a request', () => {
		const journal = [makeWorkout({ localDate: '2026-09-07' })]
		const { result } = renderHookWithProviders(() => useTrainingWeek({ today: TODAY, journal }))

		goBack(7, result)

		expect(result.current.isCurrent).toBe(false)
		expect(result.current.summary?.weekStart).toBe('2026-09-07')
		expect(result.current.summary?.count).toBe(1)
		expect(getMock).not.toHaveBeenCalled()
	})

	it('asks for its own range when the week is older than the journal', async () => {
		const old: WorkoutResponse = makeWorkout({
			id: '0199b3a4-0000-7000-8000-0000000000f9',
			localDate: '2026-09-02',
		})
		getMock.mockResolvedValue(reply([old]))
		const { result } = renderHookWithProviders(() => useTrainingWeek({ today: TODAY, journal: [] }))

		goBack(8, result)

		expect(result.current.summary).toBeNull()
		await waitFor(() => {
			expect(result.current.summary?.count).toBe(1)
		})
		expect(getMock).toHaveBeenCalledTimes(1)
		expect(getMock).toHaveBeenCalledWith('/workouts', {
			params: { from: OLD_WEEK_MONDAY, to: OLD_WEEK_SUNDAY },
		})
		expect(result.current.summary?.weekStart).toBe(OLD_WEEK_MONDAY)
	})

	it('reports a failed read of an old week and does not blame a covered one', async () => {
		getMock.mockRejectedValue(new Error('network'))
		const { result } = renderHookWithProviders(() => useTrainingWeek({ today: TODAY, journal: [] }))

		goBack(8, result)

		await waitFor(() => {
			expect(result.current.isError).toBe(true)
		})
		expect(result.current.summary).toBeNull()
	})

	it('comes forward one week at a time and stops at the current week', () => {
		const { result } = renderHookWithProviders(() => useTrainingWeek({ today: TODAY, journal: [] }))

		goBack(2, result)
		expect(result.current.showNext).not.toBeNull()

		act(() => {
			result.current.showNext?.()
		})
		expect(result.current.isCurrent).toBe(false)
		expect(result.current.showNext).not.toBeNull()

		act(() => {
			result.current.showNext?.()
		})
		expect(result.current.isCurrent).toBe(true)
		expect(result.current.showNext).toBeNull()
	})
})
