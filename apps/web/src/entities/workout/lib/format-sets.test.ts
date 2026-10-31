import type { WorkoutSetResponse } from '@kus/shared'
import { describe, expect, it } from 'vitest'

import { i18n } from '@/shared/i18n'
import { makeExercise } from '@/shared/testing'

import { formatSets } from './format-sets'

const t = i18n.t.bind(i18n)

const set = (weightKg: number | null, reps: number, isWarmup = false): WorkoutSetResponse => ({
	reps,
	weightKg,
	durationSec: null,
	distanceM: null,
	isWarmup,
})

const format = (sets: WorkoutSetResponse[], record: 'WEIGHT' | 'REPS' | null = null) =>
	formatSets(makeExercise({ sets, record }), t)

describe('formatSets', () => {
	it('folds equal neighbours: «60×8 ×3»', () => {
		expect(format([set(60, 8), set(60, 8), set(60, 8)]).segments).toEqual([
			{ kind: 'work', text: '60×8', multiplier: 3 },
		])
	})

	it('keeps a chain of different sets: «60×8 · 65×6 · 70×5»', () => {
		const { segments } = format([set(60, 8), set(65, 6), set(70, 5)])
		expect(segments.map((segment) => segment.text)).toEqual(['60×8', '65×6', '70×5'])
		expect(segments.every((segment) => segment.multiplier === undefined)).toBe(true)
	})

	it('folds only neighbours: «60×8 ×2 · 65×6»', () => {
		expect(format([set(60, 8), set(60, 8), set(65, 6)]).segments).toEqual([
			{ kind: 'work', text: '60×8', multiplier: 2 },
			{ kind: 'work', text: '65×6' },
		])
		expect(format([set(60, 8), set(65, 6), set(60, 8)]).segments).toHaveLength(3)
	})

	it('puts the warm-up first as its own segment', () => {
		expect(format([set(60, 8), set(40, 10, true), set(60, 8)]).segments).toEqual([
			{ kind: 'warmup', text: '40×10' },
			{ kind: 'work', text: '60×8', multiplier: 2 },
		])
	})

	it('marks the heaviest working set as the record and does not fold it', () => {
		expect(format([set(60, 5), set(70, 5), set(70, 5)], 'WEIGHT').segments).toEqual([
			{ kind: 'work', text: '60×5' },
			{ kind: 'record', text: '70×5' },
			{ kind: 'work', text: '70×5' },
		])
	})

	it('never marks a warm-up as the record, even the heaviest', () => {
		const { segments } = format([set(100, 3, true), set(60, 5)], 'WEIGHT')
		expect(segments.map((segment) => segment.kind)).toEqual(['warmup', 'record'])
	})

	it('has no record segment without a record', () => {
		expect(format([set(60, 5)]).segments[0]?.kind).toBe('work')
	})

	it('writes bodyweight sets as reps with «повт.»: «8 · 7 · 6 повт.»', () => {
		const result = format([set(null, 8), set(0, 7), set(null, 6)])
		expect(result.segments.map((segment) => segment.text)).toEqual(['8', '7', '6'])
		expect(result.unit).toBe('повт.')
	})

	it('folds equal bodyweight sets: «15 ×3 повт.»', () => {
		const result = format([set(null, 15), set(null, 15), set(0, 15)])
		expect(result.segments).toEqual([{ kind: 'work', text: '15', multiplier: 3 }])
		expect(result.unit).toBe('повт.')
	})

	it('marks the most reps as the REPS record', () => {
		const { segments } = format([set(null, 8), set(null, 10), set(null, 7)], 'REPS')
		expect(segments.map((segment) => segment.kind)).toEqual(['work', 'record', 'work'])
	})

	it('has no unit when there is a weight', () => {
		expect(format([set(60, 8)]).unit).toBeNull()
	})

	it('uses a decimal comma: «67,5×5»', () => {
		expect(format([set(67.5, 5)]).segments[0]?.text).toBe('67,5×5')
	})

	it('writes cardio as «15 хв · 2,1 км»', () => {
		const result = formatSets(
			makeExercise({ kind: 'CARDIO', sets: [], durationMin: 15, distanceM: 2100 }),
			t,
		)
		expect(result.segments).toEqual([{ kind: 'work', text: '15 хв · 2,1 км' }])
	})

	it('has no segments for cardio without numbers', () => {
		expect(formatSets(makeExercise({ kind: 'CARDIO', sets: [] }), t).segments).toEqual([])
	})
})
