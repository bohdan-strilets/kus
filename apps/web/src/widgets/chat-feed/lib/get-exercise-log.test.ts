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

	it('adds cardio to the counter next to strength: it fits two rows', () => {
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

		expect(getExerciseLog(mixed, ['e2'], t).counts).toBe('2 вправи · 6 підходів · кардіо 25 хв')
	})
})

describe('getExerciseLog: live planned sessions', () => {
	const DONE_AT = '2026-11-02T10:00:00.000Z'
	const planned = (doneAt: string | null) => ({
		reps: 8,
		weightKg: 50,
		durationSec: null,
		distanceM: null,
		isWarmup: false,
		doneAt,
	})

	it('2 exercises / 4 sets planned, 1 exercise / 2 sets done: «1 вправа · 2 підходи»', () => {
		const live = {
			startedAt: null,
			finishedAt: null,
			exercises: [
				makeExercise({
					id: 'l1',
					clientKey: 'k1',
					performedAt: at('17:30'),
					sets: [planned(DONE_AT), planned(DONE_AT)],
				}),
				makeExercise({
					id: 'l2',
					name: 'Присід',
					clientKey: 'k2',
					performedAt: at('17:40'),
					sets: [planned(null), planned(null)],
				}),
			],
		}

		expect(getExerciseLog(live, ['l1', 'l2'], t).counts).toBe('1 вправа · 2 підходи')
	})

	it('keeps «кардіо 10 хв» in the footer under the title with a start time', () => {
		const withStart = makeWorkout({
			startedAt: at('17:30'),
			exercises: [
				makeExercise({ id: 'e1', sets: [planned(null), planned(null)] }),
				makeExercise({ id: 'e2', name: 'Присід', sets: [planned(null)] }),
				makeExercise({ id: 'c1', kind: 'CARDIO', sets: [], durationMin: 10 }),
			],
		})

		const view = getExerciseLog(withStart, ['e1', 'e2', 'c1'], t)

		expect(view.counts).toBe('2 вправи · 3 підходи · кардіо 10 хв')
	})
})
