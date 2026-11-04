// @vitest-environment jsdom
import type { ExerciseStatsResponse } from '@kus/shared'
import { cleanup, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import { makeBodyweightStats, makeWeightedStats, renderWithProviders } from '@/shared/testing'

import { HistoryCard } from './HistoryCard'

type HistoryItem = ExerciseStatsResponse['history'][number]
type SetItem = HistoryItem['sets'][number]

const RECORD_TEXT = 'рекорд'

const makeSet = (overrides: Partial<SetItem>): SetItem => ({
	reps: 5,
	weightKg: null,
	durationSec: null,
	distanceM: null,
	isWarmup: false,
	doneAt: null,
	...overrides,
})

const makeItem = (workoutId: string, localDate: string, overrides: Partial<HistoryItem>) => ({
	workoutId,
	localDate,
	record: null,
	sets: [],
	...overrides,
})

const getRows = (): HTMLElement[] => screen.getAllByRole('listitem')

afterEach(cleanup)

describe('HistoryCard record highlight', () => {
	it('marks only the heaviest working set of the record workout, not a warm-up', () => {
		const history: HistoryItem[] = [
			makeItem('w3', '2026-10-26', { sets: [makeSet({ reps: 8, weightKg: 60 })] }),
			makeItem('w2', '2026-10-19', {
				record: 'WEIGHT',
				sets: [
					makeSet({ reps: 10, weightKg: 40, isWarmup: true, doneAt: null }),
					makeSet({ reps: 8, weightKg: 60 }),
					makeSet({ reps: 5, weightKg: 70 }),
				],
			}),
			makeItem('w1', '2026-10-05', { sets: [makeSet({ reps: 8, weightKg: 60 })] }),
		]
		renderWithProviders(<HistoryCard history={history} kind="STRENGTH" />)

		expect(screen.getAllByText(RECORD_TEXT)).toHaveLength(1)

		const rows = getRows()
		const newest = rows[0] as HTMLElement
		const middle = rows[1] as HTMLElement
		const oldest = rows[2] as HTMLElement
		expect(within(newest).queryByText(RECORD_TEXT)).toBeNull()
		expect(within(oldest).queryByText(RECORD_TEXT)).toBeNull()

		const marker = within(middle).getByText(RECORD_TEXT)
		expect(marker.parentElement?.textContent).toContain('70 кг × 5')
		expect(marker.parentElement?.textContent).not.toContain('60 кг × 8')
		expect(marker.parentElement?.textContent).not.toContain('40 кг × 10')
	})

	it('marks the set with the most reps for a bodyweight record', () => {
		const stats = makeBodyweightStats()
		const history: HistoryItem[] = [
			{
				...(stats.history[0] as HistoryItem),
				record: 'REPS',
				sets: [makeSet({ reps: 7 }), makeSet({ reps: 10 }), makeSet({ reps: 8 })],
			},
		]
		renderWithProviders(<HistoryCard history={history} kind="STRENGTH" />)

		expect(screen.getAllByText(RECORD_TEXT)).toHaveLength(1)
		const marker = screen.getByText(RECORD_TEXT)
		expect(marker.parentElement?.textContent).toContain('10')
		expect(marker.parentElement?.textContent).not.toContain('8')
		expect(marker.parentElement?.textContent).not.toContain('7')
	})

	it('shows no record segment when the record is null everywhere', () => {
		renderWithProviders(<HistoryCard history={makeWeightedStats().history} kind="STRENGTH" />)

		expect(getRows()).toHaveLength(2)
		expect(screen.queryByText(RECORD_TEXT)).toBeNull()
	})
})
