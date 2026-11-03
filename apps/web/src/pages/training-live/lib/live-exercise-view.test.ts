import { describe, expect, it } from 'vitest'

import type { LiveDraftExercise, LiveDraftSet } from '@/features/live-workout'

import { getHintToShow } from './live-exercise-view'

const set = (overrides: Partial<LiveDraftSet> = {}): LiveDraftSet => ({
	reps: 8,
	weightKg: 50,
	durationSec: null,
	distanceM: null,
	isWarmup: false,
	doneAt: null,
	...overrides,
})

const exercise = (
	{ hintKg = 55, repsMax = 10 }: { hintKg?: number | null; repsMax?: number | null } = {},
	overrides: Partial<LiveDraftExercise> = {},
): LiveDraftExercise => ({
	rowKey: 'k',
	clientKey: 'k',
	readOnly: false,
	exerciseId: null,
	templateExerciseId: null,
	name: 'Жим',
	kind: 'STRENGTH',
	muscleGroup: null,
	isBodyweight: null,
	durationMin: null,
	distanceM: null,
	sets: [set()],
	plan: {
		sets: 3,
		repsMin: 8,
		repsMax,
		weightKg: 50,
		progressStepKg: 2.5,
		restSec: null,
		durationMin: null,
		isBodyweight: null,
		lastSets: null,
		progressHintKg: hintKg,
	},
	...overrides,
})

describe('getHintToShow', () => {
	it('shows the hint with the top reps while a working set is not at the hint weight', () => {
		expect(getHintToShow(exercise())).toEqual({ reps: 10, weightKg: 55 })
	})

	it('hides once every set to do has the hint weight', () => {
		expect(getHintToShow(exercise({}, { sets: [set({ weightKg: 55 })] }))).toBeNull()
	})

	it('ignores done sets and warm-ups', () => {
		const onlyDoneOrWarmup = exercise(
			{},
			{ sets: [set({ doneAt: '2026-11-02T09:00:00.000Z' }), set({ isWarmup: true })] },
		)

		expect(getHintToShow(onlyDoneOrWarmup)).toBeNull()
	})

	it('hides without a hint, without reps, without a plan, or for bodyweight', () => {
		expect(getHintToShow(exercise({ hintKg: null }))).toBeNull()
		expect(getHintToShow(exercise({ repsMax: null }))).toBeNull()
		expect(getHintToShow(exercise({}, { plan: null }))).toBeNull()
		expect(getHintToShow(exercise({}, { isBodyweight: true }))).toBeNull()
	})
})
