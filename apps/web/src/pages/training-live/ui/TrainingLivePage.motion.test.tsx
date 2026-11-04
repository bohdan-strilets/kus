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

const FIRST = 'Жим лежачи'
const SECOND = 'Присідання'
const SETS_PER_EXERCISE = 3

const reply = (data: unknown): AxiosResponse => ({
	data: { data },
	status: 200,
	statusText: 'OK',
	headers: {},
	config: { headers: new AxiosHeaders() },
})

let sequence = 0
let current: LiveWorkoutResponse | null = null

const renderPage = () => {
	const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
	return renderWithProviders(<TrainingLivePage />, { route: TRAINING_LIVE_ROUTE, queryClient })
}

const isTitle = (element: Element | null): boolean =>
	element?.hasAttribute('data-live-exercise-title') === true

beforeEach(() => {
	sequence += 1
	const base = makeLiveResponse({
		templateName: 'Верх А',
		plan: [
			makePlanExercise({ sets: SETS_PER_EXERCISE }),
			makePlanExercise({
				templateExerciseId: '0199b3a4-0000-7000-8000-0000000000b2',
				name: SECOND,
				muscleGroup: 'LEGS',
				sets: SETS_PER_EXERCISE,
			}),
		],
	})
	current = {
		...base,
		workout: {
			...base.workout,
			id: `0199b3a4-0000-7000-8000-${String(700 + sequence).padStart(12, '0')}`,
		},
	}
	getMock.mockImplementation((url: string) =>
		Promise.resolve(reply(url === '/live-workouts/current' ? current : [])),
	)
	putMock.mockImplementation(() => Promise.resolve(reply(current)))
})

afterEach(() => {
	cleanup()
	vi.clearAllMocks()
})

describe('TrainingLivePage: the hand moves to the next exercise', () => {
	it('nothing is focused on open (the title does not steal the focus)', async () => {
		renderPage()

		await screen.findByText(FIRST)

		expect(isTitle(document.activeElement)).toBe(false)
	})

	it('the last set of the current exercise done: the focus goes to the next exercise title', async () => {
		renderPage()
		await screen.findByText(FIRST)

		for (let n = 0; n < SETS_PER_EXERCISE; n += 1) {
			fireEvent.click(await screen.findByRole('button', { name: 'Підхід виконано' }))
		}

		await waitFor(() => {
			expect(isTitle(document.activeElement)).toBe(true)
		})
		expect(document.activeElement?.textContent).toBe(SECOND)
	})

	it('a set that is not the last one leaves the focus where it was', async () => {
		renderPage()
		await screen.findByText(FIRST)

		fireEvent.click(await screen.findByRole('button', { name: 'Підхід виконано' }))

		await screen.findByText(FIRST)
		expect(isTitle(document.activeElement)).toBe(false)
	})

	it('tapping another exercise row moves the focus to its title', async () => {
		renderPage()
		await screen.findByText(FIRST)

		fireEvent.click(await screen.findByRole('button', { name: new RegExp(`^${SECOND}`) }))

		await waitFor(() => {
			expect(isTitle(document.activeElement)).toBe(true)
		})
		expect(document.activeElement?.textContent).toBe(SECOND)
	})
})

describe('TrainingLivePage: deleting the exercise in hand', () => {
	it('the focus is not taken by the title of the exercise that took its place', async () => {
		renderPage()
		await screen.findByText(FIRST)
		fireEvent.click(await screen.findByRole('button', { name: new RegExp(`^${SECOND}`) }))
		await waitFor(() => {
			expect(document.activeElement?.textContent).toBe(SECOND)
		})

		fireEvent.click(screen.getByRole('button', { name: `Видалити вправу «${SECOND}»` }))

		await waitFor(() => {
			expect(screen.queryByText(SECOND)).toBeNull()
		})
		await waitFor(() => {
			expect(isTitle(document.activeElement)).toBe(false)
		})
		expect(document.activeElement).not.toBe(document.body)
	})
})
