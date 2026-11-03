// @vitest-environment jsdom
import { QueryClient } from '@tanstack/react-query'
import { act, cleanup, renderHook, waitFor } from '@testing-library/react'
import { AxiosError, AxiosHeaders, type AxiosResponse } from 'axios'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { LIVE_WORKOUT_QUERY_KEY, WORKOUTS_QUERY_KEY } from '@/entities/workout'
import { httpClient } from '@/shared/api'
import {
	createWrapper,
	LIVE_EDITED_AT,
	LIVE_WORKOUT_ID,
	makeLiveInput,
	makeLiveResponse,
} from '@/shared/testing'

import { useLiveWorkoutStore } from './live-workout-store'
import { useLiveSync } from './use-live-sync'

const putMock = vi.spyOn(httpClient, 'put')

const EDITED_2 = '2026-11-02T10:05:00.000Z'
const exercises = [makeLiveInput()]

const reply = (data: unknown): AxiosResponse => ({
	data: { data },
	status: 200,
	statusText: 'OK',
	headers: {},
	config: { headers: new AxiosHeaders() },
})

const networkError = (): AxiosError => new AxiosError('Network Error', AxiosError.ERR_NETWORK)

const conflict = (reason: 'EDITED' | 'FINISHED'): AxiosError => {
	const config = { headers: new AxiosHeaders() }
	return new AxiosError('conflict', AxiosError.ERR_BAD_RESPONSE, config, null, {
		status: 409,
		statusText: '409',
		headers: {},
		config,
		data: { statusCode: 409, errorCode: 'WORKOUT_LIVE_CONFLICT', details: { reason } },
	})
}

const renderSync = (queryClient = new QueryClient()) => {
	const view = renderHook(
		() => useLiveSync({ workoutId: LIVE_WORKOUT_ID, initialEditedAt: LIVE_EDITED_AT }),
		{ wrapper: createWrapper({ queryClient }) },
	)
	return { ...view, queryClient }
}

beforeEach(() => {
	useLiveWorkoutStore.setState({ snapshots: {} })
})

afterEach(() => {
	cleanup()
	vi.clearAllMocks()
	useLiveWorkoutStore.setState({ snapshots: {} })
})

describe('useLiveSync', () => {
	it('writes the snapshot to the persisted store before the answer and drops it after', async () => {
		let release: (value: AxiosResponse) => void = () => undefined
		putMock.mockReturnValue(new Promise((resolve) => (release = resolve)))
		const { result } = renderSync()

		act(() => {
			result.current.schedule(exercises)
		})

		expect(useLiveWorkoutStore.getState().snapshots[LIVE_WORKOUT_ID]).toEqual({
			exercises,
			knownEditedAt: LIVE_EDITED_AT,
		})
		expect(result.current.status).toBe('saving')
		const stored = JSON.parse(localStorage.getItem('kusik-live-workout') ?? '{}') as {
			state?: { snapshots?: unknown }
		}
		expect(stored.state?.snapshots).toHaveProperty(LIVE_WORKOUT_ID)

		act(() => {
			release(reply(makeLiveResponse({ editedAt: LIVE_EDITED_AT })))
		})

		await waitFor(() => {
			expect(result.current.status).toBe('idle')
		})
		expect(useLiveWorkoutStore.getState().snapshots[LIVE_WORKOUT_ID]).toBeUndefined()
	})

	it('the online event sends what waits for the connection', async () => {
		putMock
			.mockRejectedValueOnce(networkError())
			.mockResolvedValue(reply(makeLiveResponse({ editedAt: LIVE_EDITED_AT })))
		const { result } = renderSync()

		act(() => {
			result.current.schedule(exercises)
		})
		await waitFor(() => {
			expect(result.current.status).toBe('offline')
		})

		act(() => {
			window.dispatchEvent(new Event('online'))
		})

		await waitFor(() => {
			expect(result.current.status).toBe('idle')
		})
		expect(putMock).toHaveBeenCalledTimes(2)
	})

	it('stops listening to online after unmount', async () => {
		putMock.mockRejectedValue(networkError())
		const { result, unmount } = renderSync()
		act(() => {
			result.current.schedule(exercises)
		})
		await waitFor(() => {
			expect(result.current.status).toBe('offline')
		})
		unmount()

		window.dispatchEvent(new Event('online'))

		expect(putMock).toHaveBeenCalledTimes(1)
	})

	it('puts the answer of the server into the live cache', async () => {
		const answer = makeLiveResponse({ editedAt: LIVE_EDITED_AT, templateName: 'Верх А' })
		putMock.mockResolvedValue(reply(answer))
		const { result, queryClient } = renderSync()

		act(() => {
			result.current.schedule(exercises)
		})

		await waitFor(() => {
			expect(queryClient.getQueryData(LIVE_WORKOUT_QUERY_KEY)).toEqual(answer)
		})
	})

	it('409 FINISHED: closedByChat, the live cache is null, the workouts are invalidated', async () => {
		putMock.mockRejectedValue(conflict('FINISHED'))
		const queryClient = new QueryClient()
		queryClient.setQueryData(LIVE_WORKOUT_QUERY_KEY, makeLiveResponse())
		const invalidate = vi.spyOn(queryClient, 'invalidateQueries')
		const { result } = renderSync(queryClient)

		act(() => {
			result.current.schedule(exercises)
		})

		await waitFor(() => {
			expect(result.current.closedByChat).toBe(true)
		})
		expect(queryClient.getQueryData(LIVE_WORKOUT_QUERY_KEY)).toBeNull()
		expect(invalidate).toHaveBeenCalledWith({ queryKey: WORKOUTS_QUERY_KEY })
		expect(useLiveWorkoutStore.getState().snapshots[LIVE_WORKOUT_ID]).toBeUndefined()
	})

	it('409 EDITED: the re-read session lands in the cache and the local exercises go again', async () => {
		const fresh = makeLiveResponse({ editedAt: EDITED_2 })
		putMock
			.mockRejectedValueOnce(conflict('EDITED'))
			.mockResolvedValue(reply(makeLiveResponse({ editedAt: EDITED_2 })))
		const queryClient = new QueryClient()
		const { result } = renderSync(queryClient)
		// the re-read goes through the query client: it asks the API for the current session
		const getMock = vi.spyOn(httpClient, 'get').mockResolvedValue(reply(fresh))

		act(() => {
			result.current.schedule(exercises)
		})

		await waitFor(() => {
			expect(putMock).toHaveBeenCalledTimes(2)
		})
		expect(getMock).toHaveBeenCalledWith('/live-workouts/current')
		expect(putMock.mock.calls[1]?.[1]).toEqual({ knownEditedAt: EDITED_2, exercises })
		getMock.mockRestore()
	})

	it('sends a snapshot left in the store by a killed PWA as soon as the screen opens', async () => {
		useLiveWorkoutStore.getState().saveSnapshot(LIVE_WORKOUT_ID, {
			exercises,
			knownEditedAt: '2026-11-02T09:30:00.000Z',
		})
		putMock.mockResolvedValue(reply(makeLiveResponse({ editedAt: LIVE_EDITED_AT })))

		renderSync()

		await waitFor(() => {
			expect(putMock).toHaveBeenCalledTimes(1)
		})
		expect(putMock.mock.calls[0]?.[1]).toEqual({
			knownEditedAt: '2026-11-02T09:30:00.000Z',
			exercises,
		})
	})
})
