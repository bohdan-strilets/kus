// @vitest-environment jsdom
import { onlineManager } from '@tanstack/react-query'
import { act, cleanup, waitFor } from '@testing-library/react'
import { AxiosError, AxiosHeaders } from 'axios'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { httpClient } from '@/shared/api'
import { makeLiveResponse, renderHookWithProviders } from '@/shared/testing'

import { useMiniStripLive, useMiniStripOffline } from './use-mini-strip-live'

const getMock = vi.spyOn(httpClient, 'get')

const httpError = (status: number, data: unknown): AxiosError => {
	const config = { headers: new AxiosHeaders() }
	return new AxiosError('failed', AxiosError.ERR_BAD_RESPONSE, config, null, {
		status,
		statusText: String(status),
		headers: {},
		config,
		data,
	})
}

afterEach(() => {
	onlineManager.setOnline(true)
	cleanup()
	vi.clearAllMocks()
})

describe('useMiniStripOffline', () => {
	it('is false online with a successful live query', async () => {
		getMock.mockResolvedValue({ data: { data: makeLiveResponse() } })
		const { result } = renderHookWithProviders(() => ({
			live: useMiniStripLive(),
			isOffline: useMiniStripOffline(),
		}))

		await waitFor(() => {
			expect(result.current.live).not.toBeNull()
		})
		expect(result.current.isOffline).toBe(false)
	})

	it('follows the online manager both ways on rerender', async () => {
		getMock.mockResolvedValue({ data: { data: makeLiveResponse() } })
		const { result, rerender } = renderHookWithProviders(() => useMiniStripOffline())
		await waitFor(() => {
			expect(getMock).toHaveBeenCalled()
		})

		act(() => {
			onlineManager.setOnline(false)
		})
		rerender()
		expect(result.current).toBe(true)

		act(() => {
			onlineManager.setOnline(true)
		})
		rerender()
		expect(result.current).toBe(false)
	})

	it('is true when the live query failed with a network error', async () => {
		getMock.mockRejectedValue(new AxiosError('Network Error', AxiosError.ERR_NETWORK))
		const { result } = renderHookWithProviders(() => useMiniStripOffline())

		await waitFor(() => {
			expect(result.current).toBe(true)
		})
	})

	it.each([
		[500, { statusCode: 500, errorCode: 'INTERNAL_ERROR', details: {} }],
		[404, { statusCode: 404, errorCode: 'ENTRY_NOT_FOUND', details: {} }],
	])('stays false when the API answered with %i', async (status, body) => {
		getMock.mockRejectedValue(httpError(status, body))
		const { result } = renderHookWithProviders(() => useMiniStripOffline())

		await waitFor(() => {
			expect(getMock).toHaveBeenCalled()
		})
		await act(async () => {
			await Promise.resolve()
		})

		expect(result.current).toBe(false)
	})
})
