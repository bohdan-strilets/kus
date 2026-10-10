// @vitest-environment jsdom
import { QueryClient } from '@tanstack/react-query'
import { act, cleanup } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import { SESSION_QUERY_KEY } from '@/entities/session'
import { httpClient } from '@/shared/api'
import { apiErrorBody, createFakeAdapter, renderHookWithProviders } from '@/shared/testing'

import { useDeleteAccount } from './use-delete-account'

const originalAdapter = httpClient.defaults.adapter
const user = { id: 'user-1', email: 'me@kus.app', pendingDeletion: false, purgeAt: null }

const seedCache = (): QueryClient => {
	const queryClient = new QueryClient()
	queryClient.setQueryData(SESSION_QUERY_KEY, user)
	queryClient.setQueryData(['profile'], { email: 'me@kus.app' })
	return queryClient
}

const submitPassword = async (
	result: { current: ReturnType<typeof useDeleteAccount> },
	password: string,
): Promise<void> => {
	await act(async () => {
		result.current.form.setValue('password', password)
		await result.current.onSubmit()
	})
}

afterEach(() => {
	cleanup()
	httpClient.defaults.adapter = originalAdapter
})

describe('useDeleteAccount', () => {
	it('on success ends the session and drops the cached profile', async () => {
		const fake = createFakeAdapter(() => ({ status: 204 }))
		httpClient.defaults.adapter = fake.adapter
		const queryClient = seedCache()
		const { result } = renderHookWithProviders(() => useDeleteAccount(), { queryClient })

		await submitPassword(result, 'secret-password')

		expect(fake.calls).toEqual(['/account/delete'])
		expect(queryClient.getQueryData(SESSION_QUERY_KEY)).toBeNull()
		expect(queryClient.getQueryData(['profile'])).toBeUndefined()
	})

	it('a wrong password is an error on the password field and the session stays', async () => {
		httpClient.defaults.adapter = createFakeAdapter(() => ({
			status: 400,
			data: apiErrorBody(400, 'PASSWORD_INCORRECT'),
		})).adapter
		const queryClient = seedCache()
		const { result } = renderHookWithProviders(() => useDeleteAccount(), { queryClient })

		await submitPassword(result, 'wrong-password')

		expect(result.current.form.formState.errors.password?.message).toBe('Неправильний пароль.')
		expect(queryClient.getQueryData(SESSION_QUERY_KEY)).toEqual(user)
		expect(queryClient.getQueryData(['profile'])).toEqual({ email: 'me@kus.app' })
	})

	it('a network failure also stays on the field, session untouched', async () => {
		httpClient.defaults.adapter = createFakeAdapter(() => 'network').adapter
		const queryClient = seedCache()
		const { result } = renderHookWithProviders(() => useDeleteAccount(), { queryClient })

		await submitPassword(result, 'secret-password')

		expect(result.current.form.formState.errors.password).toBeDefined()
		expect(queryClient.getQueryData(SESSION_QUERY_KEY)).toEqual(user)
	})
})
