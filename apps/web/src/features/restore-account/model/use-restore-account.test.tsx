// @vitest-environment jsdom
import { QueryClient } from '@tanstack/react-query'
import { act, cleanup, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import { SESSION_QUERY_KEY } from '@/entities/session'
import { httpClient } from '@/shared/api'
import { ROUTES } from '@/shared/config'
import { apiErrorBody, createFakeAdapter, renderHookWithProviders } from '@/shared/testing'

import { useRestoreAccount } from './use-restore-account'

const originalAdapter = httpClient.defaults.adapter
const baseUser = {
	id: '0199a000-0000-7000-8000-000000000001',
	email: 'me@kus.app',
	name: 'Me',
	addressAs: null,
	locale: 'uk',
	timezone: 'Europe/Warsaw',
	createdAt: '2026-10-01T00:00:00.000Z',
}
const pendingUser = { ...baseUser, pendingDeletion: true, purgeAt: '2026-11-01T00:00:00.000Z' }
const restoredUser = { ...baseUser, pendingDeletion: false, purgeAt: null }
const ERROR_TEXT = 'Не вдалося відновити акаунт'

afterEach(() => {
	cleanup()
	httpClient.defaults.adapter = originalAdapter
})

describe('useRestoreAccount', () => {
	it('puts the restored user into the session cache and goes to the app', async () => {
		httpClient.defaults.adapter = createFakeAdapter(() => ({
			status: 200,
			data: { data: restoredUser },
		})).adapter
		const queryClient = new QueryClient()
		queryClient.setQueryData(SESSION_QUERY_KEY, pendingUser)
		const paths: string[] = []
		const { result } = renderHookWithProviders(() => useRestoreAccount(), {
			queryClient,
			route: '/restore',
			onPathname: (pathname) => paths.push(pathname),
		})

		act(() => {
			result.current.restore()
		})

		await waitFor(() => {
			expect(paths.at(-1)).toBe(ROUTES.chat)
		})
		expect(queryClient.getQueryData(SESSION_QUERY_KEY)).toMatchObject({
			pendingDeletion: false,
			purgeAt: null,
		})
	})

	it('a server error shows a toast and leaves the user pending, no navigation', async () => {
		httpClient.defaults.adapter = createFakeAdapter(() => ({
			status: 500,
			data: apiErrorBody(500, 'INTERNAL_ERROR'),
		})).adapter
		const queryClient = new QueryClient()
		queryClient.setQueryData(SESSION_QUERY_KEY, pendingUser)
		const paths: string[] = []
		const { result } = renderHookWithProviders(() => useRestoreAccount(), {
			queryClient,
			route: '/restore',
			onPathname: (pathname) => paths.push(pathname),
		})

		act(() => {
			result.current.restore()
		})

		expect(await screen.findByText(new RegExp(ERROR_TEXT))).toBeTruthy()
		expect(queryClient.getQueryData(SESSION_QUERY_KEY)).toEqual(pendingUser)
		expect(paths.at(-1)).toBe('/restore')
	})
})
