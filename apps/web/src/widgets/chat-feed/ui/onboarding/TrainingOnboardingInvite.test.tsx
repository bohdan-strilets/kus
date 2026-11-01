// @vitest-environment jsdom
import { QueryClient } from '@tanstack/react-query'
import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { httpClient } from '@/shared/api'
import {
	apiErrorBody,
	createFakeAdapter,
	type FakeHandler,
	makeChatMessage,
	renderWithProviders,
} from '@/shared/testing'

import { TrainingOnboardingInvite } from './TrainingOnboardingInvite'

const originalAdapter = httpClient.defaults.adapter

afterEach(() => {
	cleanup()
	httpClient.defaults.adapter = originalAdapter
	vi.restoreAllMocks()
})

const setup = (handler: FakeHandler) => {
	const fake = createFakeAdapter(handler)
	httpClient.defaults.adapter = fake.adapter
	const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
	const invalidate = vi.spyOn(queryClient, 'invalidateQueries')
	renderWithProviders(<TrainingOnboardingInvite />, { queryClient })
	const invalidatedKeys = () => invalidate.mock.calls.map(([filters]) => filters?.queryKey)
	return { calls: fake.calls, invalidatedKeys }
}

describe('TrainingOnboardingInvite', () => {
	it('«Так» starts the onboarding and nothing else', async () => {
		const { calls, invalidatedKeys } = setup(() => ({
			status: 200,
			data: { data: makeChatMessage() },
		}))

		fireEvent.click(screen.getByRole('button', { name: 'Так' }))

		await waitFor(() => {
			expect(invalidatedKeys()).toContainEqual(['messages'])
		})
		expect(calls).toEqual(['/programs/onboarding/start'])
	})

	it('«Пізніше» dismisses the invitation and nothing else', async () => {
		const { calls, invalidatedKeys } = setup(() => ({ status: 204 }))

		fireEvent.click(screen.getByRole('button', { name: 'Пізніше' }))

		await waitFor(() => {
			expect(invalidatedKeys()).toContainEqual(['messages'])
		})
		expect(calls).toEqual(['/programs/onboarding/dismiss'])
	})

	it('locks both buttons while one request runs', async () => {
		let release: (() => void) | undefined
		const gate = new Promise<void>((resolve) => {
			release = resolve
		})
		const { calls } = setup(async () => {
			await gate
			return { status: 204 }
		})

		fireEvent.click(screen.getByRole('button', { name: 'Пізніше' }))

		await waitFor(() => {
			expect(screen.getByRole('button', { name: 'Так' })).toHaveProperty('disabled', true)
		})
		fireEvent.click(screen.getByRole('button', { name: 'Так' }))
		release?.()

		await waitFor(() => {
			expect(calls).toEqual(['/programs/onboarding/dismiss'])
		})
	})

	it('toasts a closed question and reads the chat again', async () => {
		const { invalidatedKeys } = setup(() => ({
			status: 409,
			data: apiErrorBody(409, 'TRAINING_ONBOARDING_CLOSED'),
		}))

		fireEvent.click(screen.getByRole('button', { name: 'Так' }))

		expect(
			await screen.findByText('Це питання вже закрите — напиши, що хочеш змінити'),
		).toBeTruthy()
		expect(invalidatedKeys()).toContainEqual(['messages'])
	})

	it('toasts the generic sentence for an unknown failure', async () => {
		setup(() => ({ status: 500, data: apiErrorBody(500, 'INTERNAL') }))

		fireEvent.click(screen.getByRole('button', { name: 'Пізніше' }))

		expect(await screen.findByText('Не вийшло. Спробуй ще раз.')).toBeTruthy()
	})
})
