// @vitest-environment jsdom
import { onlineManager, QueryClient } from '@tanstack/react-query'
import { act, waitFor } from '@testing-library/react'
import { AxiosError, AxiosHeaders } from 'axios'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { httpClient } from '@/shared/api'
import { renderHookWithProviders } from '@/shared/testing'

import { useSession } from './use-session'

const getMock = vi.spyOn(httpClient, 'get')

// the session check retries once with the default 1 s backoff before it gives up
const RETRY_WAIT_MS = 5000

const apiError = (status: number, errorCode: string): AxiosError => {
	const config = { headers: new AxiosHeaders() }
	return new AxiosError('failed', AxiosError.ERR_BAD_RESPONSE, config, null, {
		status,
		statusText: String(status),
		headers: {},
		config,
		data: { statusCode: status, errorCode, details: {} },
	})
}

const renderSession = () =>
	renderHookWithProviders(() => useSession(), { queryClient: new QueryClient() })

afterEach(() => {
	onlineManager.setOnline(true)
	vi.clearAllMocks()
})

describe('useSession: paused without a connection', () => {
	it('is an error with isNetworkError, not an endless pending, and goes on when the network is back', async () => {
		onlineManager.setOnline(false)
		getMock.mockResolvedValue({
			data: {
				data: {
					id: '0199a000-0000-7000-8000-000000000001',
					email: 'me@kus.app',
					name: 'Me',
					addressAs: null,
					addressForm: 'NEUTRAL',
					locale: 'uk',
					timezone: 'Europe/Warsaw',
					createdAt: '2026-10-01T00:00:00.000Z',
					pendingDeletion: false,
					purgeAt: null,
				},
			},
		})

		const { result } = renderSession()

		await waitFor(() => {
			expect(result.current.status).toBe('error')
		})
		expect(result.current.isNetworkError).toBe(true)
		expect(getMock).not.toHaveBeenCalled()

		act(() => {
			onlineManager.setOnline(true)
		})

		await waitFor(() => {
			expect(result.current.status).toBe('authenticated')
		})
		expect(result.current.isNetworkError).toBe(false)
	})
})

describe('useSession: isNetworkError', () => {
	it('is true when there was no answer at all (offline)', async () => {
		getMock.mockRejectedValue(new AxiosError('Network Error', AxiosError.ERR_NETWORK))

		const { result } = renderSession()

		await waitFor(
			() => {
				expect(result.current.status).toBe('error')
			},
			{ timeout: RETRY_WAIT_MS },
		)
		expect(result.current.isNetworkError).toBe(true)
	})

	it('is true for a proxy 5xx without our format (the API is unreachable)', async () => {
		getMock.mockRejectedValue(
			new AxiosError('Bad Gateway', AxiosError.ERR_BAD_RESPONSE, undefined, null, {
				status: 502,
				statusText: 'Bad Gateway',
				headers: {},
				config: { headers: new AxiosHeaders() },
				data: '<html>Bad Gateway</html>',
			}),
		)

		const { result } = renderSession()

		await waitFor(
			() => {
				expect(result.current.status).toBe('error')
			},
			{ timeout: RETRY_WAIT_MS },
		)
		expect(result.current.isNetworkError).toBe(true)
	})

	it('is false for a 5xx in the API format: the API answered, offline mode must not open', async () => {
		getMock.mockRejectedValue(apiError(500, 'INTERNAL_ERROR'))

		const { result } = renderSession()

		await waitFor(
			() => {
				expect(result.current.status).toBe('error')
			},
			{ timeout: RETRY_WAIT_MS },
		)
		expect(result.current.isNetworkError).toBe(false)
	})

	it('is false for a 403 in the API format', async () => {
		getMock.mockRejectedValue(apiError(403, 'FORBIDDEN'))

		const { result } = renderSession()

		await waitFor(() => {
			expect(result.current.status).toBe('error')
		})
		expect(result.current.isNetworkError).toBe(false)
	})

	it('a 401 is «not logged in», not an error, and never a network error', async () => {
		getMock.mockRejectedValue(apiError(401, 'UNAUTHORIZED'))

		const { result } = renderSession()

		await waitFor(() => {
			expect(result.current.status).toBe('anonymous')
		})
		expect(result.current.isNetworkError).toBe(false)
	})
})
