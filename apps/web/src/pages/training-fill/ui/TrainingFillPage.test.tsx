// @vitest-environment jsdom
import type { AuthUser } from '@kus/shared'
import { QueryClient } from '@tanstack/react-query'
import { cleanup, screen, waitFor } from '@testing-library/react'
import { AxiosHeaders, type AxiosResponse } from 'axios'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { SESSION_QUERY_KEY } from '@/entities/session'
import { httpClient } from '@/shared/api'
import { getTrainingFillPath, ROUTES, TRAINING_FILL_ROUTE } from '@/shared/config'
import { makeProgram, makeTemplate, renderWithProviders, TEMPLATE_ID } from '@/shared/testing'

import { TrainingFillPage } from './TrainingFillPage'

const getMock = vi.spyOn(httpClient, 'get')

const user: AuthUser = {
	id: '0199b3a4-0000-7000-8000-00000000000a',
	email: 'user@example.com',
	name: null,
	addressAs: null,
	addressForm: 'NEUTRAL',
	locale: 'uk',
	timezone: 'Europe/Warsaw',
	createdAt: '2026-10-01T10:00:00.000Z',
	pendingDeletion: false,
	purgeAt: null,
}

const reply = (data: unknown): AxiosResponse => ({
	data: { data },
	status: 200,
	statusText: 'OK',
	headers: {},
	config: { headers: new AxiosHeaders() },
})

const renderPage = (route: string, onPathname?: (pathname: string) => void) => {
	const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
	queryClient.setQueryData(SESSION_QUERY_KEY, user)
	return renderWithProviders(<TrainingFillPage />, { route, queryClient, onPathname })
}

beforeEach(() => {
	// 19:30 in Warsaw (UTC+1 in November)
	vi.useFakeTimers({ toFake: ['Date'] })
	vi.setSystemTime(new Date('2026-11-02T18:30:00.000Z'))
	getMock.mockResolvedValue(reply(makeProgram({ templates: [makeTemplate()] })))
})

afterEach(() => {
	vi.useRealTimers()
	cleanup()
	vi.clearAllMocks()
})

describe('TrainingFillPage', () => {
	it("opens the form of the template from the query, today and now in the user's time zone", async () => {
		renderPage(getTrainingFillPath(TEMPLATE_ID))

		expect(await screen.findByText('Верх А')).toBeTruthy()
		expect(screen.getByText('Сьогодні · 18:35')).toBeTruthy()
		expect(screen.getByRole('button', { name: /^Жим лежачи/ })).toBeTruthy()
	})

	it('without a template id it is an empty session and does not ask for the program', async () => {
		renderPage(TRAINING_FILL_ROUTE)

		expect(await screen.findByText('Тренування')).toBeTruthy()
		expect(screen.queryByRole('button', { name: /^Жим лежачи/ })).toBeNull()
		expect(screen.getByText('Сьогодні · 19:30')).toBeTruthy()
	})

	it('a template that is not in the program leads back to the tab', async () => {
		const onPathname = vi.fn()
		renderPage(getTrainingFillPath('0199b3a4-0000-7000-8000-0000000000ff'), onPathname)

		await waitFor(() => {
			expect(onPathname).toHaveBeenLastCalledWith(ROUTES.training)
		})
	})

	it('no active program at all (null) also leads back to the tab', async () => {
		getMock.mockResolvedValue(reply(null))
		const onPathname = vi.fn()
		renderPage(getTrainingFillPath(TEMPLATE_ID), onPathname)

		await waitFor(() => {
			expect(onPathname).toHaveBeenLastCalledWith(ROUTES.training)
		})
	})

	it('a failed program request shows an inline error with a retry', async () => {
		getMock.mockRejectedValueOnce(new Error('boom'))
		renderPage(getTrainingFillPath(TEMPLATE_ID))

		expect(await screen.findByText('Не вдалося завантажити програму.')).toBeTruthy()
		expect(screen.getByRole('button', { name: 'Повторити' })).toBeTruthy()
	})
})
