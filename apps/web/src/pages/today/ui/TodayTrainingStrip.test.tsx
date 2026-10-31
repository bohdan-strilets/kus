// @vitest-environment jsdom
import { cleanup, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import { makeExercise, makeWorkout, renderWithProviders } from '@/shared/testing'

import { TodayTrainingStrip } from './TodayTrainingStrip'

afterEach(cleanup)

const cardio = makeExercise({ kind: 'CARDIO', muscleGroup: null, name: 'Біг' })

describe('TodayTrainingStrip', () => {
	it('draws nothing for a quiet day', () => {
		const { container } = renderWithProviders(<TodayTrainingStrip workouts={[]} />)

		expect(container.querySelector('ul')).toBeNull()
	})

	it('shows the duration, links to the session and shows no kcal', () => {
		renderWithProviders(
			<TodayTrainingStrip
				workouts={[
					makeWorkout({ id: 'w1', durationMin: 62, kcalBurned: 320, exercises: [cardio] }),
				]}
			/>,
		)

		const link = screen.getByRole('link', { name: 'Тренування, 62 хв: кардіо — відкрити' })
		expect(link.getAttribute('href')).toBe('/app/training/w1')
		expect(screen.getByText('Тренування · 62 хв')).toBeTruthy()
		expect(screen.queryByText(/ккал/)).toBeNull()
	})

	it('marks an estimated duration with ≈', () => {
		renderWithProviders(
			<TodayTrainingStrip
				workouts={[makeWorkout({ durationMin: null, estimatedDurationMin: 62 })]}
			/>,
		)

		expect(screen.getByText('Тренування · ≈ 62 хв')).toBeTruthy()
	})

	it('shows only the title when there is no duration', () => {
		renderWithProviders(
			<TodayTrainingStrip
				workouts={[makeWorkout({ durationMin: null, estimatedDurationMin: null })]}
			/>,
		)

		expect(screen.getByText('Тренування')).toBeTruthy()
	})

	it('draws a strip per training in time order, each with its start', () => {
		renderWithProviders(
			<TodayTrainingStrip
				workouts={[
					makeWorkout({ id: 'late', startedAt: '2026-10-26T18:30:00.000Z', durationMin: 62 }),
					makeWorkout({ id: 'early', startedAt: '2026-10-26T07:10:00.000Z', durationMin: 31 }),
				]}
			/>,
		)

		const links = screen.getAllByRole('link')
		expect(links.map((link) => link.getAttribute('href'))).toEqual([
			'/app/training/early',
			'/app/training/late',
		])
		expect(screen.getAllByText(/^· \d{2}:\d{2}$/)).toHaveLength(2)
	})
})
