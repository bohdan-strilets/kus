// @vitest-environment jsdom
import type { WorkoutResponse } from '@kus/shared'
import { QueryClient } from '@tanstack/react-query'
import { cleanup, screen } from '@testing-library/react'
import { AxiosError, AxiosHeaders, type AxiosResponse } from 'axios'
import { Route, Routes } from 'react-router'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { httpClient } from '@/shared/api'
import { getTrainingSessionPath, TRAINING_SESSION_ROUTE } from '@/shared/config'
import { makeExercise, makeWorkout, renderWithProviders } from '@/shared/testing'

import { TrainingSessionPage } from './TrainingSessionPage'

const getMock = vi.spyOn(httpClient, 'get')
const WORKOUT_ID = '0199b3a4-0000-7000-8000-0000000000f1'

const reply = (workout: WorkoutResponse): AxiosResponse => ({
	data: { data: workout },
	status: 200,
	statusText: 'OK',
	headers: {},
	config: { headers: new AxiosHeaders() },
})

const renderAt = (path: string) => {
	const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
	return renderWithProviders(
		<Routes>
			<Route path={TRAINING_SESSION_ROUTE} element={<TrainingSessionPage />} />
		</Routes>,
		{ route: path, queryClient },
	)
}

const cardio = makeExercise({
	id: '0199b3a4-0000-7000-8000-0000000000c1',
	name: 'Бігова доріжка',
	kind: 'CARDIO',
	muscleGroup: null,
	durationMin: 15,
	distanceM: 2100,
	sets: [],
})

afterEach(() => {
	cleanup()
	vi.clearAllMocks()
})

describe('TrainingSessionPage', () => {
	it('shows a skeleton while loading', () => {
		getMock.mockReturnValue(new Promise(() => undefined))
		renderAt(getTrainingSessionPath(WORKOUT_ID))
		expect(screen.getByRole('status', { name: 'Завантаження' })).toBeTruthy()
	})

	it('shows the header, the tiles and the groups of the training', async () => {
		getMock.mockResolvedValue(
			reply(
				makeWorkout({
					id: WORKOUT_ID,
					durationMin: 62,
					kcalBurned: 180,
					kcalSource: 'MANUAL',
					exercises: [
						makeExercise({ id: '0199b3a4-0000-7000-8000-0000000000a1', name: 'Жим лежачи' }),
						cardio,
					],
				}),
			),
		)
		renderAt(getTrainingSessionPath(WORKOUT_ID))

		expect(await screen.findByRole('heading', { name: 'Зал · 62 хв' })).toBeTruthy()
		expect(screen.getByText('Вправ · підходів')).toBeTruthy()
		expect(screen.getByText('1 · 3')).toBeTruthy()
		expect(screen.getByText('Жим лежачи')).toBeTruthy()
		expect(screen.getByText('1 вправа · 3 підх.')).toBeTruthy()
		expect(screen.getByText('180 ккал · зі слів · на ціль не впливає')).toBeTruthy()
		expect(screen.getByRole('button', { name: /Видалити тренування/ })).toBeTruthy()
	})

	it('has no duration tile and no strength tile when there is nothing to show', async () => {
		getMock.mockResolvedValue(
			reply(makeWorkout({ id: WORKOUT_ID, durationMin: null, exercises: [cardio] })),
		)
		renderAt(getTrainingSessionPath(WORKOUT_ID))

		await screen.findByText('Бігова доріжка')
		expect(screen.queryByText('Тривалість')).toBeNull()
		expect(screen.queryByText('Вправ · підходів')).toBeNull()
		expect(screen.queryByText('ккал', { exact: false })).toBeNull()
	})

	it('says the training is gone on a 404', async () => {
		const error = new AxiosError('not found', '404', undefined, undefined, {
			status: 404,
			data: { statusCode: 404, errorCode: 'WORKOUT_NOT_FOUND', details: {} },
			statusText: 'Not Found',
			headers: {},
			config: { headers: new AxiosHeaders() },
		})
		getMock.mockRejectedValue(error)
		renderAt(getTrainingSessionPath(WORKOUT_ID))

		expect(await screen.findByText('Такого тренування немає')).toBeTruthy()
	})

	it('does not ask the API for an id that is no uuid', () => {
		renderAt('/app/training/not-a-uuid')
		expect(screen.getByText('Такого тренування немає')).toBeTruthy()
		expect(getMock).not.toHaveBeenCalled()
	})

	it('shows an inline error with a retry when the load fails', async () => {
		getMock.mockRejectedValue(new AxiosError('offline'))
		renderAt(getTrainingSessionPath(WORKOUT_ID))

		expect(await screen.findByText('Не вдалося завантажити тренування.')).toBeTruthy()
		expect(screen.getByRole('button', { name: 'Повторити' })).toBeTruthy()
	})
})
