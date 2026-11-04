// @vitest-environment jsdom
import type { LiveWorkoutResponse } from '@kus/shared'
import { onlineManager, QueryClient } from '@tanstack/react-query'
import { act, cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react'
import { AxiosError, AxiosHeaders, type AxiosResponse } from 'axios'
import { Route, Routes } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { LIVE_WORKOUT_QUERY_KEY } from '@/entities/workout'
import { useLiveWorkoutStore } from '@/features/live-workout'
import { httpClient } from '@/shared/api'
import { ROUTES, TRAINING_LIVE_ROUTE } from '@/shared/config'
import {
	makeLiveResponse,
	makePlanExercise,
	makeWorkout,
	renderWithProviders,
} from '@/shared/testing'
import { ToastRouteReset } from '@/shared/ui'

import { TrainingLivePage } from './TrainingLivePage'

const getMock = vi.spyOn(httpClient, 'get')
const postMock = vi.spyOn(httpClient, 'post')
const deleteMock = vi.spyOn(httpClient, 'delete')

const OWNER = '0199b3a4-0000-7000-8000-00000000000a'
const WORKOUT_ID = '0199b3a4-0000-7000-8000-0000000000f1'
const MESSAGE_ID = '0199b3a4-0000-7000-8000-0000000000aa'

const reply = (data: unknown): AxiosResponse => ({
	data: { data },
	status: 200,
	statusText: 'OK',
	headers: {},
	config: { headers: new AxiosHeaders() },
})

const networkError = (): AxiosError => new AxiosError('Network Error', AxiosError.ERR_NETWORK)

const seen = (templateName: string): LiveWorkoutResponse =>
	makeLiveResponse({ templateName, plan: [makePlanExercise({ name: 'Жим лежачи' })] })

const keepLastSeen = (live: LiveWorkoutResponse | null): void => {
	useLiveWorkoutStore.setState({ ownerId: OWNER, snapshots: {}, lastSeen: live })
}

const renderPage = (onPathname?: (pathname: string) => void) => {
	const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
	const view = renderWithProviders(
		<>
			<ToastRouteReset />
			<Routes>
				<Route path={TRAINING_LIVE_ROUTE} element={<TrainingLivePage />} />
				<Route path={ROUTES.training} element={<p>TRAINING TAB</p>} />
			</Routes>
		</>,
		{ route: TRAINING_LIVE_ROUTE, queryClient, onPathname },
	)
	return { ...view, queryClient }
}

beforeEach(() => {
	useLiveWorkoutStore.setState({ ownerId: null, snapshots: {}, lastSeen: null })
	localStorage.clear()
})

afterEach(() => {
	onlineManager.setOnline(true)
	cleanup()
	vi.clearAllMocks()
})

describe('TrainingLivePage: offline start from lastSeen', () => {
	it('shows the last seen session when the read fails for lack of network', async () => {
		keepLastSeen(seen('Верх А'))
		getMock.mockRejectedValue(networkError())
		renderPage()

		expect(await screen.findByText('Жим лежачи')).toBeTruthy()
		expect(screen.getByText('Верх А')).toBeTruthy()
	})

	it('shows the last seen session while the read waits for the network (paused)', async () => {
		onlineManager.setOnline(false)
		keepLastSeen(seen('Верх А'))
		getMock.mockReturnValue(new Promise(() => undefined))
		renderPage()

		expect(await screen.findByText('Жим лежачи')).toBeTruthy()
	})

	it('without lastSeen a failed read stays the error with «retry»', async () => {
		getMock.mockRejectedValue(networkError())
		renderPage()

		expect(await screen.findByText('Не вдалося завантажити тренування.')).toBeTruthy()
		expect(screen.queryByText('Жим лежачи')).toBeNull()
	})

	it('an online 5xx answer does not put lastSeen on the screen: it stays the error with «retry»', async () => {
		keepLastSeen(seen('Верх А'))
		const config = { headers: new AxiosHeaders() }
		getMock.mockRejectedValue(
			new AxiosError('failed', AxiosError.ERR_BAD_RESPONSE, config, null, {
				status: 500,
				statusText: '500',
				headers: {},
				config,
				data: { statusCode: 500, errorCode: 'INTERNAL_ERROR', details: {} },
			}),
		)
		renderPage()

		expect(await screen.findByText('Не вдалося завантажити тренування.')).toBeTruthy()
		expect(screen.queryByText('Жим лежачи')).toBeNull()
	})

	it('an online load in progress does not put lastSeen on the screen', async () => {
		keepLastSeen(seen('Верх А'))
		getMock.mockReturnValue(new Promise(() => undefined))
		renderPage()

		await act(async () => {
			await Promise.resolve()
		})

		expect(screen.queryByText('Жим лежачи')).toBeNull()
		expect(screen.queryByText('Верх А')).toBeNull()
	})

	it('an online answer wins over lastSeen', async () => {
		keepLastSeen(seen('Верх А'))
		getMock.mockResolvedValue(
			reply(
				makeLiveResponse({
					templateName: 'Низ Б',
					plan: [makePlanExercise({ name: 'Присідання' })],
				}),
			),
		)
		renderPage()

		expect(await screen.findByText('Присідання')).toBeTruthy()
		expect(screen.queryByText('Жим лежачи')).toBeNull()
	})

	it('an online «no open session» (null) leaves for the tab, lastSeen is not shown', async () => {
		keepLastSeen(seen('Верх А'))
		getMock.mockResolvedValue(reply(null))
		renderPage()

		expect(await screen.findByText('TRAINING TAB')).toBeTruthy()
		expect(screen.queryByText('Жим лежачи')).toBeNull()
	})

	it('the session closed in the chat after an offline start shows the closed card and drops lastSeen', async () => {
		keepLastSeen(seen('Верх А'))
		getMock.mockRejectedValue(networkError())
		const { queryClient } = renderPage()
		await screen.findByText('Жим лежачи')

		act(() => {
			queryClient.setQueryData(LIVE_WORKOUT_QUERY_KEY, null)
		})

		expect(await screen.findByText('Це тренування вже закрите в чаті.')).toBeTruthy()
		await waitFor(() => {
			expect(useLiveWorkoutStore.getState().lastSeen).toBeNull()
		})
	})
})

describe('useLiveExit: leaving and clearing lastSeen', () => {
	const WORK_DONE = (): LiveWorkoutResponse => ({
		...seen('Верх А'),
		workout: makeWorkout({ id: WORKOUT_ID, source: 'LIVE' }),
	})

	it('«Нічого не записано» is still on screen after the navigation to the tab, and lastSeen is gone', async () => {
		keepLastSeen(WORK_DONE())
		getMock.mockResolvedValue(reply(WORK_DONE()))
		postMock.mockResolvedValue(reply({ discarded: true }))
		const onPathname = vi.fn()
		renderPage(onPathname)

		fireEvent.click(await screen.findByRole('button', { name: 'Завершити' }))

		expect(await screen.findByText('TRAINING TAB')).toBeTruthy()
		await waitFor(() => {
			expect(onPathname).toHaveBeenLastCalledWith(ROUTES.training)
		})
		expect(screen.getByText('Нічого не записано')).toBeTruthy()
		expect(useLiveWorkoutStore.getState().lastSeen).toBeNull()
	})

	it('finish with work in it clears lastSeen', async () => {
		keepLastSeen(WORK_DONE())
		getMock.mockResolvedValue(reply(WORK_DONE()))
		postMock.mockResolvedValue(
			reply({
				workout: makeWorkout({ id: WORKOUT_ID }),
				messageId: MESSAGE_ID,
				hasNewRecord: false,
			}),
		)
		renderPage()

		fireEvent.click(await screen.findByRole('button', { name: 'Завершити' }))

		await screen.findByRole('button', { name: 'Готово' })
		expect(useLiveWorkoutStore.getState().lastSeen).toBeNull()
		expect(useLiveWorkoutStore.getState().ownerId).toBe(OWNER)
	})

	it('a failed finish keeps lastSeen', async () => {
		keepLastSeen(WORK_DONE())
		getMock.mockResolvedValue(reply(WORK_DONE()))
		postMock.mockRejectedValue(networkError())
		renderPage()

		fireEvent.click(await screen.findByRole('button', { name: 'Завершити' }))

		await waitFor(() => {
			expect(postMock).toHaveBeenCalledTimes(1)
		})
		expect(useLiveWorkoutStore.getState().lastSeen).not.toBeNull()
	})

	it('«Вийти без збереження» (discard) clears lastSeen', async () => {
		keepLastSeen(WORK_DONE())
		getMock.mockResolvedValue(reply(WORK_DONE()))
		deleteMock.mockResolvedValue(reply(null))
		renderPage()
		fireEvent.click(await screen.findByRole('button', { name: 'Вийти без збереження' }))

		fireEvent.click(
			await within(await screen.findByRole('alertdialog')).findByRole('button', {
				name: 'Вийти без збереження',
			}),
		)

		await waitFor(() => {
			expect(deleteMock).toHaveBeenCalledTimes(1)
		})
		await waitFor(() => {
			expect(useLiveWorkoutStore.getState().lastSeen).toBeNull()
		})
	})

	it('«Згорнути» keeps lastSeen: the session is still open', async () => {
		keepLastSeen(WORK_DONE())
		getMock.mockResolvedValue(reply(WORK_DONE()))
		renderPage()

		fireEvent.click(await screen.findByRole('button', { name: 'Згорнути' }))

		expect(await screen.findByText('TRAINING TAB')).toBeTruthy()
		expect(useLiveWorkoutStore.getState().lastSeen).not.toBeNull()
	})
})
