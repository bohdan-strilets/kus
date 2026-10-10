// @vitest-environment jsdom
import { QueryClient } from '@tanstack/react-query'
import { act, cleanup, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { httpClient } from '@/shared/api'
import { ROUTES } from '@/shared/config'
import { apiErrorBody, createFakeAdapter, renderHookWithProviders } from '@/shared/testing'

import { useSaveCalculatedGoals } from './use-save-calculated-goals'

vi.mock('@/shared/lib', async (importOriginal) => ({
	...(await importOriginal<Record<string, unknown>>()),
	playSound: vi.fn(),
}))

const originalAdapter = httpClient.defaults.adapter
const goals = {
	kcal: 2000,
	proteinG: 120,
	carbsG: 220,
	fatG: 60,
	source: 'CALCULATED',
	validFrom: '2026-10-10',
	updatedAt: '2026-10-10T08:00:00.000Z',
}
const START_ROUTE = '/app/profile/recalc'

afterEach(() => {
	cleanup()
	httpClient.defaults.adapter = originalAdapter
	vi.restoreAllMocks()
})

const setup = () => {
	const queryClient = new QueryClient()
	const invalidate = vi.spyOn(queryClient, 'invalidateQueries')
	const paths: string[] = []
	const hook = renderHookWithProviders(() => useSaveCalculatedGoals(), {
		queryClient,
		route: START_ROUTE,
		onPathname: (pathname) => paths.push(pathname),
	})
	return { ...hook, invalidate, paths }
}

describe('useSaveCalculatedGoals', () => {
	it('saves, refreshes the day and the profile, and goes back to the profile', async () => {
		const fake = createFakeAdapter(() => ({ status: 200, data: { data: goals } }))
		httpClient.defaults.adapter = fake.adapter
		const { result, invalidate, paths } = setup()

		act(() => {
			result.current.save()
		})

		await waitFor(() => {
			expect(paths.at(-1)).toBe(ROUTES.profile)
		})
		const keys = invalidate.mock.calls.map(([filters]) => filters?.queryKey)
		expect(keys).toContainEqual(['day'])
		expect(keys).toContainEqual(['profile'])
	})

	it('an incomplete profile (409) sends to «Мої дані» without refreshing', async () => {
		httpClient.defaults.adapter = createFakeAdapter(() => ({
			status: 409,
			data: apiErrorBody(409, 'PROFILE_INCOMPLETE'),
		})).adapter
		const { result, invalidate, paths } = setup()

		act(() => {
			result.current.save()
		})

		await waitFor(() => {
			expect(paths.at(-1)).toBe(ROUTES.profileData)
		})
		expect(invalidate).not.toHaveBeenCalled()
	})

	it('any other failure stays on the screen with a toast', async () => {
		httpClient.defaults.adapter = createFakeAdapter(() => ({
			status: 500,
			data: apiErrorBody(500, 'INTERNAL_ERROR'),
		})).adapter
		const { result, paths } = setup()

		act(() => {
			result.current.save()
		})

		expect(await screen.findByText('Не вдалося зберегти ціль. Спробуй ще раз.')).toBeTruthy()
		expect(paths.at(-1)).toBe(START_ROUTE)
	})
})
