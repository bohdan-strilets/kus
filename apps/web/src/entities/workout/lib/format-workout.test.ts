import { describe, expect, it } from 'vitest'

import { i18n } from '@/shared/i18n'

import {
	formatCardioSummary,
	formatWorkoutKcalNote,
	formatWorkoutKind,
	formatWorkoutTotal,
	getExerciseIcon,
} from './format-workout'

const t = i18n.t.bind(i18n)

describe('cardio', () => {
	it('time and distance', () => {
		expect(formatCardioSummary({ durationMin: 20, distanceM: 3000 }, t)).toBe('20 хв · 3,0 км')
	})

	it('time alone, nothing at all', () => {
		expect(formatCardioSummary({ durationMin: 15, distanceM: null }, t)).toBe('15 хв')
		expect(formatCardioSummary({ durationMin: null, distanceM: null }, t)).toBeNull()
	})

	it('the cardio icon follows the name', () => {
		const icon = (name: string) => getExerciseIcon({ kind: 'CARDIO', name })
		expect(icon('Бігова доріжка')).toBe('run')
		expect(icon('Біг на вулиці')).toBe('run')
		expect(icon('Велотренажер')).toBe('bike')
		expect(icon('Гребний тренажер')).toBe('rowing')
		expect(icon('Орбітрек')).toBe('cardio')
		expect(getExerciseIcon({ kind: 'STRENGTH', name: 'Біг' })).toBe('dumbbell')
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
