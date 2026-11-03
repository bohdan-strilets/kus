// @vitest-environment jsdom
import { MAX_EXERCISES_PER_WORKOUT, MAX_SETS_PER_EXERCISE } from '@kus/shared'
import type { LiveWorkoutResponse, LiveWorkoutUpdate } from '@kus/shared'
import { QueryClient } from '@tanstack/react-query'
import { act, cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react'
import { AxiosError, AxiosHeaders, type AxiosResponse } from 'axios'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { LIVE_WORKOUT_QUERY_KEY, NEW_CARDIO_MIN } from '@/entities/workout'
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

import { TrainingLivePage } from './TrainingLivePage'

const getMock = vi.spyOn(httpClient, 'get')
const putMock = vi.spyOn(httpClient, 'put')
const postMock = vi.spyOn(httpClient, 'post')
const deleteMock = vi.spyOn(httpClient, 'delete')

const CARDIO_TEMPLATE_EXERCISE = '0199b3a4-0000-7000-8000-0000000000b2'
const MESSAGE_ID = '0199b3a4-0000-7000-8000-0000000000aa'

const reply = (data: unknown): AxiosResponse => ({
	data: { data },
	status: 200,
	statusText: 'OK',
	headers: {},
	config: { headers: new AxiosHeaders() },
})

const uuid = (n: number): string => `0199b3a4-0000-7000-8000-${String(n).padStart(12, '0')}`

let sequence = 0
// a new session id per test: unsent snapshots outlive a screen on purpose
let workoutId = ''
let current: LiveWorkoutResponse | null = null

const withId = (live: LiveWorkoutResponse): LiveWorkoutResponse => ({
	...live,
	workout: { ...live.workout, id: workoutId },
})

const strengthPlan = () => makePlanExercise()
const cardioPlan = (overrides = {}) =>
	makePlanExercise({
		templateExerciseId: CARDIO_TEMPLATE_EXERCISE,
		name: 'Доріжка',
		kind: 'CARDIO',
		muscleGroup: null,
		sets: null,
		repsMin: null,
		repsMax: null,
		weightKg: null,
		durationMin: 20,
		...overrides,
	})

const renderPage = (onPathname?: (pathname: string) => void) => {
	const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
	const view = renderWithProviders(<TrainingLivePage />, {
		route: TRAINING_LIVE_ROUTE,
		queryClient,
		onPathname,
	})
	return { ...view, queryClient }
}

const cardioMinutesInPut = (): number | null | undefined =>
	lastPutBody().exercises.find((exercise) => exercise.name === 'Доріжка')?.durationMin

const lastPutBody = (): LiveWorkoutUpdate => putMock.mock.calls.at(-1)?.[1] as LiveWorkoutUpdate

beforeEach(() => {
	sequence += 1
	workoutId = uuid(900 + sequence)
	current = withId(makeLiveResponse({ templateName: 'Верх А', plan: [strengthPlan()] }))
	getMock.mockImplementation((url: string) =>
		Promise.resolve(reply(url === '/live-workouts/current' ? current : [])),
	)
	putMock.mockImplementation(() => Promise.resolve(reply(current)))
})

afterEach(() => {
	cleanup()
	vi.clearAllMocks()
})

describe('TrainingLivePage: «Завершити» waits for the sets', () => {
	it('while a PUT is in flight it shows the loading state, then finishes after the sets landed', async () => {
		let release: (value: AxiosResponse) => void = () => undefined
		putMock.mockReturnValue(new Promise((resolve) => (release = resolve)))
		postMock.mockResolvedValue(reply({ discarded: true }))
		renderPage()
		fireEvent.click(await screen.findByRole('button', { name: 'Підхід виконано' }))
		await waitFor(() => {
			expect(putMock).toHaveBeenCalledTimes(1)
		})

		fireEvent.click(screen.getByRole('button', { name: 'Завершити' }))

		await waitFor(() => {
			expect(screen.getByRole('button', { name: 'Завершити' }).getAttribute('aria-disabled')).toBe(
				'true',
			)
		})
		expect(postMock).not.toHaveBeenCalled()

		release(reply(current))

		await waitFor(() => {
			expect(postMock).toHaveBeenCalledTimes(1)
		})
	})

	it('a second tap while it waits does not finish twice', async () => {
		let release: (value: AxiosResponse) => void = () => undefined
		putMock.mockReturnValue(new Promise((resolve) => (release = resolve)))
		postMock.mockResolvedValue(reply({ discarded: true }))
		renderPage()
		fireEvent.click(await screen.findByRole('button', { name: 'Підхід виконано' }))

		fireEvent.click(screen.getByRole('button', { name: 'Завершити' }))
		fireEvent.click(screen.getByRole('button', { name: 'Завершити' }))
		release(reply(current))

		await waitFor(() => {
			expect(postMock).toHaveBeenCalledTimes(1)
		})
		await new Promise((resolve) => setTimeout(resolve, 50))
		expect(postMock).toHaveBeenCalledTimes(1)
	})

	it('offline: no finish request, the offline toast', async () => {
		putMock.mockRejectedValue(new AxiosError('Network Error', AxiosError.ERR_NETWORK))
		renderPage()
		fireEvent.click(await screen.findByRole('button', { name: 'Підхід виконано' }))
		await waitFor(() => {
			expect(screen.getByRole('status').textContent).toContain('Немає зв')
		})

		fireEvent.click(screen.getByRole('button', { name: 'Завершити' }))

		await waitFor(() => {
			expect(screen.getAllByText(/Немає зв.язку/)).toHaveLength(2)
		})
		expect(postMock).not.toHaveBeenCalled()
	})
})

describe('TrainingLivePage: the unsent snapshot leaves with the session', () => {
	const seed = (): void => {
		useLiveWorkoutStore.getState().saveSnapshot(workoutId, { exercises: [], knownEditedAt: null })
	}

	it('finish (with work in it) clears it', async () => {
		postMock.mockResolvedValue(
			reply({
				workout: makeWorkout({ id: workoutId }),
				messageId: MESSAGE_ID,
				hasNewRecord: false,
			}),
		)
		renderPage()
		fireEvent.click(await screen.findByRole('button', { name: 'Завершити' }))
		seed()

		await screen.findByRole('button', { name: 'Готово' })

		expect(useLiveWorkoutStore.getState().snapshots[workoutId]).toBeUndefined()
	})

	it('finish with nothing done (discarded) clears it too', async () => {
		postMock.mockResolvedValue(reply({ discarded: true }))
		const onPathname = vi.fn()
		renderPage(onPathname)
		await screen.findByRole('button', { name: 'Завершити' })
		seed()

		fireEvent.click(screen.getByRole('button', { name: 'Завершити' }))

		await waitFor(() => {
			expect(onPathname).toHaveBeenLastCalledWith(ROUTES.training)
		})
		expect(useLiveWorkoutStore.getState().snapshots[workoutId]).toBeUndefined()
	})

	it('a failed finish keeps it', async () => {
		postMock.mockRejectedValue(new AxiosError('Network Error', AxiosError.ERR_NETWORK))
		renderPage()
		await screen.findByRole('button', { name: 'Завершити' })
		seed()

		fireEvent.click(screen.getByRole('button', { name: 'Завершити' }))

		await screen.findByText(/Немає зв/)
		expect(useLiveWorkoutStore.getState().snapshots[workoutId]).toBeDefined()
	})

	it('«Вийти без збереження» (the bottom button, then the dialog) clears it', async () => {
		deleteMock.mockResolvedValue(reply(null))
		const onPathname = vi.fn()
		renderPage(onPathname)
		fireEvent.click(await screen.findByRole('button', { name: 'Підхід виконано' }))
		await waitFor(() => {
			expect(putMock).toHaveBeenCalledTimes(1)
		})
		seed()
		fireEvent.click(screen.getByRole('button', { name: 'Вийти без збереження' }))

		fireEvent.click(
			await within(await screen.findByRole('alertdialog')).findByRole('button', {
				name: 'Вийти без збереження',
			}),
		)

		await waitFor(() => {
			expect(onPathname).toHaveBeenLastCalledWith(ROUTES.training)
		})
		expect(deleteMock).toHaveBeenCalledWith(`/live-workouts/${workoutId}`)
		expect(useLiveWorkoutStore.getState().snapshots[workoutId]).toBeUndefined()
	})

	it('«Скасувати» in the dialog keeps the session and the snapshot', async () => {
		const onPathname = vi.fn()
		renderPage(onPathname)
		fireEvent.click(await screen.findByRole('button', { name: 'Підхід виконано' }))
		await waitFor(() => {
			expect(putMock).toHaveBeenCalledTimes(1)
		})
		seed()
		fireEvent.click(screen.getByRole('button', { name: 'Вийти без збереження' }))

		fireEvent.click(await screen.findByRole('button', { name: 'Скасувати' }))

		await waitFor(() => {
			expect(screen.queryByRole('alertdialog')).toBeNull()
		})
		expect(deleteMock).not.toHaveBeenCalled()
		expect(onPathname).not.toHaveBeenLastCalledWith(ROUTES.training)
		expect(useLiveWorkoutStore.getState().snapshots[workoutId]).toBeDefined()
		expect(screen.getByText('Жим лежачи')).toBeTruthy()
	})

	it('«Згорнути» keeps the snapshot and the session: no dialog, no DELETE, no finish', async () => {
		const onPathname = vi.fn()
		renderPage(onPathname)
		fireEvent.click(await screen.findByRole('button', { name: 'Підхід виконано' }))
		await waitFor(() => {
			expect(putMock).toHaveBeenCalledTimes(1)
		})
		seed()

		fireEvent.click(screen.getByRole('button', { name: 'Згорнути' }))

		expect(screen.queryByRole('alertdialog')).toBeNull()
		expect(onPathname).toHaveBeenLastCalledWith(ROUTES.training)
		expect(deleteMock).not.toHaveBeenCalled()
		expect(postMock).not.toHaveBeenCalled()
		expect(useLiveWorkoutStore.getState().snapshots[workoutId]).toBeDefined()
	})

	it('there is no «Продовжити пізніше» button anywhere', async () => {
		renderPage()
		fireEvent.click(await screen.findByRole('button', { name: 'Підхід виконано' }))
		fireEvent.click(screen.getByRole('button', { name: 'Вийти без збереження' }))
		await screen.findByRole('alertdialog')

		expect(screen.queryByRole('button', { name: 'Продовжити пізніше' })).toBeNull()
		expect(screen.queryByText('Продовжити пізніше')).toBeNull()
	})
})

describe('TrainingLivePage: a planned cardio', () => {
	beforeEach(() => {
		current = withId(
			makeLiveResponse({ templateName: 'Верх А', plan: [strengthPlan(), cardioPlan()] }),
		)
	})

	it('starts not done: «—» minutes, and it is not in the PUT of the strength set', async () => {
		renderPage()
		fireEvent.click(await screen.findByRole('button', { name: 'Підхід виконано' }))

		await waitFor(() => {
			expect(putMock).toHaveBeenCalledTimes(1)
		})
		expect(lastPutBody().exercises.map((exercise) => exercise.name)).toEqual(['Жим лежачи'])
	})

	it('can be opened as the exercise in hand without any set, minutes empty', async () => {
		renderPage()
		fireEvent.click(await screen.findByRole('button', { name: /^Доріжка/ }))

		expect(screen.getByRole('button', { name: 'хв: ввести число' }).textContent).toBe('—')
		expect(screen.getByRole('button', { name: 'Менше хвилин' })).toBeTruthy()
	})

	it('the first «+» sets the plan minutes, the next ones step by one; only then it is sent', async () => {
		renderPage()
		fireEvent.click(await screen.findByRole('button', { name: /^Доріжка/ }))
		expect(putMock).not.toHaveBeenCalled()

		fireEvent.click(screen.getByRole('button', { name: 'Більше хвилин' }))

		expect(screen.getByRole('button', { name: 'хв: ввести число' }).textContent).toBe('20')
		await waitFor(() => {
			expect(putMock).toHaveBeenCalledTimes(1)
		})
		expect(cardioMinutesInPut()).toBe(20)

		fireEvent.click(screen.getByRole('button', { name: 'Більше хвилин' }))

		expect(screen.getByRole('button', { name: 'хв: ввести число' }).textContent).toBe('21')
	})

	it('typing minutes works at once, without the offer step', async () => {
		renderPage()
		fireEvent.click(await screen.findByRole('button', { name: /^Доріжка/ }))

		fireEvent.click(screen.getByRole('button', { name: 'хв: ввести число' }))
		const input = screen.getByRole('textbox', { name: 'хв: ввести число' })
		fireEvent.change(input, { target: { value: '35' } })
		fireEvent.keyDown(input, { key: 'Enter' })

		expect(screen.getByRole('button', { name: 'хв: ввести число' }).textContent).toBe('35')
		await waitFor(() => {
			expect(putMock).toHaveBeenCalledTimes(1)
		})
		expect(cardioMinutesInPut()).toBe(35)
	})

	it('cardio without a plan starts the first «+» at NEW_CARDIO_MIN, then steps by one', async () => {
		current = withId(makeLiveResponse({ plan: [cardioPlan({ durationMin: null })] }))
		renderPage()
		fireEvent.click(await screen.findByRole('button', { name: /^Доріжка/ }))

		fireEvent.click(screen.getByRole('button', { name: 'Більше хвилин' }))

		expect(screen.getByRole('button', { name: 'хв: ввести число' }).textContent).toBe(
			String(NEW_CARDIO_MIN),
		)

		fireEvent.click(screen.getByRole('button', { name: 'Більше хвилин' }))

		expect(screen.getByRole('button', { name: 'хв: ввести число' }).textContent).toBe(
			String(NEW_CARDIO_MIN + 1),
		)
	})

	it('cardio WITH a plan: the first «+» sets the plan minutes, not NEW_CARDIO_MIN', async () => {
		current = withId(makeLiveResponse({ plan: [cardioPlan({ durationMin: 25 })] }))
		renderPage()
		fireEvent.click(await screen.findByRole('button', { name: /^Доріжка/ }))

		fireEvent.click(screen.getByRole('button', { name: 'Більше хвилин' }))

		expect(screen.getByRole('button', { name: 'хв: ввести число' }).textContent).toBe('25')
	})
})

describe('TrainingLivePage: limits', () => {
	it('«+ Вправа» is disabled at the exercise limit and keeps its tap target', async () => {
		current = withId(
			makeLiveResponse({
				workout: {
					...makeLiveResponse().workout,
					exercises: Array.from({ length: MAX_EXERCISES_PER_WORKOUT }, (_, n) =>
						makeExercise({ id: uuid(100 + n), clientKey: uuid(200 + n), name: `Вправа ${n + 1}` }),
					),
				},
			}),
		)
		renderPage()

		const add = await screen.findByRole<HTMLButtonElement>('button', { name: 'Вправа' })

		expect(add.disabled).toBe(true)
		expect(add.className).toContain('min-h-button')
	})

	it('«+ Вправа» works below the limit', async () => {
		renderPage()

		const add = await screen.findByRole<HTMLButtonElement>('button', { name: 'Вправа' })

		expect(add.disabled).toBe(false)
	})

	it('«+ Підхід» and «+ Розминка» are disabled at the set limit', async () => {
		current = withId(
			makeLiveResponse({
				workout: {
					...makeLiveResponse().workout,
					exercises: [
						makeExercise({
							clientKey: uuid(300),
							sets: Array.from({ length: MAX_SETS_PER_EXERCISE }, () => ({
								reps: 8,
								weightKg: 50,
								durationSec: null,
								distanceM: null,
								isWarmup: false,
								doneAt: null,
							})),
						}),
					],
				},
			}),
		)
		renderPage()
		await screen.findByRole('button', { name: '+ Підхід' })

		expect(screen.getByRole<HTMLButtonElement>('button', { name: '+ Підхід' }).disabled).toBe(true)
		expect(screen.getByRole<HTMLButtonElement>('button', { name: '+ Розминка' }).disabled).toBe(
			true,
		)
	})

	it('«+ Підхід» is enabled one below the limit and adds the last one', async () => {
		current = withId(
			makeLiveResponse({
				workout: {
					...makeLiveResponse().workout,
					exercises: [
						makeExercise({
							clientKey: uuid(300),
							sets: Array.from({ length: MAX_SETS_PER_EXERCISE - 1 }, () => ({
								reps: 8,
								weightKg: 50,
								durationSec: null,
								distanceM: null,
								isWarmup: false,
								doneAt: null,
							})),
						}),
					],
				},
			}),
		)
		renderPage()
		await screen.findByRole('button', { name: '+ Підхід' })

		fireEvent.click(screen.getByRole('button', { name: '+ Підхід' }))

		expect(screen.getByRole<HTMLButtonElement>('button', { name: '+ Підхід' }).disabled).toBe(true)
	})
})

describe('TrainingLivePage: isClosingMyself', () => {
	const CLOSED_TEXT = 'Це тренування вже закрите в чаті.'

	/** Records whether the «closed in chat» card was in the DOM at any commit. */
	const watchClosedCard = (): { wasShown: () => boolean; stop: () => void } => {
		let shown = false
		const observer = new MutationObserver(() => {
			if (document.body.textContent.includes(CLOSED_TEXT)) shown = true
		})
		observer.observe(document.body, { childList: true, subtree: true, characterData: true })
		return {
			wasShown: () => shown,
			stop: () => {
				observer.disconnect()
			},
		}
	}

	const markSetDone = async (): Promise<void> => {
		fireEvent.click(await screen.findByRole('button', { name: 'Підхід виконано' }))
		await waitFor(() => {
			expect(putMock).toHaveBeenCalledTimes(1)
		})
	}

	it('own «Завершити» with {discarded:true}: the closed card is never shown', async () => {
		postMock.mockResolvedValue(reply({ discarded: true }))
		const onPathname = vi.fn()
		const watcher = watchClosedCard()
		renderPage(onPathname)
		fireEvent.click(await screen.findByRole('button', { name: 'Завершити' }))

		await waitFor(() => {
			expect(onPathname).toHaveBeenLastCalledWith(ROUTES.training)
		})
		await new Promise((resolve) => setTimeout(resolve, 30))

		expect(watcher.wasShown()).toBe(false)
		expect(screen.queryByText(CLOSED_TEXT)).toBeNull()
		watcher.stop()
	})

	it('own «Вийти без збереження»: no card while the DELETE is in flight and after it', async () => {
		let release: (value: AxiosResponse) => void = () => undefined
		deleteMock.mockReturnValue(new Promise((resolve) => (release = resolve)))
		const onPathname = vi.fn()
		const watcher = watchClosedCard()
		renderPage(onPathname)
		await markSetDone()
		fireEvent.click(screen.getByRole('button', { name: 'Вийти без збереження' }))
		fireEvent.click(
			await within(await screen.findByRole('alertdialog')).findByRole('button', {
				name: 'Вийти без збереження',
			}),
		)
		await waitFor(() => {
			expect(deleteMock).toHaveBeenCalledTimes(1)
		})

		// mutation in flight
		expect(screen.queryByText(CLOSED_TEXT)).toBeNull()

		// the cache turns null in the same tick the request ends: no frame with the card
		release(reply(null))
		await waitFor(() => {
			expect(onPathname).toHaveBeenLastCalledWith(ROUTES.training)
		})
		await new Promise((resolve) => setTimeout(resolve, 30))

		expect(watcher.wasShown()).toBe(false)
		watcher.stop()
	})

	it('a close from the chat (the cache turns null by someone else) still shows the card', async () => {
		const { queryClient } = renderPage()
		await screen.findByText('Жим лежачи')

		act(() => {
			queryClient.setQueryData(LIVE_WORKOUT_QUERY_KEY, null)
		})

		expect(await screen.findByText(CLOSED_TEXT)).toBeTruthy()
	})

	it('an error in «Завершити» resets the flag: a later close from the chat shows the card', async () => {
		postMock.mockRejectedValue(new AxiosError('Network Error', AxiosError.ERR_NETWORK))
		const { queryClient } = renderPage()
		fireEvent.click(await screen.findByRole('button', { name: 'Завершити' }))
		await screen.findByText(/Немає зв/)

		act(() => {
			queryClient.setQueryData(LIVE_WORKOUT_QUERY_KEY, null)
		})

		expect(await screen.findByText(CLOSED_TEXT)).toBeTruthy()
	})

	it('an error in «Вийти без збереження» resets the flag too', async () => {
		deleteMock.mockRejectedValue(new AxiosError('Network Error', AxiosError.ERR_NETWORK))
		const { queryClient } = renderPage()
		await markSetDone()
		fireEvent.click(screen.getByRole('button', { name: 'Вийти без збереження' }))
		fireEvent.click(
			await within(await screen.findByRole('alertdialog')).findByRole('button', {
				name: 'Вийти без збереження',
			}),
		)
		await screen.findByText(/Немає зв/)

		act(() => {
			queryClient.setQueryData(LIVE_WORKOUT_QUERY_KEY, null)
		})

		expect(await screen.findByText(CLOSED_TEXT)).toBeTruthy()
	})
})
