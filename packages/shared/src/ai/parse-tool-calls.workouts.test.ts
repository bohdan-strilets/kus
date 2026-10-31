import { describe, expect, it } from 'vitest'

import type { ParseRefs } from './entry-edits.js'
import { parseToolCalls, type RawToolCall } from './parse-tool-calls.js'
import type { TodayWorkoutContext } from './workout-context.js'

const todayWorkout: TodayWorkoutContext = {
	ref: 'w1',
	place: 'GYM',
	time: '18:30',
	durationMin: 55,
	kcalBurned: null,
	exercises: [],
}

const refs: ParseRefs = {
	memoryRefs: new Set(),
	entries: new Map(),
	deletedEntryRefs: new Set(),
	clarifications: new Map(),
	today: '2026-10-27',
	measurementDays: new Set(),
	workouts: new Map([['w1', todayWorkout]]),
	deletedWorkoutRefs: new Set(['w2']),
	exerciseRefs: new Set(['x1']),
}

const call = (name: string, input: unknown): RawToolCall => ({
	name,
	arguments: JSON.stringify(input),
})

const bench = {
	name: 'Жим лежачи',
	kind: 'STRENGTH',
	sets: [{ reps: 8, weightKg: 80, count: 3 }],
}

const workout = (overrides: Record<string, unknown> = {}): RawToolCall =>
	call('log_workout', { exercises: [bench], reply: 'Записав тренування.', ...overrides })

const egg = {
	name: 'Яйце варене',
	grams: 150,
	quantity: 3,
	kcal: 233,
	protein: 19,
	fat: 16,
	carbs: 1.7,
	fiber: 0,
	category: 'eggs',
	source: 'REFERENCE',
	confidence: 0.9,
	assumption: null,
	memoryRef: null,
}
const logFood = call('log_food', { items: [egg], mealType: null, reply: 'Записав.' })

describe('parseToolCalls with log_workout', () => {
	it('reads a workout on its own, with every default filled', () => {
		const result = parseToolCalls([workout({ place: 'GYM', kcalBurned: 400 })], refs)

		expect(result).toMatchObject({
			ok: true,
			decision: {
				kind: 'workout',
				workouts: [
					{
						place: 'GYM',
						kcalBurned: 400,
						date: null,
						replaceRef: null,
						exercises: [{ name: 'Жим лежачи', exerciseRef: null, durationMin: null }],
					},
				],
			},
		})
	})

	it('lets a workout ride along with log_food', () => {
		const result = parseToolCalls([logFood, workout()], refs)

		expect(result).toMatchObject({
			ok: true,
			decision: { kind: 'log', workouts: [{ exercises: [{ name: 'Жим лежачи' }] }] },
		})
	})

	it('keeps workouts empty on a plain log_food', () => {
		expect(parseToolCalls([logFood], refs)).toMatchObject({
			ok: true,
			decision: { kind: 'log', workouts: [] },
		})
	})

	it('rejects a workout next to a reply, a card or a measurement', () => {
		const reply = call('reply', { text: 'ok' })
		const weight = call('log_measurement', {
			kind: 'WEIGHT',
			value: 82.4,
			date: null,
			confirmedJump: false,
		})
		const showDay = call('show_day', { date: null, reply: 'ok' })

		expect(parseToolCalls([workout(), reply], refs).ok).toBe(false)
		expect(parseToolCalls([workout(), weight], refs).ok).toBe(false)
		expect(parseToolCalls([workout(), showDay], refs).ok).toBe(false)
	})

	it('rejects two food logs and more than three workouts', () => {
		expect(parseToolCalls([logFood, logFood, workout()], refs).ok).toBe(false)
		expect(parseToolCalls([workout(), workout(), workout(), workout()], refs).ok).toBe(false)
	})

	it('accepts replaceRef only for a workout of the context', () => {
		expect(parseToolCalls([workout({ replaceRef: 'w1' })], refs).ok).toBe(true)

		const unknown = parseToolCalls([workout({ replaceRef: 'w9' })], refs)

		expect(unknown.ok).toBe(false)
		expect(unknown.ok ? [] : unknown.errors.join(' ')).toContain('replaceRef "w9"')
	})

	it('rejects the same workout replaced twice', () => {
		const twice = [workout({ replaceRef: 'w1' }), workout({ replaceRef: 'w1' })]

		expect(parseToolCalls(twice, refs).ok).toBe(false)
	})

	it('accepts exerciseRef only from the «Exercises» section', () => {
		const known = { ...bench, exerciseRef: 'x1' }
		const unknown = { ...bench, exerciseRef: 'x7' }

		expect(parseToolCalls([workout({ exercises: [known] })], refs).ok).toBe(true)
		expect(parseToolCalls([workout({ exercises: [unknown] })], refs).ok).toBe(false)
	})

	it('allows today and the last loggable days, not the future or the distant past', () => {
		expect(parseToolCalls([workout({ date: '2026-10-25' })], refs).ok).toBe(true)
		expect(parseToolCalls([workout({ date: '2026-10-28' })], refs).ok).toBe(false)
		expect(parseToolCalls([workout({ date: '2026-09-01' })], refs).ok).toBe(false)
	})

	it('rejects cardio with neither minutes nor distance, and absurd values', () => {
		const empty = { name: 'Біг', kind: 'CARDIO' }
		const timed = { ...empty, durationMin: 20 }
		const heavy = { ...bench, sets: [{ reps: 8, weightKg: 900, count: 1 }] }

		expect(parseToolCalls([workout({ exercises: [empty] })], refs).ok).toBe(false)
		expect(parseToolCalls([workout({ exercises: [timed] })], refs).ok).toBe(true)
		expect(parseToolCalls([workout({ exercises: [heavy] })], refs).ok).toBe(false)
		expect(parseToolCalls([workout({ exercises: [] })], refs).ok).toBe(false)
	})

	it('rejects a workout with edit tools but no food', () => {
		const edit = call('delete_entry', { refs: ['w1'] })

		expect(parseToolCalls([workout(), edit], refs).ok).toBe(false)
	})
})

