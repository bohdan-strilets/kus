import type { WorkoutExerciseResponse, WorkoutResponse } from '@kus/shared'
import { describe, expect, it } from 'vitest'

import { i18n } from '@/shared/i18n'
import { makeExercise, makeWorkout } from '@/shared/testing'

import { formatSectionSummary } from './format-section-summary'
import { formatSessionHeader, formatSessionTime } from './format-session-header'
import { getSessionView, isBodyweightExercise } from './session-view'

const t = i18n.t.bind(i18n)

const set = (reps: number, weightKg: number | null, isWarmup = false) => ({
	reps,
	weightKg,
	durationSec: null,
	distanceM: null,
	isWarmup,
})

const cardio = (overrides: Partial<WorkoutExerciseResponse> = {}): WorkoutExerciseResponse =>
	makeExercise({
		id: 'c1',
		name: 'Бігова доріжка',
		kind: 'CARDIO',
		muscleGroup: null,
		durationMin: 15,
		distanceM: 2100,
		sets: [],
		...overrides,
	})

describe('getSessionView', () => {
	it('orders sections by the fixed group order and leaves empty ones out', () => {
		const view = getSessionView({
			exercises: [
				makeExercise({ id: 'a', muscleGroup: 'CORE' }),
				makeExercise({ id: 'b', muscleGroup: 'CHEST' }),
				cardio(),
			],
		})
		expect(view.sections.map((section) => section.key)).toEqual(['CARDIO', 'CHEST', 'CORE'])
	})

	it('counts working sets without warm-ups and keeps the order of the exercises', () => {
		const view = getSessionView({
			exercises: [
				makeExercise({
					id: 'a',
					muscleGroup: 'BACK',
					sets: [set(8, 40, true), set(8, 60), set(8, 60)],
				}),
				makeExercise({ id: 'b', muscleGroup: 'BACK', sets: [set(5, 70)] }),
			],
		})
		expect(view.sections).toHaveLength(1)
		expect(view.sections[0]?.exercises.map((exercise) => exercise.id)).toEqual(['a', 'b'])
		expect(view.sections[0]?.setCount).toBe(3)
		expect(view.strength).toEqual({ exerciseCount: 2, setCount: 3 })
	})

	it('keeps cardio out of the strength numbers and sums its minutes and distance', () => {
		const view = getSessionView({
			exercises: [cardio(), cardio({ id: 'c2', durationMin: 10, distanceM: null })],
		})
		expect(view.strength).toBeNull()
		expect(view.cardio).toEqual({ minutes: 25, distanceM: 2100 })
		expect(view.sections[0]?.cardioMinutes).toBe(25)
	})

	it('puts a strength exercise of an unknown group last, without a tag', () => {
		const view = getSessionView({
			exercises: [
				makeExercise({ id: 'a', muscleGroup: null }),
				makeExercise({ id: 'b', muscleGroup: 'LEGS' }),
			],
		})
		expect(view.sections.map((section) => [section.key, section.group])).toEqual([
			['LEGS', 'LEGS'],
			['OTHER', null],
		])
		expect(view.strength?.exerciseCount).toBe(2)
	})

	it('has no cardio numbers when none were named', () => {
		const view = getSessionView({ exercises: [cardio({ durationMin: null, distanceM: null })] })
		expect(view.cardio).toBeNull()
	})
})

describe('isBodyweightExercise', () => {
	it('is true when every working set is without weight, warm-ups aside', () => {
		expect(
			isBodyweightExercise({ kind: 'STRENGTH', sets: [set(8, 20, true), set(8, null), set(7, 0)] }),
		).toBe(true)
	})

	it('is false with any weight, without working sets and for cardio', () => {
		expect(isBodyweightExercise({ kind: 'STRENGTH', sets: [set(8, null), set(8, 10)] })).toBe(false)
		expect(isBodyweightExercise({ kind: 'STRENGTH', sets: [set(8, null, true)] })).toBe(false)
		expect(isBodyweightExercise({ kind: 'CARDIO', sets: [] })).toBe(false)
	})
})

describe('formatSectionSummary', () => {
	const view = getSessionView({
		exercises: [
			makeExercise({
				id: 'a',
				muscleGroup: 'BACK',
				sets: [set(12, 45), set(12, 45), set(12, 45)],
			}),
			makeExercise({
				id: 'b',
				muscleGroup: 'BACK',
				sets: [set(8, null), set(7, null), set(6, null)],
			}),
			makeExercise({ id: 'c', muscleGroup: 'CORE', sets: [] }),
			cardio(),
		],
	})
	const summaryOf = (key: string): string | null => {
		const section = view.sections.find((item) => item.key === key)
		return section ? formatSectionSummary(section, t) : null
	}

	it('says exercises and working sets for strength', () => {
		expect(summaryOf('BACK')).toBe('2 вправи · 6 підх.')
	})

	it('says only the exercises when there are no sets', () => {
		expect(summaryOf('CORE')).toBe('1 вправа')
	})

	it('says only the minutes for cardio', () => {
		expect(summaryOf('CARDIO')).toBe('15 хв')
	})
})

const session = (overrides: Partial<WorkoutResponse> = {}): WorkoutResponse =>
	makeWorkout({
		localDate: '2026-10-26',
		startedAt: '2026-10-26T17:30:00.000Z',
		durationMin: null,
		estimatedDurationMin: null,
		place: 'GYM',
		...overrides,
	})

describe('formatSessionHeader', () => {
	it('names the place and a named duration, with the start only', () => {
		const header = formatSessionHeader(session({ durationMin: 62 }), t)
		expect(header.title).toBe('Зал · 62 хв')
		expect(header.subtitle).toMatch(/^Понеділок, 26 жовтня · \d{2}:\d{2}$/)
	})

	it('marks an estimated duration with «≈» and shows the range', () => {
		const header = formatSessionHeader(session({ estimatedDurationMin: 62 }), t)
		expect(header.title).toBe('Зал · ≈ 62 хв')
		expect(header.subtitle).toMatch(/^Понеділок, 26 жовтня · \d{2}:\d{2}–\d{2}:\d{2}$/)
	})

	it('is only the place and the start without a duration', () => {
		const header = formatSessionHeader(session(), t)
		expect(header.title).toBe('Зал')
		expect(header.subtitle).toMatch(/^Понеділок, 26 жовтня · \d{2}:\d{2}$/)
	})

	it('is only the date without a start', () => {
		expect(formatSessionHeader(session({ startedAt: null, durationMin: 30 }), t).subtitle).toBe(
			'Понеділок, 26 жовтня',
		)
	})
})

describe('formatSessionTime', () => {
	it('ends the range an estimated duration after the start', () => {
		const time = formatSessionTime(
			{ startedAt: '2026-10-26T17:30:00.000Z', durationMin: null, estimatedDurationMin: 62 },
			t,
		)
		const [from, to] = (time ?? '').split('–')
		const minutes = (text = ''): number => Number(text.slice(0, 2)) * 60 + Number(text.slice(3))
		expect((minutes(to) - minutes(from) + 1440) % 1440).toBe(62)
	})
})
