// @vitest-environment jsdom
import type { ExerciseStatsResponse } from '@kus/shared'
import { QueryClient } from '@tanstack/react-query'
import { cleanup, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AxiosError, AxiosHeaders, type AxiosResponse } from 'axios'
import { Route, Routes } from 'react-router'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { httpClient } from '@/shared/api'
import {
	getTrainingExercisePath,
	TRAINING_EXERCISE_ROUTE,
	TRAINING_STATS_ROUTE,
} from '@/shared/config'
import {
	BENCH_ID,
	makeBodyweightStats,
	makeWeightedStats,
	PULLUP_ID,
	renderWithProviders,
} from '@/shared/testing'
import { TrainingExercisePage } from './TrainingExercisePage'

const getMock = vi.spyOn(httpClient, 'get')

const reply = (data: ExerciseStatsResponse): AxiosResponse => ({
	data: { data },
	status: 200,
	statusText: 'OK',
	headers: {},
	config: { headers: new AxiosHeaders() },
})

const httpError = (status: number): AxiosError =>
	new AxiosError('failed', String(status), undefined, undefined, {
		data: { statusCode: status, errorCode: 'EXERCISE_NOT_FOUND', details: {} },
		status,
		statusText: '',
		headers: {},
		config: { headers: new AxiosHeaders() },
	})

const renderExercise = (exerciseId: string = BENCH_ID) =>
	renderWithProviders(
		<Routes>
			<Route path={TRAINING_EXERCISE_ROUTE} element={<TrainingExercisePage />} />
			<Route path={TRAINING_STATS_ROUTE} element={<p>STATS</p>} />
		</Routes>,
		{
			route: getTrainingExercisePath(exerciseId),
			queryClient: new QueryClient({ defaultOptions: { queries: { retry: false } } }),
		},
	)

afterEach(() => {
	cleanup()
	vi.clearAllMocks()
})

describe('TrainingExercisePage', () => {
	it('shows a skeleton while the first load runs', () => {
		getMock.mockReturnValue(new Promise(() => undefined))
		renderExercise()
		expect(screen.getByRole('status')).toBeTruthy()
	})

	it('shows a weighted exercise: header, change, chart, records and history', async () => {
		getMock.mockResolvedValue(reply(makeWeightedStats()))
		renderExercise()

		expect(await screen.findByRole('heading', { name: 'Жим лежачи' })).toBeTruthy()
		expect(screen.getByText('Груди · 2 тренування з 1 жовтня')).toBeTruthy()
		expect(screen.getByText('+10 кг за місяць')).toBeTruthy()
		expect(screen.getByRole('img', { name: 'Графік ваги за місяць' })).toBeTruthy()
		expect(screen.getByText('Рекорд ваги')).toBeTruthy()
		expect(screen.getByText('70 кг × 6')).toBeTruthy()
		expect(screen.getByText('Історія')).toBeTruthy()
		expect(screen.getByText('розминка · 40 кг × 10')).toBeTruthy()
		expect(getMock).toHaveBeenCalledWith(`/workouts/exercises/${BENCH_ID}`, {
			params: { period: 'month' },
		})
	})

	it('switches the chart to reps and counts the change in reps', async () => {
		const user = userEvent.setup()
		getMock.mockResolvedValue(reply(makeWeightedStats()))
		renderExercise()

		await user.click(await screen.findByRole('button', { name: 'Повтори' }))
		expect(screen.getByRole('img', { name: 'Графік повторів за місяць' })).toBeTruthy()
		expect(screen.getByText('−3 повт. за місяць')).toBeTruthy()
	})

	it('asks for another period', async () => {
		const user = userEvent.setup()
		getMock.mockResolvedValue(reply(makeWeightedStats()))
		renderExercise()

		await user.click(await screen.findByRole('button', { name: 'Тиждень' }))
		await waitFor(() => {
			expect(getMock).toHaveBeenLastCalledWith(`/workouts/exercises/${BENCH_ID}`, {
				params: { period: 'week' },
			})
		})
	})

	it('bodyweight: reps only, one note, no metric toggle', async () => {
		getMock.mockResolvedValue(reply(makeBodyweightStats()))
		renderExercise(PULLUP_ID)

		expect(await screen.findByText('Спина · власна вага · 2 тренування з 1 жовтня')).toBeTruthy()
		expect(screen.queryByRole('button', { name: 'Вага' })).toBeNull()
		expect(screen.getAllByText('Власна вага — лише повтори.')).toHaveLength(1)
		expect(screen.getByText('21 повт.')).toBeTruthy()
		expect(screen.getByText('За тренування')).toBeTruthy()
		expect(screen.getByText('+1 повт. за місяць')).toBeTruthy()
	})

	it('with no point in the period says so, and the history stays', async () => {
		getMock.mockResolvedValue(
			reply(makeWeightedStats({ points: [], change: null, changeReps: null })),
		)
		renderExercise()

		expect(await screen.findByText(/тренувань із цією вправою немає/)).toBeTruthy()
		expect(screen.queryByRole('img')).toBeNull()
		expect(screen.queryByRole('button', { name: 'Повтори' })).toBeNull()
		expect(screen.getByText('Історія')).toBeTruthy()
	})

	it('with one point tells it in words instead of a chart', async () => {
		const stats = makeWeightedStats()
		getMock.mockResolvedValue(
			reply({ ...stats, points: stats.points.slice(0, 1), change: null, changeReps: null }),
		)
		renderExercise()

		expect(await screen.findByText(/Поки лише одне тренування з цією вправою/)).toBeTruthy()
		expect(screen.queryByRole('img')).toBeNull()
	})

	it('shows «Такої вправи немає» on 404 and leads to the stats', async () => {
		const user = userEvent.setup()
		getMock.mockRejectedValue(httpError(404))
		renderExercise()

		expect(await screen.findByText('Такої вправи немає')).toBeTruthy()
		await user.click(screen.getByRole('button', { name: 'До статистики' }))
		expect(await screen.findByText('STATS')).toBeTruthy()
	})

	it('treats an id that is no uuid as unknown, without a request', () => {
		renderExercise('not-a-uuid')
		expect(screen.getByText('Такої вправи немає')).toBeTruthy()
		expect(getMock).not.toHaveBeenCalled()
	})

	it('shows an inline error with retry on another failure', async () => {
		const user = userEvent.setup()
		getMock.mockRejectedValueOnce(httpError(500))
		getMock.mockResolvedValue(reply(makeWeightedStats()))
		renderExercise()

		expect(await screen.findByText('Не вдалося завантажити вправу.')).toBeTruthy()
		await user.click(screen.getByRole('button', { name: 'Повторити' }))
		expect(await screen.findByText('+10 кг за місяць')).toBeTruthy()
	})
})