describe('parseToolCalls replacing and deleting the same workout', () => {
	it('rejects a workout that one message both replaces and deletes', () => {
		const result = parseToolCalls(
			[logFood, workout({ replaceRef: 'w1' }), call('delete_entry', { refs: ['w1'] })],
			refs,
		)

		expect(result.ok).toBe(false)
		expect(result.ok ? [] : result.errors.join(' ')).toContain('w1 is also deleted')
	})

	it('allows replacing one workout and deleting another', () => {
		const second: TodayWorkoutContext = { ...todayWorkout, ref: 'w3' }
		const both = {
			...refs,
			workouts: new Map([
				['w1', todayWorkout],
				['w3', second],
			]),
		}

		const result = parseToolCalls(
			[logFood, workout({ replaceRef: 'w1' }), call('delete_entry', { refs: ['w3'] })],
			both,
		)

		expect(result.ok).toBe(true)
	})
})

describe('parseToolCalls deleting and restoring a workout', () => {
	const reply = call('reply', { text: 'Прибрав.' })

	it('deletes a workout of the context by its w-ref', () => {
		const result = parseToolCalls([call('delete_entry', { refs: ['w1'] }), reply], refs)

		expect(result).toMatchObject({
			ok: true,
			decision: { kind: 'edit', edits: { deletions: ['w1'] } },
		})
	})

	it('restores only a workout deleted today', () => {
		expect(parseToolCalls([call('restore_entry', { refs: ['w2'] }), reply], refs).ok).toBe(true)
		expect(parseToolCalls([call('restore_entry', { refs: ['w1'] }), reply], refs).ok).toBe(false)
	})

	it('refuses a w-ref that is not in the context', () => {
		expect(parseToolCalls([call('delete_entry', { refs: ['w5'] }), reply], refs).ok).toBe(false)
	})

	it('keeps correct_entry on e-refs only', () => {
		const change = { changes: [{ ref: 'w1', grams: 100 }] }

		expect(parseToolCalls([call('correct_entry', change), reply], refs).ok).toBe(false)
	})
})

