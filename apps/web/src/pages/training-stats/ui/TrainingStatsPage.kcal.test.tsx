// @vitest-environment jsdom
import type { WorkoutStatsResponse } from '@kus/shared'
import { cleanup, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AxiosHeaders, type AxiosResponse } from 'axios'
import { Route, Routes } from 'react-router'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { httpClient } from '@/shared/api'
import { TRAINING_STATS_ROUTE } from '@/shared/config'
import { makeWorkoutStats, renderWithProviders } from '@/shared/testing'

import { TrainingStatsPage } from './TrainingStatsPage'

const getMock = vi.spyOn(httpClient, 'get')

const reply = (stats: WorkoutStatsResponse): AxiosResponse => ({
	data: { data: stats },
	status: 200,
	statusText: 'OK',
	headers: {},
	config: { headers: new AxiosHeaders() },
})

const renderStats = (burned: WorkoutStatsResponse['overview']['burned']) => {
	const stats = makeWorkoutStats()
	getMock.mockResolvedValue(reply({ ...stats, overview: { ...stats.overview, burned } }))
	return renderWithProviders(
		<Routes>
			<Route path={TRAINING_STATS_ROUTE} element={<TrainingStatsPage />} />
		</Routes>,
		{ route: TRAINING_STATS_ROUTE },
	)
}

afterEach(() => {
	cleanup()
	vi.clearAllMocks()
})

describe('TrainingStatsPage kcal', () => {
	it('shows the estimated total in the overview, with the note that it does not touch the goal', async () => {
		renderStats({ kcal: 2100, isEstimate: true })

		expect(await screen.findByText(/^Спалено на тренуваннях за/)).toBeTruthy()
		expect(screen.getByText(/^≈ 2\s100 ккал$/)).toBeTruthy()
		expect(screen.getByText('оцінка · на ціль не впливає')).toBeTruthy()
	})

	it('shows no tile when nothing burned is known', async () => {
		renderStats(null)

		await screen.findByRole('heading', { name: 'Статистика' })
		await screen.findByText('Огляд')
		expect(screen.queryByText(/^Спалено на тренуваннях/)).toBeNull()
		expect(screen.queryByText(/на ціль не впливає/)).toBeNull()
	})

	it('keeps the cardio tab free of the old «ккал названо» row', async () => {
		const user = userEvent.setup()
		renderStats({ kcal: 2100, isEstimate: true })

		await user.click(await screen.findByRole('tab', { name: 'Кардіо' }))

		await screen.findByText('Бігова доріжка')
		expect(screen.queryByText(/ккал названо/)).toBeNull()
		expect(screen.queryByText(/названо/)).toBeNull()
	})
})
