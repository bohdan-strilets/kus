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
	doneAt: null,
})

const format = (sets: WorkoutSetResponse[], record: 'WEIGHT' | 'REPS' | null = null) =>
	formatSets(makeExercise({ sets, record }), t)

describe('formatSets', () => {
	it('folds equal neighbours: «60 кг × 8 — 3 підходи»', () => {
		expect(format([set(60, 8), set(60, 8), set(60, 8)]).segments).toEqual([
			{ kind: 'work', text: '60 кг × 8', count: 3 },
		])
	})

	it('keeps a chain of different sets: «60 кг × 8», «65 кг × 6», «70 кг × 5»', () => {
		const { segments } = format([set(60, 8), set(65, 6), set(70, 5)])
		expect(segments.map((segment) => segment.text)).toEqual(['60 кг × 8', '65 кг × 6', '70 кг × 5'])
		expect(segments.every((segment) => segment.count === undefined)).toBe(true)
	})

	it('folds only neighbours: «60 кг × 8 — 2 підходи», «65 кг × 6»', () => {
		expect(format([set(60, 8), set(60, 8), set(65, 6)]).segments).toEqual([
			{ kind: 'work', text: '60 кг × 8', count: 2 },
			{ kind: 'work', text: '65 кг × 6' },
		])
		expect(format([set(60, 8), set(65, 6), set(60, 8)]).segments).toHaveLength(3)
	})

	it('puts the warm-up first as its own segment', () => {
		expect(format([set(60, 8), set(40, 10, true), set(60, 8)]).segments).toEqual([
			{ kind: 'warmup', text: '40 кг × 10' },
			{ kind: 'work', text: '60 кг × 8', count: 2 },
		])
	})

	it('marks the heaviest working set as the record and does not fold it', () => {
		expect(format([set(60, 5), set(70, 5), set(70, 5)], 'WEIGHT').segments).toEqual([
			{ kind: 'work', text: '60 кг × 5' },
			{ kind: 'record', text: '70 кг × 5' },
			{ kind: 'work', text: '70 кг × 5' },
		])
	})

	it('never marks a warm-up as the record, even the heaviest', () => {
		const { segments } = format([set(100, 3, true), set(60, 5)], 'WEIGHT')
		expect(segments.map((segment) => segment.kind)).toEqual(['warmup', 'record'])
	})

	it('has no record segment without a record', () => {
		expect(format([set(60, 5)]).segments[0]?.kind).toBe('work')
	})

	it('writes bodyweight sets as «8 повт.», «7 повт.», «6 повт.»', () => {
		const result = format([set(null, 8), set(0, 7), set(null, 6)])
		expect(result.segments.map((segment) => segment.text)).toEqual([
			'8 повт.',
			'7 повт.',
			'6 повт.',
		])
	})

	it('folds equal bodyweight sets: «15 повт. — 3 підходи»', () => {
		const result = format([set(null, 15), set(null, 15), set(0, 15)])
		expect(result.segments).toEqual([{ kind: 'work', text: '15 повт.', count: 3 }])
	})

	it('marks the most reps as the REPS record', () => {
		const { segments } = format([set(null, 8), set(null, 10), set(null, 7)], 'REPS')
		expect(segments.map((segment) => segment.kind)).toEqual(['work', 'record', 'work'])
	})

	it('uses a decimal comma: «67,5 кг × 5»', () => {
		expect(format([set(67.5, 5)]).segments[0]?.text).toBe('67,5 кг × 5')
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

const timeSet = (durationSec: number): WorkoutSetResponse => ({
	reps: null,
	weightKg: null,
	durationSec,
	distanceM: null,
	isWarmup: false,
	doneAt: null,
})

describe('formatSets: time and notation', () => {
	it('writes time sets as «45 с» and folds them', () => {
		const result = formatSets(
			makeExercise({ sets: [timeSet(45), timeSet(45), timeSet(45)], record: null }),
			t,
		)
		expect(result.segments).toEqual([{ kind: 'work', text: '45 с', count: 3 }])
	})

	it('uses «×» only between the kg and the reps', () => {
		const examples = [
			format([set(60, 8), set(60, 8), set(60, 8)]),
			format([set(40, 10, true), set(67.5, 5), set(70, 5)], 'WEIGHT'),
			format([set(null, 8), set(0, 7)], 'REPS'),
			formatSets(makeExercise({ sets: [timeSet(45)], record: null }), t),
			formatSets(makeExercise({ kind: 'CARDIO', sets: [], durationMin: 10, distanceM: 1200 }), t),
		]
		const texts = examples.flatMap(({ segments }) => segments.map((segment) => segment.text))
		expect(texts.length).toBeGreaterThan(0)
		texts.forEach((text) => {
			if (!text.includes('×')) return
			expect(text).toMatch(/^\d+(,\d+)? кг × \d+$/)
		})
		expect(texts.filter((text) => text.includes('×'))).not.toHaveLength(0)
	})

	it('writes cardio as «10 хв · 1,2 км»', () => {
		const result = formatSets(
			makeExercise({ kind: 'CARDIO', sets: [], durationMin: 10, distanceM: 1200 }),
			t,
		)
		expect(result.segments).toEqual([{ kind: 'work', text: '10 хв · 1,2 км' }])
	})
})
