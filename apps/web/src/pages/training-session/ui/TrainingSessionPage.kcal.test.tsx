// @vitest-environment jsdom
import type { WorkoutResponse } from '@kus/shared'
import { QueryClient } from '@tanstack/react-query'
import { cleanup, screen } from '@testing-library/react'
import { AxiosHeaders, type AxiosResponse } from 'axios'
import { Route, Routes } from 'react-router'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { httpClient } from '@/shared/api'
import { getTrainingSessionPath, TRAINING_SESSION_ROUTE } from '@/shared/config'
import { makeExercise, makeWorkout, renderWithProviders } from '@/shared/testing'

import { TrainingSessionPage } from './TrainingSessionPage'

const getMock = vi.spyOn(httpClient, 'get')
const WORKOUT_ID = '0199b3a4-0000-7000-8000-0000000000f1'

const cardio = makeExercise({
	id: '0199b3a4-0000-7000-8000-0000000000c1',
	name: 'Бігова доріжка',
	kind: 'CARDIO',
	muscleGroup: null,
	durationMin: 15,
	distanceM: 2100,
	sets: [],
})

const renderSession = (overrides: Partial<WorkoutResponse>) => {
	const response: AxiosResponse = {
		data: { data: makeWorkout({ id: WORKOUT_ID, exercises: [cardio], ...overrides }) },
		status: 200,
		statusText: 'OK',
		headers: {},
		config: { headers: new AxiosHeaders() },
	}
	getMock.mockResolvedValue(response)
	return renderWithProviders(
		<Routes>
			<Route path={TRAINING_SESSION_ROUTE} element={<TrainingSessionPage />} />
		</Routes>,
		{
			route: getTrainingSessionPath(WORKOUT_ID),
			queryClient: new QueryClient({ defaultOptions: { queries: { retry: false } } }),
		},
	)
}

afterEach(() => {
	cleanup()
	vi.clearAllMocks()
})

describe('TrainingSessionPage kcal', () => {
	it('shows an estimate once, under the date, and opens the explanation', async () => {
		renderSession({ kcal: { value: 350, source: 'ESTIMATE' } })

		const line = await screen.findByRole('button', { name: /Ккал на тренуванні — як рахуємо/ })
		expect(line.textContent).toBe('≈ 350 ккал · оцінка')
		expect(screen.getAllByText(/350 ккал/)).toHaveLength(1)
	})

	it('shows no kcal anywhere without a number', async () => {
		renderSession({ kcal: null })

		await screen.findByText('Бігова доріжка')
		expect(screen.queryByText(/ккал/)).toBeNull()
		expect(screen.queryByRole('button', { name: /Ккал на тренуванні/ })).toBeNull()
	})

	// a named number reaches the screen both as `kcal` (MANUAL / DEVICE) and as `kcalBurned`
	it('shows a number the person named once, not in the header and again in the cardio card', async () => {
		renderSession({
			kcal: { value: 380, source: 'MANUAL' },
			kcalBurned: 380,
			kcalSource: 'MANUAL',
		})

		await screen.findByText('Бігова доріжка')
		expect(screen.getAllByText(/380 ккал/)).toHaveLength(1)
	})
})
