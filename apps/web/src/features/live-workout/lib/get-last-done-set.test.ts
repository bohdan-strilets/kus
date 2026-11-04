import { DEFAULT_REST_SEC } from '@kus/shared'
import { describe, expect, it } from 'vitest'

import { getLastDoneSet } from './get-last-done-set'
import type { LiveDraft, LiveDraftExercise, LiveDraftPlan, LiveDraftSet } from './live-draft.types'

const T1 = '2026-11-04T10:00:00.000Z'
const T2 = '2026-11-04T10:05:00.000Z'
const T3 = '2026-11-04T10:10:00.000Z'

const set = (doneAt: string | null): LiveDraftSet => ({
	reps: 8,
	weightKg: 50,
	durationSec: null,
	distanceM: null,
	isWarmup: false,
	doneAt,
})

const plan = (restSec: number | null): LiveDraftPlan => ({
	sets: 3,
	repsMin: 8,
	repsMax: 10,
	weightKg: 50,
	progressStepKg: null,
	restSec,
	durationMin: null,
	isBodyweight: null,
	lastSets: null,
	progressHintKg: null,
})

const exercise = (
	key: string,
	sets: LiveDraftSet[],
	overrides: Partial<LiveDraftExercise> = {},
): LiveDraftExercise => ({
	rowKey: key,
	clientKey: key,
	readOnly: false,
	exerciseId: null,
	templateExerciseId: null,
	name: key,
	kind: 'STRENGTH',
	muscleGroup: 'CHEST',
	isBodyweight: null,
	durationMin: null,
	distanceM: null,
	sets,
	plan: null,
	...overrides,
})

const draft = (exercises: LiveDraftExercise[]): LiveDraft => ({
	workoutId: 'w',
	templateName: null,
	startedAt: null,
	exercises,
})

describe('getLastDoneSet', () => {
	it('nothing done, or an empty draft, is null', () => {
		expect(getLastDoneSet(draft([]))).toBeNull()
		expect(getLastDoneSet(draft([exercise('a', [set(null), set(null)])]))).toBeNull()
	})

	it('the maximum doneAt wins across exercises, not the position', () => {
		const result = getLastDoneSet(
			draft([exercise('a', [set(T3)]), exercise('b', [set(T1), set(T2)])]),
		)

		expect(result).toEqual({
			doneAt: T3,
			exerciseIndex: 0,
			isFollowedByCardio: false,
			restSec: DEFAULT_REST_SEC,
		})
	})

	it('inside an exercise the latest doneAt wins even if it is not the last set', () => {
		expect(getLastDoneSet(draft([exercise('a', [set(T2), set(T1)])]))?.doneAt).toBe(T2)
	})

	it('restSec comes from the plan of the exercise of that set', () => {
		const result = getLastDoneSet(
			draft([
				exercise('a', [set(T1)], { plan: plan(60) }),
				exercise('b', [set(T2)], { plan: plan(120) }),
			]),
		)

		expect(result).toMatchObject({ exerciseIndex: 1, restSec: 120 })
	})

	it('without a plan or with restSec null: the default', () => {
		expect(getLastDoneSet(draft([exercise('a', [set(T1)])]))?.restSec).toBe(DEFAULT_REST_SEC)
		expect(getLastDoneSet(draft([exercise('a', [set(T1)], { plan: plan(null) })]))?.restSec).toBe(
			DEFAULT_REST_SEC,
		)
	})

	it('read-only (chat) exercises are skipped, even with a later doneAt', () => {
		const result = getLastDoneSet(
			draft([exercise('a', [set(T1)]), exercise('chat', [set(T3)], { readOnly: true })]),
		)

		expect(result).toMatchObject({ doneAt: T1, exerciseIndex: 0 })
	})

	it('only read-only done sets is null', () => {
		expect(getLastDoneSet(draft([exercise('chat', [set(T1)], { readOnly: true })]))).toBeNull()
	})

	it('after the last done set is removed the previous doneAt takes over', () => {
		expect(getLastDoneSet(draft([exercise('a', [set(T1), set(T2)])]))?.doneAt).toBe(T2)
		expect(getLastDoneSet(draft([exercise('a', [set(T1), set(null)])]))?.doneAt).toBe(T1)
	})

	it('an invalid doneAt is ignored', () => {
		expect(getLastDoneSet(draft([exercise('a', [set(T1), set('garbage')])]))?.doneAt).toBe(T1)
	})

	it('equal doneAt: the later one in the draft wins', () => {
		expect(
			getLastDoneSet(draft([exercise('a', [set(T1)]), exercise('b', [set(T1)])]))?.exerciseIndex,
		).toBe(1)
	})
})

describe('getLastDoneSet: isFollowedByCardio', () => {
	const cardio = (overrides: Partial<LiveDraftExercise> = {}): LiveDraftExercise =>
		exercise('run', [], { kind: 'CARDIO', muscleGroup: null, ...overrides })

	const followed = (...exercises: LiveDraftExercise[]): boolean | undefined =>
		getLastDoneSet(draft([exercise('a', [set(T1)]), ...exercises]))?.isFollowedByCardio

	it('true: a cardio with minutes after the strength', () => {
		expect(followed(cardio({ durationMin: 20 }))).toBe(true)
	})

	it('true: a cardio with a distance only', () => {
		expect(followed(cardio({ distanceM: 3000 }))).toBe(true)
	})

	it('false: a cardio without data', () => {
		expect(followed(cardio())).toBe(false)
	})

	it('false: only the plan has minutes, the person has not begun', () => {
		expect(followed(cardio({ plan: { ...plan(null), durationMin: 20 } }))).toBe(false)
	})

	it('false: a read-only (chat) cardio', () => {
		expect(followed(cardio({ durationMin: 20, readOnly: true }))).toBe(false)
	})

	it('false: a cardio before the strength exercise', () => {
		const result = getLastDoneSet(draft([cardio({ durationMin: 20 }), exercise('a', [set(T1)])]))

		expect(result?.isFollowedByCardio).toBe(false)
	})

	it('false: a strength exercise with minutes after is not cardio', () => {
		expect(followed(exercise('b', [set(null)], { durationMin: 20 }))).toBe(false)
	})
})
