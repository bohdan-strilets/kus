// @vitest-environment jsdom
import type { LiveWorkoutResponse } from '@kus/shared'
import { QueryClient } from '@tanstack/react-query'
import { cleanup, fireEvent, screen } from '@testing-library/react'
import { AxiosHeaders, type AxiosResponse } from 'axios'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { httpClient } from '@/shared/api'
import { TRAINING_LIVE_ROUTE } from '@/shared/config'
import { makeLiveResponse, makePlanExercise, renderWithProviders } from '@/shared/testing'

import { TrainingLivePage } from './TrainingLivePage'

const getMock = vi.spyOn(httpClient, 'get')
const putMock = vi.spyOn(httpClient, 'put')

const NEXT_PREFIX = 'далі ·'
const WORKOUT_ID = '0199b3a4-0000-7000-8000-000000000a51'

const reply = (data: unknown): AxiosResponse => ({
	data: { data },
	status: 200,
	statusText: 'OK',
	headers: {},
	config: { headers: new AxiosHeaders() },
})

const planOf = (n: number, name: string) =>
	makePlanExercise({
		templateExerciseId: `0199b3a4-0000-7000-8000-0000000000c${n}`,
		name,
		sets: 3,
	})

let current: LiveWorkoutResponse

beforeEach(() => {
	const live = makeLiveResponse({
		plan: [planOf(1, 'Присідання'), planOf(2, 'Станова'), planOf(3, 'Жим')],
	})
	current = { ...live, workout: { ...live.workout, id: WORKOUT_ID } }
	getMock.mockImplementation((url: string) =>
		Promise.resolve(reply(url === '/live-workouts/current' ? current : [])),
	)
	putMock.mockImplementation(() => Promise.resolve(reply(current)))
})

afterEach(() => {
	cleanup()
	vi.clearAllMocks()
})

describe('LiveScreen: the «далі · …» row', () => {
	it('after the last exercise it wraps to the first one skipped, not to a later one', async () => {
		renderWithProviders(<TrainingLivePage />, {
			route: TRAINING_LIVE_ROUTE,
			queryClient: new QueryClient({ defaultOptions: { queries: { retry: false } } }),
		})

		fireEvent.click(await screen.findByRole('button', { name: /^Жим/ }))

		expect(screen.getByRole('button', { name: /^Присідання/ }).textContent).toContain(NEXT_PREFIX)
		expect(screen.getByRole('button', { name: /^Станова/ }).textContent).not.toContain(NEXT_PREFIX)
	})
})