describe('parseToolCalls adding to a workout, finishing it and fixing groups', () => {
	const errorsOf = (calls: RawToolCall[], parseRefs: ParseRefs = refs): string =>
		((result) => (result.ok ? '' : result.errors.join(' ')))(parseToolCalls(calls, parseRefs))

	it('fills the new fields with their defaults', () => {
		expect(parseToolCalls([workout()], refs)).toMatchObject({
			ok: true,
			decision: {
				workouts: [
					{
						appendRef: null,
						finish: false,
						exerciseGroups: [],
						exercises: [{ muscleGroup: null }],
					},
				],
			},
		})
	})

	it('adds exercises to a workout of the context, with their group', () => {
		const result = parseToolCalls(
			[workout({ appendRef: 'w1', exercises: [{ ...bench, muscleGroup: 'CHEST' }] })],
			refs,
		)

		expect(result).toMatchObject({
			ok: true,
			decision: { workouts: [{ appendRef: 'w1', exercises: [{ muscleGroup: 'CHEST' }] }] },
		})
	})

	it('finishes a workout without new exercises', () => {
		expect(
			parseToolCalls([workout({ appendRef: 'w1', finish: true, exercises: [] })], refs),
		).toMatchObject({
			ok: true,
			decision: { workouts: [{ appendRef: 'w1', finish: true, exercises: [] }] },
		})
	})

	it('fixes a group without exercises', () => {
		expect(
			parseToolCalls([workout({ exercises: [], exerciseGroups: ['x1:LEGS'] })], refs),
		).toMatchObject({
			ok: true,
			decision: { workouts: [{ exerciseGroups: ['x1:LEGS'], exercises: [] }] },
		})
	})

	it('rejects empty exercises without appendRef and finish or a group fix', () => {
		expect(errorsOf([workout({ exercises: [] })])).toContain('no exercises')
		expect(errorsOf([workout({ exercises: [], finish: true })])).toContain('no exercises')
		expect(errorsOf([workout({ exercises: [], appendRef: 'w1' })])).toContain('no exercises')
	})

	it('rejects appendRef together with replaceRef', () => {
		expect(errorsOf([workout({ appendRef: 'w1', replaceRef: 'w1' })])).toContain(
			'appendRef and replaceRef together',
		)
	})

	it('rejects appendRef with a date', () => {
		expect(errorsOf([workout({ appendRef: 'w1', date: '2026-10-26' })])).toContain(
			'appendRef goes with date null',
		)
	})

	it("rejects appendRef that is not in «Today's workouts», a deleted one too", () => {
		expect(errorsOf([workout({ appendRef: 'w9' })])).toContain('appendRef "w9" is not in')
		expect(errorsOf([workout({ appendRef: 'w2' })])).toContain('appendRef "w2" is not in')
	})

	it('rejects two calls adding to one workout, or adding to and replacing it', () => {
		expect(errorsOf([workout({ appendRef: 'w1' }), workout({ appendRef: 'w1' })])).toContain(
			'w1 gets more than one call',
		)
		expect(errorsOf([workout({ appendRef: 'w1' }), workout({ replaceRef: 'w1' })])).toContain(
			'w1 gets more than one call',
		)
	})

	it('keeps the old text for a workout replaced twice', () => {
		const errors = errorsOf([workout({ replaceRef: 'w1' }), workout({ replaceRef: 'w1' })])

		expect(errors).toContain('w1 is replaced more than once')
		expect(errors).not.toContain('gets more than one call')
	})

	it('rejects adding to a workout the same message deletes', () => {
		const errors = errorsOf([
			logFood,
			workout({ appendRef: 'w1' }),
			call('delete_entry', { refs: ['w1'] }),
		])

		expect(errors).toContain('w1 is also deleted in this message — add to it or delete it')
	})

	it('rejects a group fix of an exercise that is not in «Exercises», or a malformed one', () => {
		expect(errorsOf([workout({ exerciseGroups: ['x7:LEGS'] })])).toContain(
			'exerciseGroups "x7:LEGS" — x7 is not in "Exercises"',
		)
		expect(parseToolCalls([workout({ exerciseGroups: ['x1:NECK'] })], refs).ok).toBe(false)
		expect(errorsOf([workout({ exerciseGroups: ['x1:NECK'] })])).toContain(
			'exerciseGroups "x1:NECK" — NECK is not one of CHEST, BACK, LEGS, SHOULDERS, ARMS, CORE',
		)
		expect(parseToolCalls([workout({ exerciseGroups: ['x1'] })], refs).ok).toBe(false)
	})

	it('rejects an unknown muscle group', () => {
		const neck = { ...bench, muscleGroup: 'NECK' }

		expect(parseToolCalls([workout({ exercises: [neck] })], refs).ok).toBe(false)
	})
})
