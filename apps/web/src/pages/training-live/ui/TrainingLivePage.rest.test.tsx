// @vitest-environment jsdom
import type { LiveWorkoutResponse } from '@kus/shared'
import { QueryClient } from '@tanstack/react-query'
import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react'
import { AxiosHeaders, type AxiosResponse } from 'axios'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { httpClient } from '@/shared/api'
import { TRAINING_LIVE_ROUTE } from '@/shared/config'
import { makeLiveResponse, makePlanExercise, renderWithProviders } from '@/shared/testing'

import { TrainingLivePage } from './TrainingLivePage'

const getMock = vi.spyOn(httpClient, 'get')
const putMock = vi.spyOn(httpClient, 'put')

const REST_NAME = /^Відпочинок, лишилось/
const SECOND_EXERCISE = '0199b3a4-0000-7000-8000-0000000000b2'

const reply = (data: unknown): AxiosResponse => ({
	data: { data },
	status: 200,
	statusText: 'OK',
	headers: {},
	config: { headers: new AxiosHeaders() },
})

let sequence = 0
let current: LiveWorkoutResponse | null = null

const withNewId = (live: LiveWorkoutResponse): LiveWorkoutResponse => {
	sequence += 1
	// a new session id per test: unsent snapshots outlive a screen on purpose
	return {
		...live,
		workout: {
			...live.workout,
			id: `0199b3a4-0000-7000-8000-${String(800 + sequence).padStart(12, '0')}`,
		},
	}
}

const renderPage = () => {
	const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
	return renderWithProviders(<TrainingLivePage />, { route: TRAINING_LIVE_ROUTE, queryClient })
}

beforeEach(() => {
	getMock.mockImplementation((url: string) =>
		Promise.resolve(reply(url === '/live-workouts/current' ? current : [])),
	)
	putMock.mockImplementation(() => Promise.resolve(reply(current)))
})

afterEach(() => {
	cleanup()
	vi.clearAllMocks()
})

describe('TrainingLivePage: the rest timer', () => {
	it('✓ of a set shows the rest panel, «Пропустити» hides it', async () => {
		current = withNewId(makeLiveResponse({ plan: [makePlanExercise({ sets: 3 })] }))
		renderPage()
		expect(screen.queryByRole('timer', { name: REST_NAME })).toBeNull()

		fireEvent.click(await screen.findByRole('button', { name: 'Підхід виконано' }))

		expect(await screen.findByRole('timer', { name: REST_NAME })).toBeTruthy()
		expect(screen.getByText('Відпочинок')).toBeTruthy()
		expect(screen.getByRole('timer', { name: REST_NAME }).getAttribute('aria-label')).toMatch(
			/^Відпочинок, лишилось \d+:\d{2}$/,
		)

		fireEvent.click(screen.getByRole('button', { name: 'Пропустити відпочинок' }))

		await waitFor(() => {
			expect(screen.queryByRole('timer', { name: REST_NAME })).toBeNull()
		})
	})

	it('the rest follows the plan: 90 s from the plan is shown as 1:30 or just under', async () => {
		current = withNewId(makeLiveResponse({ plan: [makePlanExercise({ sets: 3, restSec: 120 })] }))
		renderPage()

		fireEvent.click(await screen.findByRole('button', { name: 'Підхід виконано' }))

		const label = (await screen.findByRole('timer', { name: REST_NAME })).getAttribute('aria-label')
		expect(label).toMatch(/лишилось (2:00|1:5\d)$/)
	})

	it('✓ of the last set of the last exercise shows no panel', async () => {
		current = withNewId(makeLiveResponse({ plan: [makePlanExercise({ sets: 1 })] }))
		renderPage()

		fireEvent.click(await screen.findByRole('button', { name: 'Підхід виконано' }))
		await waitFor(() => {
			expect(putMock).toHaveBeenCalledTimes(1)
		})

		expect(screen.queryByRole('timer', { name: REST_NAME })).toBeNull()
		expect(screen.queryByText('Далі', { exact: false })).toBeNull()
	})

	it('the last set of the first exercise, with another exercise after it: the panel shows the other exercise', async () => {
		current = withNewId(
			makeLiveResponse({
				plan: [
					makePlanExercise({ sets: 1 }),
					makePlanExercise({ templateExerciseId: SECOND_EXERCISE, name: 'Присідання', sets: 2 }),
				],
			}),
		)
		renderPage()

		fireEvent.click(await screen.findByRole('button', { name: 'Підхід виконано' }))

		expect(await screen.findByRole('timer', { name: REST_NAME })).toBeTruthy()
		expect(screen.getByText(/^Далі: Присідання · /)).toBeTruthy()
	})
})

describe('TrainingLivePage: the rest timer and cardio', () => {
	it('✓ of a strength set, then a cardio with minutes: the panel goes away', async () => {
		current = withNewId(
			makeLiveResponse({
				plan: [
					makePlanExercise({ sets: 3 }),
					makePlanExercise({
						templateExerciseId: SECOND_EXERCISE,
						name: 'Доріжка',
						kind: 'CARDIO',
						muscleGroup: null,
						sets: null,
						repsMin: null,
						repsMax: null,
						weightKg: null,
						durationMin: 20,
					}),
				],
			}),
		)
		renderPage()

		fireEvent.click(await screen.findByRole('button', { name: 'Підхід виконано' }))
		expect(await screen.findByRole('timer', { name: REST_NAME })).toBeTruthy()

		fireEvent.click(screen.getByRole('button', { name: /^Доріжка/ }))
		fireEvent.click(screen.getByRole('button', { name: 'Більше хвилин' }))

		await waitFor(() => {
			expect(screen.queryByRole('timer', { name: REST_NAME })).toBeNull()
		})
	})
})

describe('TrainingLivePage: the Wake Lock strip', () => {
	const HINT = 'Екран може гаснути — тримай Kusik відкритим, щоб почути сигнал.'

	it('no timer: no strip in the flow; after the check it is inside the rest panel', async () => {
		expect('wakeLock' in navigator).toBe(false)
		current = withNewId(makeLiveResponse({ plan: [makePlanExercise({ sets: 3 })] }))
		renderPage()
		const done = await screen.findByRole('button', { name: 'Підхід виконано' })
		expect(screen.queryByText(HINT)).toBeNull()

		fireEvent.click(done)

		const timer = await screen.findByRole('timer', { name: REST_NAME })
		const strip = await screen.findByText(HINT)
		expect(timer.closest('section')?.contains(strip)).toBe(true)
	})
})
