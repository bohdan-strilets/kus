import { describe, expect, it } from 'vitest'

import { makeExercise, makeLiveInput } from '@/shared/testing'

import { mergeServerInputs } from './merge-server-inputs'

const KEY_BENCH = '0199b3a4-0000-7000-8000-0000000000d1'
const KEY_SQUAT = '0199b3a4-0000-7000-8000-0000000000d2'
const KEY_ROW = '0199b3a4-0000-7000-8000-0000000000d3'
const LOCAL_EXERCISE_ID = '0199b3a4-0000-7000-8000-0000000000a1'
const TEMPLATE_EXERCISE_ID = '0199b3a4-0000-7000-8000-0000000000b1'
const DONE_AT = '2026-11-02T09:20:00.000Z'

const serverSet = (weightKg: number, doneAt: string | null = DONE_AT) => ({
	reps: 8,
	weightKg,
	durationSec: null,
	distanceM: null,
	isWarmup: false,
	doneAt,
})

const localBench = (weightKg: number) =>
	makeLiveInput({
		clientKey: KEY_BENCH,
		exerciseId: LOCAL_EXERCISE_ID,
		sets: [serverSet(weightKg, null)],
	})

describe('mergeServerInputs', () => {
	it('the server version wins for a shared clientKey: the old 80 does not come back', () => {
		const server = makeExercise({ clientKey: KEY_BENCH, sets: [serverSet(85), serverSet(85)] })

		const merged = mergeServerInputs([localBench(80)], [server])

		expect(merged).toHaveLength(1)
		expect(merged[0]?.sets.map(({ weightKg }) => weightKg)).toEqual([85, 85])
		expect(merged[0]?.sets.map(({ doneAt }) => doneAt)).toEqual([DONE_AT, DONE_AT])
	})

	it('takes name, kind, group, bodyweight flag, template exercise, minutes and distance from the server', () => {
		const server = makeExercise({
			clientKey: KEY_BENCH,
			name: 'Біг',
			kind: 'CARDIO',
			muscleGroup: null,
			isBodyweight: true,
			templateExerciseId: TEMPLATE_EXERCISE_ID,
			durationMin: 12,
			distanceM: 2000,
			sets: [],
		})

		const [merged] = mergeServerInputs([localBench(80)], [server])

		expect(merged).toMatchObject({
			clientKey: KEY_BENCH,
			name: 'Біг',
			kind: 'CARDIO',
			muscleGroup: null,
			isBodyweight: true,
			templateExerciseId: TEMPLATE_EXERCISE_ID,
			durationMin: 12,
			distanceM: 2000,
			sets: [],
		})
	})

	it('keeps the local dictionary id of the exercise (the server response has none)', () => {
		const server = makeExercise({ clientKey: KEY_BENCH })

		const [merged] = mergeServerInputs([localBench(80)], [server])

		expect(merged?.exerciseId).toBe(LOCAL_EXERCISE_ID)
	})

	it('keeps local exercises the server does not know, unchanged and in place', () => {
		const squat = makeLiveInput({ clientKey: KEY_SQUAT, name: 'Присід' })
		const server = makeExercise({ clientKey: KEY_BENCH, sets: [serverSet(85)] })

		const merged = mergeServerInputs([squat, localBench(80)], [server])

		expect(merged.map(({ clientKey }) => clientKey)).toEqual([KEY_SQUAT, KEY_BENCH])
		expect(merged[0]).toBe(squat)
	})

	it('adds a server-only exercise with a key (or the next PUT would delete it), after the local ones', () => {
		const server = makeExercise({ clientKey: KEY_ROW, name: 'Тяга', sets: [serverSet(60)] })

		const merged = mergeServerInputs([localBench(80)], [server])

		expect(merged.map(({ clientKey }) => clientKey)).toEqual([KEY_BENCH, KEY_ROW])
		expect(merged[1]).toMatchObject({ name: 'Тяга', exerciseId: null })
	})

	it('ignores the chat exercises of the server (no key): they are never sent', () => {
		const chat = makeExercise({ id: 'chat-1', clientKey: null, name: 'Присід' })

		const merged = mergeServerInputs([localBench(80)], [chat])

		expect(merged).toHaveLength(1)
		expect(merged[0]?.name).toBe('Жим лежачи')
	})

	it('never duplicates a key', () => {
		const server = [
			makeExercise({ clientKey: KEY_BENCH, sets: [serverSet(85)] }),
			makeExercise({ id: 'row', clientKey: KEY_ROW, name: 'Тяга' }),
		]

		const merged = mergeServerInputs(
			[localBench(80), makeLiveInput({ clientKey: KEY_ROW })],
			server,
		)

		const keys = merged.map(({ clientKey }) => clientKey)
		expect(new Set(keys).size).toBe(keys.length)
		expect(keys).toEqual([KEY_BENCH, KEY_ROW])
	})

	it('with nothing unsent it returns the live exercises of the server; with an empty server, the unsent ones', () => {
		const server = makeExercise({ clientKey: KEY_BENCH })
		const local = [localBench(80)]

		expect(mergeServerInputs([], [server]).map(({ clientKey }) => clientKey)).toEqual([KEY_BENCH])
		expect(mergeServerInputs(local, [])).toEqual(local)
		expect(mergeServerInputs([], [])).toEqual([])
	})
})
