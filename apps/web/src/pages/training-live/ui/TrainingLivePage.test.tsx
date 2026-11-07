// @vitest-environment jsdom
import type { LiveWorkoutResponse } from '@kus/shared'
import { QueryClient } from '@tanstack/react-query'
import { act, cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react'
import { AxiosError, AxiosHeaders, type AxiosResponse } from 'axios'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { LIVE_WORKOUT_QUERY_KEY } from '@/entities/workout'
import { onSetDone, type SetDoneEvent, useLiveWorkoutStore } from '@/features/live-workout'
import { httpClient } from '@/shared/api'
import { getTrainingSessionPath, ROUTES, TRAINING_LIVE_ROUTE } from '@/shared/config'
import {
	LIVE_EDITED_AT,
	makeExercise,
	makeLiveResponse,
	makePlanExercise,
	makeWorkout,
	renderWithProviders,
} from '@/shared/testing'

import { TrainingLivePage } from './TrainingLivePage'

const getMock = vi.spyOn(httpClient, 'get')
const putMock = vi.spyOn(httpClient, 'put')
const postMock = vi.spyOn(httpClient, 'post')
const deleteMock = vi.spyOn(httpClient, 'delete')

const EDITED_BY_CHAT = '2026-11-02T09:10:00.000Z'
const CHAT_EXERCISE_ID = '0199b3a4-0000-7000-8000-0000000000e9'
const MESSAGE_ID = '0199b3a4-0000-7000-8000-0000000000aa'

const reply = (data: unknown): AxiosResponse => ({
	data: { data },
	status: 200,
	statusText: 'OK',
	headers: {},
	config: { headers: new AxiosHeaders() },
})

const networkError = (): AxiosError => new AxiosError('Network Error', AxiosError.ERR_NETWORK)

const httpError = (status: number, errorCode: string, details = {}): AxiosError => {
	const config = { headers: new AxiosHeaders() }
	return new AxiosError('failed', AxiosError.ERR_BAD_RESPONSE, config, null, {
		status,
		statusText: String(status),
		headers: {},
		config,
		data: { statusCode: status, errorCode, details },
	})
}

let sequence = 0
// a new session id per test: unsent snapshots outlive a screen on purpose and must not leak between tests
let workoutId = ''

const withId = (live: LiveWorkoutResponse): LiveWorkoutResponse => ({
	...live,
	workout: { ...live.workout, id: workoutId },
})

const planned = (): LiveWorkoutResponse =>
	withId(makeLiveResponse({ templateName: 'Верх А', plan: [makePlanExercise()] }))

/** What `GET /live-workouts/current` answers now; the tests move it. */
let current: LiveWorkoutResponse | null = null

const renderPage = (onPathname?: (pathname: string) => void) => {
	const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
	const view = renderWithProviders(<TrainingLivePage />, {
		route: TRAINING_LIVE_ROUTE,
		queryClient,
		onPathname,
	})
	return { ...view, queryClient }
}

const putCalls = () => putMock.mock.calls.map(([, body]) => body as LiveWorkoutResponse | undefined)

beforeEach(() => {
	vi.useFakeTimers({ toFake: ['Date'] })
	vi.setSystemTime(new Date('2026-11-02T09:23:00.000Z'))
	sequence += 1
	workoutId = `0199b3a4-0000-7000-8000-${String(sequence).padStart(12, '0')}`
	current = planned()
	getMock.mockImplementation((url: string) =>
		Promise.resolve(reply(url === '/live-workouts/current' ? current : [])),
	)
	putMock.mockImplementation(() => Promise.resolve(reply(current)))
})

afterEach(() => {
	vi.useRealTimers()
	cleanup()
	vi.clearAllMocks()
})

describe('TrainingLivePage', () => {
	it('shows the exercise of the plan with its current set', async () => {
		renderPage()

		expect(await screen.findByText('Жим лежачи')).toBeTruthy()
		expect(screen.getByText('Мета: 3 підходи · 8–10 повт. · 50 кг')).toBeTruthy()
		expect(screen.getByText('Підхід 1')).toBeTruthy()
		expect(screen.getByRole('button', { name: 'Підхід виконано' })).toBeTruthy()
	})

	it('a current warm-up is titled «Розминка» and read as «Розминка, підхід N»', async () => {
		renderPage()
		await screen.findByText('Підхід 1')

		fireEvent.click(screen.getByRole('button', { name: '+ Розминка' }))

		const group = await screen.findByRole('group', { name: 'Розминка, підхід 1' })
		expect(within(group).getByText('Розминка')).toBeTruthy()
		expect(screen.queryByText('Підхід Р')).toBeNull()
	})

	it('a current working set keeps «Підхід N» with no group label', async () => {
		renderPage()

		expect(await screen.findByText('Підхід 1')).toBeTruthy()
		expect(screen.queryByRole('group', { name: /Розминка/ })).toBeNull()
	})

	it('marking a set done sends it with doneAt and tells the set-done listener once', async () => {
		const listener = vi.fn<(event: SetDoneEvent) => void>()
		const unsubscribe = onSetDone(listener)
		renderPage()

		fireEvent.click(await screen.findByRole('button', { name: 'Підхід виконано' }))

		await waitFor(() => {
			expect(putMock).toHaveBeenCalledTimes(1)
		})
		const [url, body] = putMock.mock.calls[0] as [
			string,
			{
				knownEditedAt: string
				exercises: { clientKey: string; sets: { doneAt: string | null }[] }[]
			},
		]
		expect(url).toBe(`/live-workouts/${workoutId}`)
		expect(body.knownEditedAt).toBe(LIVE_EDITED_AT)
		expect(body.exercises).toHaveLength(1)
		expect(body.exercises[0]?.sets.map((set) => set.doneAt === null)).toEqual([false, true, true])
		expect(listener).toHaveBeenCalledTimes(1)
		expect(listener).toHaveBeenCalledWith({
			workoutId: workoutId,
			exerciseKey: body.exercises[0]?.clientKey,
			setIndex: 0,
			restSec: 90,
		})
		unsubscribe()
	})

	it('un-marking a done set does not notify the listener again', async () => {
		const listener = vi.fn()
		const unsubscribe = onSetDone(listener)
		renderPage()

		fireEvent.click(await screen.findByRole('button', { name: 'Підхід виконано' }))
		fireEvent.click(await screen.findByRole('button', { name: 'Підхід 1 виконано' }))

		await waitFor(() => {
			expect(putMock).toHaveBeenCalledTimes(2)
		})
		expect(listener).toHaveBeenCalledTimes(1)
		unsubscribe()
	})

	it("takes in the chat's edit: its exercises appear as «З чату» and a toast says so", async () => {
		const { queryClient } = renderPage()
		await screen.findByText('Жим лежачи')

		act(() => {
			queryClient.setQueryData(LIVE_WORKOUT_QUERY_KEY, {
				...planned(),
				editedAt: EDITED_BY_CHAT,
				workout: {
					...planned().workout,
					exercises: [makeExercise({ id: CHAT_EXERCISE_ID, name: 'Присід', clientKey: null })],
				},
			})
		})

		expect(await screen.findByText('Присід')).toBeTruthy()
		expect(screen.getByText('З чату')).toBeTruthy()
		expect(await screen.findByText('Тренування змінилось у чаті — оновив.')).toBeTruthy()
		// my exercise stays
		expect(screen.getByText('Жим лежачи')).toBeTruthy()
	})

	it('shows a chat exercise as a plain row without inputs and never sends it', async () => {
		current = makeLiveResponse({
			workout: {
				...makeLiveResponse().workout,
				exercises: [makeExercise({ id: CHAT_EXERCISE_ID, name: 'Присід', clientKey: null })],
			},
		})
		renderPage()

		const name = await screen.findByText('Присід')

		expect(screen.getByText('З чату')).toBeTruthy()
		expect(name.closest('button')).toBeNull()
		expect(screen.queryByRole('button', { name: 'Підхід виконано' })).toBeNull()
		expect(screen.queryByRole('textbox')).toBeNull()
		expect(putMock).not.toHaveBeenCalled()
	})

	it('leaves for the training tab when there is no open session', async () => {
		current = null
		const onPathname = vi.fn()
		renderPage(onPathname)

		await waitFor(() => {
			expect(onPathname).toHaveBeenLastCalledWith(ROUTES.training)
		})
	})

	it('a session the chat closed (409 FINISHED) shows only «Згорнути» and the card, no list, timer or actions', async () => {
		const onPathname = vi.fn()
		renderPage(onPathname)
		putMock.mockRejectedValue(httpError(409, 'WORKOUT_LIVE_CONFLICT', { reason: 'FINISHED' }))
		// the chat finished it: the next read finds nothing open
		const closedRead = (): void => {
			current = null
		}

		fireEvent.click(await screen.findByRole('button', { name: 'Підхід виконано' }))
		closedRead()

		expect(
			await screen.findByText('Це тренування вже завершено — підходи збережено, підсумок у чаті.'),
		).toBeTruthy()
		expect(screen.getByRole('button', { name: 'Згорнути' })).toBeTruthy()
		expect(screen.queryByText('Жим лежачи')).toBeNull()
		expect(screen.queryByRole('timer')).toBeNull()
		expect(screen.queryByRole('button', { name: 'Завершити' })).toBeNull()
		expect(screen.queryByRole('button', { name: 'Підхід виконано' })).toBeNull()
		expect(screen.queryByRole('button', { name: 'Вправа' })).toBeNull()
		expect(onPathname).not.toHaveBeenLastCalledWith(ROUTES.training)

		fireEvent.click(screen.getByRole('button', { name: 'Відкрити тренування' }))

		expect(onPathname).toHaveBeenLastCalledWith(getTrainingSessionPath(workoutId))
	})

	it('«Згорнути» on the closed card leaves for the tab', async () => {
		const onPathname = vi.fn()
		const { queryClient } = renderPage(onPathname)
		await screen.findByText('Жим лежачи')
		act(() => {
			queryClient.setQueryData(LIVE_WORKOUT_QUERY_KEY, null)
		})
		await screen.findByText('Це тренування вже завершено — підходи збережено, підсумок у чаті.')

		fireEvent.click(screen.getByRole('button', { name: 'Згорнути' }))

		expect(onPathname).toHaveBeenLastCalledWith(ROUTES.training)
	})

	it('a cache emptied under the screen (isClosed) shows the card and sends nothing more', async () => {
		const { queryClient } = renderPage()
		await screen.findByText('Жим лежачи')

		act(() => {
			queryClient.setQueryData(LIVE_WORKOUT_QUERY_KEY, null)
		})

		expect(
			await screen.findByText('Це тренування вже завершено — підходи збережено, підсумок у чаті.'),
		).toBeTruthy()
		expect(screen.queryByText('Жим лежачи')).toBeNull()
		expect(screen.queryByRole('timer')).toBeNull()
		expect(putMock).not.toHaveBeenCalled()
	})

	it('the unsent sets of a closed session are dropped from the store', async () => {
		const { queryClient } = renderPage()
		await screen.findByText('Жим лежачи')
		useLiveWorkoutStore.getState().saveSnapshot(workoutId, { exercises: [], knownEditedAt: null })

		act(() => {
			queryClient.setQueryData(LIVE_WORKOUT_QUERY_KEY, null)
		})

		await waitFor(() => {
			expect(useLiveWorkoutStore.getState().snapshots[workoutId]).toBeUndefined()
		})
	})
})

describe('TrainingLivePage: finishing and leaving', () => {
	it('«Завершити» with nothing done: a toast, back to the tab, no summary screen', async () => {
		postMock.mockResolvedValue(reply({ discarded: true }))
		const onPathname = vi.fn()
		renderPage(onPathname)

		fireEvent.click(await screen.findByRole('button', { name: 'Завершити' }))

		expect(await screen.findByText('Нічого не записано')).toBeTruthy()
		expect(postMock).toHaveBeenCalledWith(`/live-workouts/${workoutId}/finish`)
		await waitFor(() => {
			expect(onPathname).toHaveBeenLastCalledWith(ROUTES.training)
		})
		expect(screen.queryByText('Готово')).toBeNull()
	})

	it('«Завершити» with work in it shows the summary screen', async () => {
		postMock.mockResolvedValue(
			reply({
				workout: makeWorkout({
					id: workoutId,
					localDate: '2026-11-02',
					startedAt: '2026-11-02T09:00:00.000Z',
				}),
				messageId: MESSAGE_ID,
				hasNewRecord: false,
			}),
		)
		renderPage()

		fireEvent.click(await screen.findByRole('button', { name: 'Завершити' }))

		expect(await screen.findByRole('button', { name: 'Готово' })).toBeTruthy()
		expect(screen.queryByText('Підхід виконано')).toBeNull()
	})

	it('does not send «Завершити» while sets cannot reach the server (offline): a toast instead', async () => {
		renderPage()
		putMock.mockRejectedValue(networkError())

		fireEvent.click(await screen.findByRole('button', { name: 'Підхід виконано' }))
		await waitFor(() => {
			expect(screen.getByRole('status').textContent).toContain('Без мережі')
		})
		fireEvent.click(screen.getByRole('button', { name: 'Завершити' }))

		expect(postMock).not.toHaveBeenCalled()
		await waitFor(() => {
			// the pill under the header and the toast of the refused «Завершити»
			expect(screen.getAllByText(/Без мережі/)).toHaveLength(1)
			expect(screen.getAllByText(/Підходи збережено на телефоні/)).toHaveLength(1)
		})
	})

	it('does not send «Завершити» after the server refused the sets (4xx): a toast instead', async () => {
		renderPage()
		putMock.mockRejectedValue(httpError(422, 'VALIDATION_ERROR'))

		fireEvent.click(await screen.findByRole('button', { name: 'Підхід виконано' }))
		await screen.findByRole('button', { name: 'Повторити' })
		fireEvent.click(screen.getByRole('button', { name: 'Завершити' }))

		expect(postMock).not.toHaveBeenCalled()
		await waitFor(() => {
			expect(screen.getAllByText('Не вдалося зберегти підходи. Спробуй ще раз.')).toHaveLength(2)
		})
	})

	it('«Згорнути» with no set done just leaves, without asking', async () => {
		const onPathname = vi.fn()
		renderPage(onPathname)

		fireEvent.click(await screen.findByRole('button', { name: 'Згорнути' }))

		expect(screen.queryByText('Вийти без збереження?')).toBeNull()
		expect(onPathname).toHaveBeenLastCalledWith(ROUTES.training)
	})

	it('«Згорнути» with a set done leaves at once: no dialog, no DELETE, no finish', async () => {
		const onPathname = vi.fn()
		renderPage(onPathname)
		fireEvent.click(await screen.findByRole('button', { name: 'Підхід виконано' }))
		await waitFor(() => {
			expect(putMock).toHaveBeenCalledTimes(1)
		})

		fireEvent.click(screen.getByRole('button', { name: 'Згорнути' }))

		expect(screen.queryByText('Вийти без збереження?')).toBeNull()
		expect(screen.queryByRole('alertdialog')).toBeNull()
		expect(onPathname).toHaveBeenLastCalledWith(ROUTES.training)
		expect(deleteMock).not.toHaveBeenCalled()
		expect(postMock).not.toHaveBeenCalled()
	})

	it('the quiet «Вийти без збереження» at the bottom opens the dialog with what is made and does not leave', async () => {
		const onPathname = vi.fn()
		renderPage(onPathname)
		fireEvent.click(await screen.findByRole('button', { name: 'Підхід виконано' }))

		fireEvent.click(screen.getByRole('button', { name: 'Вийти без збереження' }))

		expect(await screen.findByText('Вийти без збереження?')).toBeTruthy()
		expect(
			screen.getByText(
				'Зроблено 1 підхід за 23 хв. Можна продовжити пізніше — тренування закриється саме, якщо від останнього підходу мине понад 3 години.',
			),
		).toBeTruthy()
		expect(screen.queryByRole('button', { name: 'Продовжити пізніше' })).toBeNull()
		expect(onPathname).not.toHaveBeenLastCalledWith(ROUTES.training)
		expect(deleteMock).not.toHaveBeenCalled()
	})

	it('the bottom «Вийти без збереження» with no set done opens a dialog without description', async () => {
		renderPage()

		fireEvent.click(await screen.findByRole('button', { name: 'Вийти без збереження' }))

		const dialog = await screen.findByRole('alertdialog')
		expect(dialog.textContent).not.toContain('Зроблено')
		expect(dialog.textContent).not.toContain('Можна продовжити')
	})

	it('«Скасувати» closes the dialog and keeps the session', async () => {
		const onPathname = vi.fn()
		renderPage(onPathname)
		fireEvent.click(await screen.findByRole('button', { name: 'Вийти без збереження' }))

		fireEvent.click(await screen.findByRole('button', { name: 'Скасувати' }))

		await waitFor(() => {
			expect(screen.queryByRole('alertdialog')).toBeNull()
		})
		expect(deleteMock).not.toHaveBeenCalled()
		expect(onPathname).not.toHaveBeenLastCalledWith(ROUTES.training)
		expect(screen.getByText('Жим лежачи')).toBeTruthy()
	})

	it('«Вийти без збереження» (bottom button, then the dialog) deletes the session and leaves', async () => {
		deleteMock.mockResolvedValue(reply(null))
		const onPathname = vi.fn()
		renderPage(onPathname)
		fireEvent.click(await screen.findByRole('button', { name: 'Підхід виконано' }))
		fireEvent.click(screen.getByRole('button', { name: 'Вийти без збереження' }))

		fireEvent.click(
			await within(await screen.findByRole('alertdialog')).findByRole('button', {
				name: 'Вийти без збереження',
			}),
		)

		await waitFor(() => {
			expect(deleteMock).toHaveBeenCalledWith(`/live-workouts/${workoutId}`)
		})
		await waitFor(() => {
			expect(onPathname).toHaveBeenLastCalledWith(ROUTES.training)
		})
	})

	it('a refused DELETE keeps the screen and says why', async () => {
		deleteMock.mockRejectedValue(networkError())
		const onPathname = vi.fn()
		renderPage(onPathname)
		fireEvent.click(await screen.findByRole('button', { name: 'Вийти без збереження' }))

		fireEvent.click(
			await within(await screen.findByRole('alertdialog')).findByRole('button', {
				name: 'Вийти без збереження',
			}),
		)

		await waitFor(() => {
			expect(deleteMock).toHaveBeenCalledTimes(1)
		})
		expect(onPathname).not.toHaveBeenLastCalledWith(ROUTES.training)
	})

	it('sends nothing to the server when only looking (no PUT without a change)', async () => {
		renderPage()
		await screen.findByText('Жим лежачи')

		expect(putCalls()).toEqual([])
	})
})
