// @vitest-environment jsdom
import type { WorkoutStatsResponse } from '@kus/shared'
import { QueryClient } from '@tanstack/react-query'
import { cleanup, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AxiosHeaders, type AxiosResponse } from 'axios'
import { Route, Routes } from 'react-router'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { httpClient } from '@/shared/api'
import { TAB_ROUTES, TRAINING_SESSION_ROUTE, TRAINING_STATS_ROUTE } from '@/shared/config'
import { BENCH_ID, makeWorkoutStats, renderWithProviders } from '@/shared/testing'

import { TrainingStatsPage } from './TrainingStatsPage'

const getMock = vi.spyOn(httpClient, 'get')

const reply = (stats: WorkoutStatsResponse): AxiosResponse => ({
	data: { data: stats },
	status: 200,
	statusText: 'OK',
	headers: {},
	config: { headers: new AxiosHeaders() },
})

const renderStats = () => {
	const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
	return renderWithProviders(
		<Routes>
			<Route path={TRAINING_STATS_ROUTE} element={<TrainingStatsPage />} />
			<Route path={TRAINING_SESSION_ROUTE} element={<p>SESSION</p>} />
			<Route path={TAB_ROUTES.chat} element={<p>CHAT</p>} />
		</Routes>,
		{ route: TRAINING_STATS_ROUTE, queryClient },
	)
}

const emptyStats = makeWorkoutStats({
	overview: { ...makeWorkoutStats().overview, workoutCount: 0, avgPerWeek: null, buckets: [] },
	exercises: [],
})

afterEach(() => {
	cleanup()
	vi.clearAllMocks()
})

describe('TrainingStatsPage', () => {
	it('is reached on /stats, not swallowed by /:id', async () => {
		getMock.mockResolvedValue(reply(makeWorkoutStats()))
		renderStats()
		expect(await screen.findByRole('heading', { name: 'Статистика' })).toBeTruthy()
		expect(screen.queryByText('SESSION')).toBeNull()
	})

	it('shows a skeleton while loading, with the tabs and the period already there', () => {
		getMock.mockReturnValue(new Promise(() => undefined))
		renderStats()
		expect(screen.getByRole('status', { name: 'Завантажую статистику…' })).toBeTruthy()
		expect(screen.getByRole('tab', { name: 'Огляд' })).toBeTruthy()
		expect(screen.getByRole('button', { name: 'Місяць', pressed: true })).toBeTruthy()
	})

	it('shows the overview: tiles, the weekly chart and the groups', async () => {
		getMock.mockResolvedValue(reply(makeWorkoutStats()))
		renderStats()
		expect(await screen.findByText('1,5 на тиждень')).toBeTruthy()
		expect(screen.getByText('5 год 10 хв')).toBeTruthy()
		expect(screen.getByText('≈ 52 хв за раз')).toBeTruthy()
		expect(screen.getByText('Тренувань на тиждень')).toBeTruthy()
		expect(screen.getByText('кардіо — час')).toBeTruthy()
		expect(screen.getByText('Інше')).toBeTruthy()
	})

	it('says a single workout in words instead of drawing a chart', async () => {
		const stats = makeWorkoutStats()
		getMock.mockResolvedValue(reply({ ...stats, overview: { ...stats.overview, workoutCount: 1 } }))
		renderStats()
		expect(await screen.findByText(/лише одне тренування/)).toBeTruthy()
		expect(screen.queryByText('Тренувань на тиждень')).toBeNull()
	})

	it('lists the exercises with the best set, the change and a link to the exercise', async () => {
		const user = userEvent.setup()
		getMock.mockResolvedValue(reply(makeWorkoutStats()))
		renderStats()
		await user.click(await screen.findByRole('tab', { name: 'Вправи' }))
		const link = await screen.findByRole('link', { name: /Жим лежачи/ })
		expect(link.getAttribute('href')).toBe(`/app/training/exercise/${BENCH_ID}`)
		expect(link.textContent).toContain('рекорд 70×5 · +10 кг')
		expect(screen.getByRole('link', { name: /Підтягування/ }).textContent).toContain(
			'рекорд 9 повт.',
		)
	})

	it('shows the cardio: tiles, machines and a dash with a spoken reason, no kcal row', async () => {
		const user = userEvent.setup()
		getMock.mockResolvedValue(reply(makeWorkoutStats()))
		renderStats()
		await user.click(await screen.findByRole('tab', { name: 'Кардіо' }))
		expect(await screen.findByText('Бігова доріжка')).toBeTruthy()
		expect(screen.getByText('Велотренажер')).toBeTruthy()
		expect(screen.getByText('дистанції немає')).toBeTruthy()
		expect(screen.queryByText(/ккал названо/)).toBeNull()
	})

	it('says there is no cardio or no exercises in a period that has trainings', async () => {
		const user = userEvent.setup()
		const stats = makeWorkoutStats()
		getMock.mockResolvedValue(
			reply({
				...stats,
				exercises: [],
				cardio: { ...stats.cardio, sessionCount: 0, durationMin: 0, distanceM: 0, byExercise: [] },
			}),
		)
		renderStats()
		await user.click(await screen.findByRole('tab', { name: 'Вправи' }))
		expect(await screen.findByText('За цей період вправ немає.')).toBeTruthy()
		await user.click(screen.getByRole('tab', { name: 'Кардіо' }))
		expect(await screen.findByText('За цей період кардіо немає.')).toBeTruthy()
	})

	it('shows the empty state for a period without trainings, and its button opens the chat', async () => {
		const user = userEvent.setup()
		getMock.mockResolvedValue(reply(emptyStats))
		renderStats()
		expect(await screen.findByText('За цей період тренувань ще немає')).toBeTruthy()
		await user.click(screen.getByRole('button', { name: 'Написати в чат' }))
		expect(await screen.findByText('CHAT')).toBeTruthy()
	})

	it('shows an inline error with a retry', async () => {
		const user = userEvent.setup()
		getMock.mockRejectedValueOnce(new Error('offline'))
		getMock.mockResolvedValue(reply(makeWorkoutStats()))
		renderStats()
		expect(await screen.findByText('Не вдалося завантажити статистику.')).toBeTruthy()
		await user.click(screen.getByRole('button', { name: 'Повторити' }))
		expect(await screen.findByText('1,5 на тиждень')).toBeTruthy()
	})

	it('asks for the chosen period and keeps the numbers on screen meanwhile', async () => {
		const user = userEvent.setup()
		getMock.mockResolvedValueOnce(reply(makeWorkoutStats()))
		renderStats()
		await screen.findByText('1,5 на тиждень')
		getMock.mockReturnValueOnce(new Promise(() => undefined))
		await user.click(screen.getByRole('button', { name: 'Тиждень' }))
		await waitFor(() => {
			expect(getMock).toHaveBeenLastCalledWith('/workouts/stats', { params: { period: 'week' } })
		})
		expect(screen.getByText('1,5 на тиждень')).toBeTruthy()
	})
})
