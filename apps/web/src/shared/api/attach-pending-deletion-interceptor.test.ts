import axios, { type AxiosInstance } from 'axios'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { apiErrorBody, createFakeAdapter, type FakeHandler } from '@/shared/testing'

import { attachPendingDeletionInterceptor } from './attach-pending-deletion-interceptor'

const PURGE_AT = '2026-11-08T10:00:00.000Z'

describe('attachPendingDeletionInterceptor', () => {
	let client: AxiosInstance
	const onPendingDeletion = vi.fn<(purgeAt: string | null) => void>()

	const useFakeApi = (handler: FakeHandler) => {
		client.defaults.adapter = createFakeAdapter(handler).adapter
	}

	beforeEach(() => {
		onPendingDeletion.mockClear()
		client = axios.create()
		attachPendingDeletionInterceptor(client, { onPendingDeletion })
	})

	it('reports a 403 ACCOUNT_PENDING_DELETION with purgeAt and still rejects', async () => {
		useFakeApi(() => ({
			status: 403,
			data: apiErrorBody(403, 'ACCOUNT_PENDING_DELETION', { purgeAt: PURGE_AT }),
		}))

		await expect(client.get('/entries')).rejects.toThrow()

		expect(onPendingDeletion).toHaveBeenCalledExactlyOnceWith(PURGE_AT)
	})

	it('reports null when the API sent no purgeAt', async () => {
		useFakeApi(() => ({ status: 403, data: apiErrorBody(403, 'ACCOUNT_PENDING_DELETION') }))

		await expect(client.get('/entries')).rejects.toThrow()

		expect(onPendingDeletion).toHaveBeenCalledExactlyOnceWith(null)
	})

	it('ignores a 403 with another code', async () => {
		useFakeApi(() => ({ status: 403, data: apiErrorBody(403, 'FORBIDDEN') }))

		await expect(client.get('/entries')).rejects.toThrow()

		expect(onPendingDeletion).not.toHaveBeenCalled()
	})

	it('ignores a 401', async () => {
		useFakeApi(() => ({ status: 401, data: apiErrorBody(401, 'UNAUTHORIZED') }))

		await expect(client.get('/entries')).rejects.toThrow()

		expect(onPendingDeletion).not.toHaveBeenCalled()
	})
})
