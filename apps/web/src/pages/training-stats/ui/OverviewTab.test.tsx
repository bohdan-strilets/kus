// @vitest-environment jsdom
import { cleanup, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import { makeWorkoutStats, renderWithProviders } from '@/shared/testing'

import { OverviewTab } from './OverviewTab'

afterEach(cleanup)

const base = makeWorkoutStats()

describe('OverviewTab: total duration', () => {
	it('shows a dash with the screen-reader note «Тривалість невідома» when no duration is known', () => {
		const stats = {
			...base,
			overview: { ...base.overview, workoutCount: 3, durationMin: 0, avgDurationMin: null },
		}

		renderWithProviders(<OverviewTab stats={stats} period="month" />)

		expect(screen.getByText('Тривалість невідома').className).toContain('sr-only')
		expect(screen.getByText('—')).toBeTruthy()
	})

	it('has no such note when the duration is known', () => {
		renderWithProviders(<OverviewTab stats={base} period="month" />)

		expect(screen.queryByText('Тривалість невідома')).toBeNull()
		expect(screen.getByText('5 год 10 хв')).toBeTruthy()
	})

	it('has no such note for an empty period', () => {
		const stats = {
			...base,
			overview: {
				...base.overview,
				workoutCount: 0,
				avgPerWeek: null,
				durationMin: 0,
				avgDurationMin: null,
				buckets: [],
			},
			exercises: [],
		}

		renderWithProviders(<OverviewTab stats={stats} period="month" />)

		expect(screen.queryByText('Тривалість невідома')).toBeNull()
	})
})
