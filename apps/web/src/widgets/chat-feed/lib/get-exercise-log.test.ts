import { describe, expect, it } from 'vitest'

import { i18n } from '@/shared/i18n'
import { makeExercise, makeWorkout } from '@/shared/testing'

import { getExerciseLog } from './get-exercise-log'

const t = i18n.t.bind(i18n)

const at = (time: string) => `2026-10-26T${time}:00.000Z`

const session = {
	startedAt: null,
	finishedAt: null,
	exercises: [
		makeExercise({ id: 'e1', performedAt: at('17:30') }),
		makeExercise({ id: 'e2', name: 'Присід', performedAt: at('17:50') }),
		makeExercise({ id: 'e3', name: 'Тяга', performedAt: at('18:10') }),
	],
}

describe('getExerciseLog', () => {
	it('counts «on that moment»: nothing written after the newest exercise of the card', () => {
		expect(getExerciseLog(session, ['e1'], t).counts).toBe('1 вправа · 3 підходи')
		expect(getExerciseLog(session, ['e2'], t).counts).toBe('2 вправи · 6 підходів')
		expect(getExerciseLog(session, ['e2', 'e3'], t).counts).toBe('3 вправи · 9 підходів')
	})

	it('keeps only the exercises of the card, in the order of the session', () => {
		expect(getExerciseLog(session, ['e3', 'e1'], t).exercises.map((item) => item.id)).toEqual([
			'e1',
			'e3',
		])
	})

	it('an exercise without a time makes the counter the whole session', () => {
		const old = {
			...session,
			exercises: session.exercises.map((exercise) => ({ ...exercise, performedAt: null })),
		}

		expect(getExerciseLog(old, ['e1'], t).counts).toBe('3 вправи · 9 підходів')
	})

	it('says «змінено» only for an exercise written after the session was closed', () => {
		const closed = { ...session, finishedAt: at('18:00') }

		expect(getExerciseLog(closed, ['e2'], t).isChanged).toBe(false)
		expect(getExerciseLog(closed, ['e3'], t).isChanged).toBe(true)
		expect(getExerciseLog(session, ['e3'], t).isChanged).toBe(false)
	})

	it('the title carries the start of the session when it has one', () => {
		expect(getExerciseLog(session, ['e1'], t).title).toBe('Тренування')
		const started = makeWorkout({ startedAt: at('17:30'), exercises: session.exercises })
		expect(getExerciseLog(started, ['e1'], t).title).toMatch(/^Тренування · \d{2}:\d{2}$/)
	})

	it('cardio shows alone when it is all there is', () => {
		const cardioOnly = {
			...session,
			exercises: [
				makeExercise({
					id: 'c1',
					name: 'Доріжка',
					kind: 'CARDIO',
					sets: [],
					durationMin: 15,
					performedAt: at('17:30'),
				}),
			],
		}

		expect(getExerciseLog(cardioOnly, ['c1'], t).counts).toBe('кардіо 15 хв')
	})

	it('keeps cardio out of the counter next to strength: it would not stay on one row', () => {
		const mixed = {
			...session,
			exercises: [
				makeExercise({
					id: 'c1',
					name: 'Доріжка',
					kind: 'CARDIO',
					sets: [],
					durationMin: 25,
					performedAt: at('17:00'),
				}),
				...session.exercises,
			],
		}

		expect(getExerciseLog(mixed, ['e2'], t).counts).toBe('2 вправи · 6 підходів')
	})
})
