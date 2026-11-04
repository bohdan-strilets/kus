import { describe, expect, it } from 'vitest'

import { i18n } from '@/shared/i18n'
import { makeBodyweightStats, makeWeightedStats } from '@/shared/testing'

import { formatExerciseSubtitle, getExerciseSeries, getRecordTiles } from './exercise-view'

const t = i18n.t.bind(i18n)

describe('getExerciseSeries', () => {
	const { points } = makeWeightedStats()
	const withGap = points.map((point, index) =>
		index === 0 ? { ...point, topWeightKg: null } : point,
	)

	it('takes the top weight or the reps, with the first and last date', () => {
		expect(getExerciseSeries(points, 'weight')).toEqual({
			values: [60, 70],
			firstDate: '2026-10-05',
			lastDate: '2026-10-26',
		})
		expect(getExerciseSeries(points, 'reps').values).toEqual([8, 5])
	})

	it('skips a point without the metric and is empty without points', () => {
		expect(getExerciseSeries(withGap, 'weight')).toEqual({
			values: [70],
			firstDate: '2026-10-26',
			lastDate: '2026-10-26',
		})
		expect(getExerciseSeries([], 'weight')).toEqual({ values: [], firstDate: null, lastDate: null })
	})
})

describe('formatExerciseSubtitle', () => {
	it('writes the group, the count of workouts and the start of the period', () => {
		expect(formatExerciseSubtitle(makeWeightedStats(), t)).toBe('Груди · 2 тренування з 1 жовтня')
	})

	it('adds «власна вага» for a bodyweight exercise and «Інше» for no group', () => {
		expect(formatExerciseSubtitle(makeBodyweightStats(), t)).toBe(
			'Спина · власна вага · 2 тренування з 1 жовтня',
		)
		const base = makeWeightedStats()
		const noGroup = { ...base, exercise: { ...base.exercise, muscleGroup: null } }
		expect(formatExerciseSubtitle(noGroup, t)).toMatch(/^Інше · /)
	})
})

describe('getRecordTiles', () => {
	it('weighted: the heaviest set and the most reps at that weight, with dates', () => {
		const tiles = getRecordTiles(makeWeightedStats().best, false, t)
		expect(tiles.map((tile) => [tile.label, tile.value, tile.date])).toEqual([
			['Рекорд ваги', '70 кг × 5', '26 жовт'],
			['Найбільше повт.', '70 кг × 6', '21 жовт'],
		])
	})

	it('bodyweight: the most reps in a set and in one workout', () => {
		const tiles = getRecordTiles(makeBodyweightStats().best, true, t)
		expect(tiles.map((tile) => [tile.label, tile.value, tile.date])).toEqual([
			['Найбільше', '9 повт.', '21 жовт'],
			['За тренування', '21 повт.', '26 жовт'],
		])
	})

	it('has no tiles without a best', () => {
		const empty = { topSet: null, maxReps: null, maxSessionReps: null }
		expect(getRecordTiles(empty, false, t)).toEqual([])
		expect(getRecordTiles(empty, true, t)).toEqual([])
	})
})
