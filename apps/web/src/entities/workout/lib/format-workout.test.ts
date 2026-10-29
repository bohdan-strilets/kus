import type { WorkoutSetResponse } from '@kus/shared'
import { describe, expect, it } from 'vitest'

import { i18n } from '@/shared/i18n'
import { makeExercise } from '@/shared/testing'

import {
	formatCardioSummary,
	formatExerciseNames,
	formatExerciseSummary,
	formatSetsSummary,
	formatWorkoutKcalNote,
	formatWorkoutKind,
	formatWorkoutTotal,
	getExerciseIcon,
} from './format-workout'

const t = i18n.t.bind(i18n)

const set = (overrides: Partial<WorkoutSetResponse> = {}): WorkoutSetResponse => ({
	reps: 8,
	weightKg: 80,
	durationSec: null,
	distanceM: null,
	isWarmup: false,
	...overrides,
})

describe('formatSetsSummary', () => {
	it('equal sets: weight and a scheme', () => {
		expect(formatSetsSummary([set(), set(), set()], t)).toBe('80 кг · 3×8')
	})

	it('one weight, different reps: the reps are listed', () => {
		expect(formatSetsSummary([set(), set(), set({ reps: 6 })], t)).toBe('80 кг × 8, 8, 6')
	})

	it('different weights: every set with its own weight', () => {
		expect(formatSetsSummary([set(), set({ weightKg: 85, reps: 6 })], t)).toBe(
			'80 кг × 8, 85 кг × 6',
		)
	})

	it('without weight: just the scheme', () => {
		const bodyweight = set({ weightKg: null, reps: 15 })
		expect(formatSetsSummary([bodyweight, bodyweight, bodyweight], t)).toBe('3×15')
	})

	it('keeps a decimal weight and leaves warm-up sets out', () => {
		const working = set({ weightKg: 77.5 })
		expect(formatSetsSummary([set({ weightKg: 40, isWarmup: true }), working, working], t)).toBe(
			'77,5 кг · 2×8',
		)
	})

	it('a timed set (no reps) shows the time; nothing to say gives null', () => {
		expect(formatSetsSummary([set({ reps: null, weightKg: null, durationSec: 60 })], t)).toBe(
			'60 с',
		)
		expect(formatSetsSummary([], t)).toBeNull()
	})
})

describe('cardio', () => {
	it('time and distance', () => {
		expect(formatCardioSummary({ durationMin: 20, distanceM: 3000 }, t)).toBe('20 хв · 3,0 км')
	})

	it('time alone, nothing at all', () => {
		expect(formatCardioSummary({ durationMin: 15, distanceM: null }, t)).toBe('15 хв')
		expect(formatCardioSummary({ durationMin: null, distanceM: null }, t)).toBeNull()
	})

	it('an exercise summary follows its kind', () => {
		expect(formatExerciseSummary(makeExercise(), t)).toBe('80 кг · 3×8')
		expect(
			formatExerciseSummary(
				makeExercise({ kind: 'CARDIO', sets: [], durationMin: 20, distanceM: 3000 }),
				t,
			),
		).toBe('20 хв · 3,0 км')
	})

	it('the cardio icon follows the name', () => {
		const icon = (name: string) => getExerciseIcon({ kind: 'CARDIO', name })
		expect(icon('Бігова доріжка')).toBe('run')
		expect(icon('Біг на вулиці')).toBe('run')
		expect(icon('Велотренажер')).toBe('bike')
		expect(icon('Гребний тренажер')).toBe('rowing')
		expect(icon('Орбітрек')).toBe('cardio')
		expect(getExerciseIcon({ kind: 'STRENGTH', name: 'Біг' })).toBe('training')
	})
})

describe('labels', () => {
	it('the kind in the header follows the place', () => {
		expect(formatWorkoutKind('GYM', t)).toBe('Зал')
		expect(formatWorkoutKind('HOME', t)).toBe('Вдома')
		expect(formatWorkoutKind('OUTDOOR', t)).toBe('Біг')
		expect(formatWorkoutKind('OTHER', t)).toBe('Тренування')
		expect(formatWorkoutKind(null, t)).toBe('Тренування')
	})

	it('the kcal line only for a named number, with its source', () => {
		expect(formatWorkoutKcalNote({ kcalBurned: 320, kcalSource: 'DEVICE' }, t)).toBe(
			'320 ккал · з табло · на ціль не впливає',
		)
		expect(formatWorkoutKcalNote({ kcalBurned: 380, kcalSource: 'MANUAL' }, t)).toBe(
			'380 ккал · зі слів · на ціль не впливає',
		)
		expect(formatWorkoutKcalNote({ kcalBurned: null, kcalSource: null }, t)).toBeNull()
		expect(formatWorkoutKcalNote({ kcalBurned: 300, kcalSource: 'AI_ESTIMATE' }, t)).toBeNull()
	})

	it('lists the names in lower case', () => {
		expect(
			formatExerciseNames({
				exercises: [makeExercise({ name: 'Жим лежачи' }), makeExercise({ name: 'Присідання' })],
			}),
		).toBe('жим лежачи, присідання')
	})
})

describe('formatWorkoutTotal', () => {
	it.each([
		[55, '55 хв'],
		[60, '1 год'],
		[155, '2 год 35 хв'],
		[120, '2 год'],
	])('%i minutes → %s', (minutes, text) => {
		expect(formatWorkoutTotal(minutes, t)).toBe(text)
	})
})
