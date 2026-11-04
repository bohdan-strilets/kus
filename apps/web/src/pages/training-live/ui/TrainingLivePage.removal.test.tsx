// @vitest-environment jsdom
import type { LiveWorkoutResponse, LiveWorkoutUpdate } from '@kus/shared'
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

const reply = (data: unknown): AxiosResponse => ({
	data: { data },
	status: 200,
	statusText: 'OK',
	headers: {},
	config: { headers: new AxiosHeaders() },
})

let sequence = 0
let workoutId = ''
let current: LiveWorkoutResponse | null = null

const renderPage = () => {
	const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
	return renderWithProviders(<TrainingLivePage />, { route: TRAINING_LIVE_ROUTE, queryClient })
}

const bodyAt = (call: number): LiveWorkoutUpdate =>
	putMock.mock.calls[call]?.[1] as LiveWorkoutUpdate

const waitForPuts = async (count: number): Promise<void> => {
	await waitFor(() => {
		expect(putMock).toHaveBeenCalledTimes(count)
	})
}

beforeEach(() => {
	sequence += 1
	workoutId = `0199b3a4-0000-7000-8000-${String(800 + sequence).padStart(12, '0')}`
	const base = makeLiveResponse({ templateName: 'Верх А', plan: [makePlanExercise()] })
	current = { ...base, workout: { ...base.workout, id: workoutId } }
	getMock.mockImplementation((url: string) =>
		Promise.resolve(reply(url === '/live-workouts/current' ? current : [])),
	)
	putMock.mockImplementation(() => Promise.resolve(reply(current)))
})

afterEach(() => {
	cleanup()
	vi.clearAllMocks()
})

describe('TrainingLivePage: deleting a set', () => {
	it('the basket removes the set at once (PUT), the toast names it, «Скасувати» brings it back', async () => {
		renderPage()
		await screen.findByText('Підхід 1')

		fireEvent.click(screen.getByRole('button', { name: 'Видалити підхід 1' }))

		await waitForPuts(1)
		expect(bodyAt(0).exercises[0]?.sets).toHaveLength(2)
		expect(await screen.findByText('Підхід 1 видалено')).toBeTruthy()
		expect(screen.getByText('Мета: 3 підходи · 8–10 повт. · 50 кг')).toBeTruthy()

		fireEvent.click(screen.getByRole('button', { name: 'Скасувати' }))

		await waitForPuts(2)
		expect(bodyAt(1).exercises[0]?.sets).toHaveLength(3)
		expect(bodyAt(1).exercises[0]?.clientKey).toBe(bodyAt(0).exercises[0]?.clientKey)
		expect(await screen.findByText('Підхід 1')).toBeTruthy()
		expect(screen.getByRole('button', { name: 'Підхід виконано' })).toBeTruthy()
	})

	it('a warm-up gets «Розминку видалено»', async () => {
		renderPage()
		await screen.findByText('Підхід 1')
		fireEvent.click(screen.getByRole('button', { name: '+ Розминка' }))
		await screen.findByRole('group', { name: 'Розминка, підхід 1' })

		fireEvent.click(screen.getByRole('button', { name: 'Видалити розминку' }))

		expect(await screen.findByText('Розминку видалено')).toBeTruthy()
	})
})

describe('TrainingLivePage: deleting an exercise', () => {
	it('the basket sends the session without it; «Скасувати» sends it back with the same key and sets', async () => {
		renderPage()
		fireEvent.click(await screen.findByRole('button', { name: 'Підхід виконано' }))
		await waitForPuts(1)
		const key = bodyAt(0).exercises[0]?.clientKey
		expect(key).toBeTruthy()

		fireEvent.click(screen.getByRole('button', { name: 'Видалити вправу «Жим лежачи»' }))

		await waitForPuts(2)
		expect(bodyAt(1).exercises).toEqual([])
		expect(await screen.findByText('Вправу видалено')).toBeTruthy()

		fireEvent.click(screen.getByRole('button', { name: 'Скасувати' }))

		await waitForPuts(3)
		const restored = bodyAt(2).exercises
		expect(restored.map(({ clientKey }) => clientKey)).toEqual([key])
		expect(restored[0]?.sets).toHaveLength(3)
		expect(restored[0]?.sets[0]?.doneAt).not.toBeNull()
		expect(await screen.findByText('Жим лежачи')).toBeTruthy()
	})
})
