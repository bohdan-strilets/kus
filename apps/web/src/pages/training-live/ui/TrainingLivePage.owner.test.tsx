// @vitest-environment jsdom
import { QueryClient } from '@tanstack/react-query'
import { act, cleanup, screen } from '@testing-library/react'
import { AxiosHeaders, type AxiosResponse } from 'axios'
import { Route, Routes } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { useLiveWorkoutStore } from '@/features/live-workout'
import { httpClient } from '@/shared/api'
import { ROUTES, TRAINING_LIVE_ROUTE } from '@/shared/config'
import { makeLiveResponse, makePlanExercise, renderWithProviders } from '@/shared/testing'

import { TrainingLivePage } from './TrainingLivePage'

const getMock = vi.spyOn(httpClient, 'get')
const putMock = vi.spyOn(httpClient, 'put')

const OWNER_A = '0199b3a4-0000-7000-8000-00000000000a'
const OWNER_B = '0199b3a4-0000-7000-8000-00000000000b'

const reply = (data: unknown): AxiosResponse => ({
	data: { data },
	status: 200,
	statusText: 'OK',
	headers: {},
	config: { headers: new AxiosHeaders() },
})

const renderPage = () =>
	renderWithProviders(
		<Routes>
			<Route path={TRAINING_LIVE_ROUTE} element={<TrainingLivePage />} />
			<Route path={ROUTES.training} element={<p>TRAINING TAB</p>} />
		</Routes>,
		{
			route: TRAINING_LIVE_ROUTE,
			queryClient: new QueryClient({ defaultOptions: { queries: { retry: false } } }),
		},
	)

beforeEach(() => {
	localStorage.clear()
	useLiveWorkoutStore.setState({
		ownerId: OWNER_A,
		snapshots: {},
		lastSeen: makeLiveResponse({ plan: [makePlanExercise({ name: 'Жим лежачи' })] }),
	})
})

afterEach(() => {
	cleanup()
	vi.clearAllMocks()
})

describe('TrainingLivePage: the owner changes while the read is pending', () => {
	it('drops the previous owner session from the screen and sends nothing to its workout', async () => {
		getMock.mockReturnValue(new Promise(() => undefined))
		renderPage()
		expect(await screen.findByText('Жим лежачи')).toBeTruthy()

		act(() => {
			useLiveWorkoutStore.getState().claim(OWNER_B)
		})

		expect(screen.queryByText('Жим лежачи')).toBeNull()
		expect(useLiveWorkoutStore.getState().lastSeen).toBeNull()
		expect(putMock).not.toHaveBeenCalled()
	})

	it('the new owner with no open session leaves for the tab instead of the closed-by-chat card', async () => {
		let answer: (value: AxiosResponse) => void = () => undefined
		getMock.mockReturnValue(
			new Promise<AxiosResponse>((resolve) => {
				answer = resolve
			}),
		)
		renderPage()
		await screen.findByText('Жим лежачи')

		act(() => {
			useLiveWorkoutStore.getState().claim(OWNER_B)
		})
		await act(async () => {
			answer(reply(null))
			await Promise.resolve()
		})

		expect(await screen.findByText('TRAINING TAB')).toBeTruthy()
		expect(
			screen.queryByText('Це тренування вже завершено — підходи збережено, підсумок у чаті.'),
		).toBeNull()
		expect(putMock).not.toHaveBeenCalled()
	})
})
