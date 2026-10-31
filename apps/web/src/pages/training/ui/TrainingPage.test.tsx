// @vitest-environment jsdom
import type { AuthUser, WorkoutResponse } from '@kus/shared'
import { QueryClient } from '@tanstack/react-query'
import { cleanup, fireEvent, screen, within } from '@testing-library/react'
import { AxiosHeaders, type AxiosResponse } from 'axios'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { SESSION_QUERY_KEY } from '@/entities/session'
import { httpClient } from '@/shared/api'
import { ROUTES } from '@/shared/config'
import { makeExercise, makeWorkout, renderWithProviders } from '@/shared/testing'

import { TrainingPage } from './TrainingPage'

const getMock = vi.spyOn(httpClient, 'get')

const TODAY = '2026-10-26'

const reply = (workouts: WorkoutResponse[]): AxiosResponse => ({
	data: { data: workouts },
	status: 200,
	statusText: 'OK',
	headers: {},
	config: { headers: new AxiosHeaders() },
})

// seeded, so the page does not ask the (spied) http client for the session first
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

const renderPage = (onPathname?: (pathname: string) => void) => {
	const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
	queryClient.setQueryData(SESSION_QUERY_KEY, user)
	return renderWithProviders(<TrainingPage />, { route: ROUTES.training, onPathname, queryClient })
}

beforeEach(() => {
	vi.useFakeTimers({ toFake: ['Date'] })
	vi.setSystemTime(new Date(`${TODAY}T12:00:00+01:00`))
})

afterEach(() => {
	vi.useRealTimers()
	cleanup()
	vi.clearAllMocks()
})

describe('TrainingPage', () => {
	it('shows a skeleton while loading', () => {
		getMock.mockReturnValue(new Promise(() => undefined))

		renderPage()

		expect(screen.getByRole('status', { name: 'Завантаження' })).toBeTruthy()
		expect(screen.getByRole('heading', { name: 'Тренування' })).toBeTruthy()
	})

	it('shows the week card and the trainings by month, each row a link to its session', async () => {
		getMock.mockResolvedValue(
			reply([
				makeWorkout({
					id: '0199b3a4-0000-7000-8000-0000000000f2',
					localDate: '2026-09-30',
					place: 'HOME',
					durationMin: 30,
					exercises: [makeExercise({ muscleGroup: 'BACK' })],
				}),
				makeWorkout({
					id: '0199b3a4-0000-7000-8000-0000000000f3',
					localDate: TODAY,
					exercises: [makeExercise({ muscleGroup: 'CHEST', record: 'WEIGHT' })],
				}),
			]),
		)

		renderPage()

		expect(await screen.findByText('Цей тиждень')).toBeTruthy()
		expect(screen.getByText('1 тренування · 55 хв')).toBeTruthy()
		expect(screen.getByText('Жовтень')).toBeTruthy()
		expect(screen.getByText('Вересень')).toBeTruthy()
		expect(screen.getByText('Понеділок: було тренування')).toBeTruthy()
		expect(screen.getByText('Вівторок: без тренування')).toBeTruthy()
		const links = screen.getAllByRole('link')
		expect(links.map((link) => link.getAttribute('href'))).toEqual([
			'/app/training/0199b3a4-0000-7000-8000-0000000000f3',
			'/app/training/0199b3a4-0000-7000-8000-0000000000f2',
		])
		expect(within(links[0] as HTMLElement).getByText('Зал · 55 хв')).toBeTruthy()
		expect(getMock).toHaveBeenCalledWith('/workouts', {
			params: { from: '2026-09-01', to: TODAY },
		})
	})

	it('says nothing was trained this week when only older days are there', async () => {
		getMock.mockResolvedValue(reply([makeWorkout({ localDate: '2026-10-20' })]))

		renderPage()

		expect(await screen.findByText('ще без тренувань')).toBeTruthy()
	})

	it('shows the empty state with a way to the chat', async () => {
		getMock.mockResolvedValue(reply([]))
		const onPathname = vi.fn()

		renderPage(onPathname)

		expect(await screen.findByText('Тут будуть твої тренування')).toBeTruthy()
		expect(screen.getByText('Цей тиждень: ще без тренувань')).toBeTruthy()
		fireEvent.click(screen.getByRole('button', { name: 'Написати в чат' }))
		expect(onPathname).toHaveBeenLastCalledWith(ROUTES.chat)
	})

	it('shows the error in place of the journal and retries', async () => {
		getMock.mockRejectedValueOnce(new Error('network'))
		getMock.mockResolvedValue(reply([makeWorkout()]))

		renderPage()

		expect(await screen.findByText('Не вдалося завантажити тренування.')).toBeTruthy()
		expect(screen.getByRole('alert')).toBeTruthy()
		fireEvent.click(screen.getByRole('button', { name: 'Повторити' }))
		expect(await screen.findByText('Цей тиждень')).toBeTruthy()
	})
})
