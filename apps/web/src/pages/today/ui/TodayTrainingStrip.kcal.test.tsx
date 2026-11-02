// @vitest-environment jsdom
import type { DayResponse, WorkoutKcal, WorkoutResponse } from '@kus/shared'
import type { UseQueryResult } from '@tanstack/react-query'
import { cleanup, screen, waitFor } from '@testing-library/react'
import { AxiosHeaders, type AxiosResponse } from 'axios'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'

import { httpClient } from '@/shared/api'
import { i18n } from '@/shared/i18n'
import { makeExercise, makeWorkout, renderWithProviders } from '@/shared/testing'

import { getTrainingStripView } from '../lib/get-training-strip-view'
import { DayContent } from './DayContent'
import { TodayTrainingStrip } from './TodayTrainingStrip'

const t = i18n.t.bind(i18n)
const TODAY = '2026-10-18'
const GAUGE_COUNT_UP_TIMEOUT_MS = { timeout: 5000 }
const ESTIMATE: WorkoutKcal = { value: 350, source: 'ESTIMATE' }
const STARTED = '2026-10-18T07:10:00.000Z'

const groups = (...keys: ('CHEST' | 'BACK' | 'LEGS' | 'SHOULDERS' | 'ARMS')[]) =>
	keys.map((key) => makeExercise({ muscleGroup: key }))

const dotsOf = (container: HTMLElement): number =>
	container.querySelectorAll('span[aria-hidden="true"].flex > span').length

afterEach(cleanup)

describe('TodayTrainingStrip kcal', () => {
	it('shows the estimate after the duration, with «≈»', () => {
		renderWithProviders(
			<TodayTrainingStrip
				workouts={[makeWorkout({ durationMin: 62, kcal: ESTIMATE, exercises: groups('CHEST') })]}
			/>,
		)

		const strip = screen.getByRole('link')
		expect(strip.textContent).toContain('Тренування · 62 хв')
		expect(strip.textContent).toContain('· ≈ 350 ккал')
	})

	it('shows a named number without «≈»', () => {
		renderWithProviders(
			<TodayTrainingStrip
				workouts={[
					makeWorkout({ durationMin: 62, kcal: { value: 380, source: 'MANUAL' }, exercises: [] }),
				]}
			/>,
		)

		const strip = screen.getByRole('link')
		expect(strip.textContent).toContain('380 ккал')
		expect(strip.textContent).not.toContain('≈')
	})

	it('adds nothing when there is no kcal', () => {
		renderWithProviders(
			<TodayTrainingStrip workouts={[makeWorkout({ durationMin: 62, kcal: null })]} />,
		)

		expect(screen.getByRole('link').textContent).not.toContain('ккал')
	})

	it('puts the kcal into the spoken label', () => {
		renderWithProviders(
			<TodayTrainingStrip
				workouts={[makeWorkout({ durationMin: 62, kcal: ESTIMATE, exercises: groups('CHEST') })]}
			/>,
		)

		expect(
			screen.getByRole('link', { name: 'Тренування, 62 хв, ≈ 350 ккал: груди — відкрити' }),
		).toBeTruthy()
	})

	it('draws up to four dots with kcal and all of them without', () => {
		const five = groups('CHEST', 'BACK', 'LEGS', 'SHOULDERS', 'ARMS')
		const withKcal = renderWithProviders(
			<TodayTrainingStrip workouts={[makeWorkout({ kcal: ESTIMATE, exercises: five })]} />,
		)
		expect(dotsOf(withKcal.container)).toBe(4)
		cleanup()

		const without = renderWithProviders(
			<TodayTrainingStrip workouts={[makeWorkout({ kcal: null, exercises: five })]} />,
		)
		expect(dotsOf(without.container)).toBe(5)
	})

	it('draws up to three dots with kcal and the start next to other trainings', () => {
		const five = groups('CHEST', 'BACK', 'LEGS', 'SHOULDERS', 'ARMS')
		const { container } = renderWithProviders(
			<TodayTrainingStrip
				workouts={[
					makeWorkout({ id: 'a', startedAt: STARTED, kcal: ESTIMATE, exercises: five }),
					makeWorkout({ id: 'b', startedAt: '2026-10-18T17:10:00.000Z', exercises: [] }),
				]}
			/>,
		)

		expect(dotsOf(container)).toBe(3)
	})
})

describe('getTrainingStripView kcal', () => {
	it('limits the groups by what the plate carries and keeps the others in the label', () => {
		const five = groups('CHEST', 'BACK', 'LEGS', 'SHOULDERS', 'ARMS')
		const base = makeWorkout({ startedAt: STARTED, exercises: five })

		expect(getTrainingStripView(base, t, true).groups).toHaveLength(5)
		expect(getTrainingStripView({ ...base, kcal: ESTIMATE }, t, false).groups).toHaveLength(4)
		expect(getTrainingStripView({ ...base, kcal: ESTIMATE }, t, true).groups).toHaveLength(3)
		expect(getTrainingStripView({ ...base, kcal: null }, t, true).groups).toHaveLength(5)
	})

	it('gives the kcal as a value, null without a number', () => {
		expect(getTrainingStripView(makeWorkout({ kcal: ESTIMATE }), t, false).kcal).toBe('≈ 350 ккал')
		expect(getTrainingStripView(makeWorkout({ kcal: null }), t, false).kcal).toBeNull()
	})
})

describe('the day with a training that has kcal', () => {
	const getMock = vi.spyOn(httpClient, 'get')

	const answer = (workouts: WorkoutResponse[]): AxiosResponse => ({
		data: { data: workouts },
		status: 200,
		statusText: 'OK',
		headers: {},
		config: { headers: new AxiosHeaders() },
	})

	const query = {
		isPending: false,
		isError: false,
		data: {
			localDate: TODAY,
			meals: [],
			totals: { kcal: 525, protein: 52, carbs: 47, fat: 12, fiber: 0 },
			goal: { kcal: 2200, protein: 140, carbs: 230, fat: 80 },
			remainingKcal: 1675,
		},
	} as unknown as UseQueryResult<DayResponse>

	beforeAll(() => {
		Object.defineProperty(window.SVGElement.prototype, 'getTotalLength', {
			configurable: true,
			value: () => 100,
		})
	})

	afterEach(() => {
		getMock.mockReset()
	})

	// the backend counts the goal; a workout, however big, must not move «лишилось» or the ring
	it('leaves the calories left and the ring as the backend counted them', async () => {
		getMock.mockResolvedValue(
			answer([
				makeWorkout({ kcal: { value: 5000, source: 'ESTIMATE' }, exercises: groups('CHEST') }),
			]),
		)

		const { container } = renderWithProviders(
			<DayContent
				query={query}
				localDate={TODAY}
				today={TODAY}
				onGoalClick={vi.fn()}
				onEmptyAction={vi.fn()}
			/>,
		)

		await waitFor(() => {
			expect(screen.getByText(/≈ 5\s000 ккал/)).toBeTruthy()
		})
		// the gauge counts the number up from 0, so wait for the final value
		await waitFor(() => {
			expect(screen.getByText(/^1\s675$/)).toBeTruthy()
		}, GAUGE_COUNT_UP_TIMEOUT_MS)
		expect(screen.getByText('ккал лишилось')).toBeTruthy()
		expect(container.textContent).not.toMatch(/6\s675|-3\s325|−3\s325/)
	})
})
