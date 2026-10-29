// @vitest-environment jsdom
import type { WorkoutResponse } from '@kus/shared'
import { cleanup, screen, waitFor } from '@testing-library/react'
import { AxiosHeaders, type AxiosResponse } from 'axios'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { httpClient } from '@/shared/api'
import { makeExercise, makeWorkout, renderWithProviders } from '@/shared/testing'

import { DayWorkouts } from './DayWorkouts'

const getMock = vi.spyOn(httpClient, 'get')

const reply = (workouts: WorkoutResponse[]): AxiosResponse => ({
	data: { data: workouts },
	status: 200,
	statusText: 'OK',
	headers: {},
	config: { headers: new AxiosHeaders() },
})

afterEach(() => {
	cleanup()
	vi.clearAllMocks()
})

describe('DayWorkouts', () => {
	it('shows a row with the place, the exercises and the time, and no kcal', async () => {
		getMock.mockResolvedValue(
			reply([
				makeWorkout({
					kcalBurned: 320,
					kcalSource: 'DEVICE',
					exercises: [makeExercise(), makeExercise({ name: 'Присідання' })],
				}),
			]),
		)

		renderWithProviders(<DayWorkouts localDate="2026-10-26" />)

		expect(await screen.findByText('Зал: жим лежачи, присідання')).toBeTruthy()
		expect(screen.getByText('55 хв')).toBeTruthy()
		expect(screen.queryByText(/ккал/)).toBeNull()
		expect(screen.getByRole('link').getAttribute('href')).toBe('/app/training')
		expect(getMock).toHaveBeenCalledWith('/workouts/day/2026-10-26')
	})

	it('draws nothing for a day without trainings', async () => {
		getMock.mockResolvedValue(reply([]))

		const { container } = renderWithProviders(<DayWorkouts localDate="2026-10-26" />)

		await waitFor(() => {
			expect(getMock).toHaveBeenCalled()
		})
		expect(container.querySelector('ul')).toBeNull()
	})

	it('draws nothing when the read fails', async () => {
		getMock.mockRejectedValue(new Error('network'))

		const { container } = renderWithProviders(<DayWorkouts localDate="2026-10-26" />)

		await waitFor(() => {
			expect(getMock).toHaveBeenCalled()
		})
		expect(container.querySelector('ul')).toBeNull()
		expect(screen.queryByRole('alert')).toBeNull()
	})
})
