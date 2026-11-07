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
	makeExercise,
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
const OTHER_WORKOUT_ID = '0199b3a4-0000-7000-8000-0000000000f2'
const CHAT_EXERCISE_ID = '0199b3a4-0000-7000-8000-0000000000e9'

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

	it('a 5xx answer keeps lastSeen on the screen, not the error with «retry»', async () => {
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

		expect(await screen.findByText('Жим лежачи')).toBeTruthy()
		await waitFor(() => {
			expect(getMock).toHaveBeenCalled()
		})
		expect(screen.queryByText('Не вдалося завантажити тренування.')).toBeNull()
		expect(screen.getByText('Жим лежачи')).toBeTruthy()
	})

	it('a read that does not answer shows lastSeen at once, with no loader', async () => {
		keepLastSeen(seen('Верх А'))
		getMock.mockReturnValue(new Promise(() => undefined))
		renderPage()

		expect(await screen.findByText('Жим лежачи')).toBeTruthy()
		expect(screen.getByText('Верх А')).toBeTruthy()
		expect(screen.queryByLabelText('Завантаження')).toBeNull()
	})

	it('a newer answer replaces lastSeen and the toast says the chat changed the session', async () => {
		keepLastSeen(seen('Верх А'))
		let answer: (value: AxiosResponse) => void = () => undefined
		getMock.mockReturnValue(
			new Promise<AxiosResponse>((resolve) => {
				answer = resolve
			}),
		)
		renderPage()
		await screen.findByText('Жим лежачи')

		const base = seen('Верх А')
		await act(async () => {
			answer(
				reply({
					...base,
					editedAt: '2026-11-05T12:00:00.000Z',
					workout: {
						...base.workout,
						exercises: [makeExercise({ id: CHAT_EXERCISE_ID, name: 'Присід', clientKey: null })],
					},
				}),
			)
			await Promise.resolve()
		})

		expect(await screen.findByText('Присід')).toBeTruthy()
		expect(await screen.findByText('Тренування змінилось у чаті — оновив.')).toBeTruthy()
	})

	it('an online answer wins over lastSeen', async () => {
		keepLastSeen(seen('Верх А'))
		getMock.mockResolvedValue(
			reply(
				makeLiveResponse({
					templateName: 'Низ Б',
					// another session: the screen starts over with it
					workout: makeWorkout({ id: OTHER_WORKOUT_ID, source: 'LIVE', exercises: [] }),
					plan: [makePlanExercise({ name: 'Присідання' })],
				}),
			),
		)
		renderPage()

		expect(await screen.findByText('Присідання')).toBeTruthy()
		expect(screen.queryByText('Жим лежачи')).toBeNull()
	})

	it('an answer «no open session» (null) after lastSeen was shown says the chat closed it', async () => {
		keepLastSeen(seen('Верх А'))
		getMock.mockResolvedValue(reply(null))
		renderPage()

		expect(
			await screen.findByText('Це тренування вже завершено — підходи збережено, підсумок у чаті.'),
		).toBeTruthy()
		expect(screen.queryByText('Жим лежачи')).toBeNull()
	})

	it('without lastSeen an answer null leaves for the tab', async () => {
		getMock.mockResolvedValue(reply(null))
		renderPage()

		expect(await screen.findByText('TRAINING TAB')).toBeTruthy()
	})

	it('the session closed in the chat after an offline start shows the closed card and drops lastSeen', async () => {
		keepLastSeen(seen('Верх А'))
		getMock.mockRejectedValue(networkError())
		const { queryClient } = renderPage()
		await screen.findByText('Жим лежачи')

		act(() => {
			queryClient.setQueryData(LIVE_WORKOUT_QUERY_KEY, null)
		})

		expect(
			await screen.findByText('Це тренування вже завершено — підходи збережено, підсумок у чаті.'),
		).toBeTruthy()
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
