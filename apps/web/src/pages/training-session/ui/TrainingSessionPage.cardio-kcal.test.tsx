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

const makeCardio = (overrides = {}) =>
	makeExercise({
		id: '0199b3a4-0000-7000-8000-0000000000c1',
		name: 'Бігова доріжка',
		kind: 'CARDIO',
		muscleGroup: null,
		durationMin: 15,
		distanceM: 2100,
		sets: [],
		...overrides,
	})

const renderSession = (overrides: Partial<WorkoutResponse>) => {
	const response: AxiosResponse = {
		data: { data: makeWorkout({ id: WORKOUT_ID, ...overrides }) },
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

describe('TrainingSessionPage: kcal of a cardio exercise', () => {
	it("shows the exercise's own number in its card, with the source", async () => {
		renderSession({
			exercises: [makeExercise(), makeCardio({ kcalBurned: 180, kcalSource: 'DEVICE' })],
			kcal: { value: 400, source: 'ESTIMATE' },
		})

		expect(await screen.findByText('180 ккал · з табло · на ціль не впливає')).toBeTruthy()
		expect(screen.getByRole('button', { name: /≈ 400 ккал · оцінка/ })).toBeTruthy()
	})

	it('shows no kcal row for a cardio exercise without its own number', async () => {
		renderSession({ exercises: [makeCardio()], kcal: null })

		await screen.findByText('Бігова доріжка')
		expect(screen.queryByText(/на ціль не впливає/)).toBeNull()
	})

	// A workout whose only number is the cardio exercise's: the backend's workout `kcal` is that same
	// number, so the header line and the card would both say «180 ккал». The rule is: once.
	it('does not say the same number in the header and again in the cardio card', async () => {
		renderSession({
			exercises: [makeCardio({ kcalBurned: 180, kcalSource: 'DEVICE' })],
			kcal: { value: 180, source: 'DEVICE' },
		})

		await screen.findByText('Бігова доріжка')
		expect(screen.getAllByText(/180 ккал/)).toHaveLength(1)
	})

	it('an estimated header and a named cardio: the header says the estimate, the card its own number', async () => {
		renderSession({
			exercises: [makeCardio({ kcalBurned: 180, kcalSource: 'DEVICE' })],
			kcal: { value: 180, source: 'ESTIMATE' },
		})

		expect(await screen.findByText('180 ккал · з табло · на ціль не впливає')).toBeTruthy()
		expect(screen.getByRole('button', { name: /≈ 180 ккал · оцінка/ })).toBeTruthy()
	})

	it('two named cardio exercises: the header is the sum, both cards keep their own number', async () => {
		renderSession({
			exercises: [
				makeCardio({ kcalBurned: 180, kcalSource: 'DEVICE' }),
				makeCardio({
					id: '0199b3a4-0000-7000-8000-0000000000c2',
					name: 'Велотренажер',
					kcalBurned: 200,
					kcalSource: 'MANUAL',
				}),
			],
			kcal: { value: 380, source: 'MANUAL' },
		})

		expect(await screen.findByText('180 ккал · з табло · на ціль не впливає')).toBeTruthy()
		expect(screen.getByText('200 ккал · зі слів · на ціль не впливає')).toBeTruthy()
		expect(screen.getByRole('button', { name: /380 ккал · зі слів/ })).toBeTruthy()
	})

	it('a workout-level named number with no number on the exercise stays once, in the header', async () => {
		renderSession({
			exercises: [makeCardio()],
			kcal: { value: 380, source: 'MANUAL' },
			kcalBurned: 380,
			kcalSource: 'MANUAL',
		})

		await screen.findByText('Бігова доріжка')
		expect(screen.getAllByText(/380 ккал/)).toHaveLength(1)
	})
})
