import type { StatsEntryRow, StatsSetRow, StatsWorkoutRow } from './workout-stats.types'

export const EX_BENCH = '0199b3a4-0000-7000-8000-0000000000b1'
export const EX_PULLUP = '0199b3a4-0000-7000-8000-0000000000b2'
export const EX_RUN = '0199b3a4-0000-7000-8000-0000000000b3'

export const makeSet = (overrides: Partial<StatsSetRow> = {}): StatsSetRow => ({
	reps: 10,
	weightKg: 50,
	durationSec: null,
	distanceM: null,
	isWarmup: false,
	...overrides,
})

export const makeEntry = (overrides: Partial<StatsEntryRow> = {}): StatsEntryRow => ({
	workoutId: 'w1',
	workoutLocalDate: '2026-10-28',
	position: 0,
	exerciseId: EX_BENCH,
	name: 'Жим лежачи',
	kind: 'STRENGTH',
	muscleGroup: null,
	exercise: { muscleGroup: 'CHEST' },
	durationMin: null,
	distanceM: null,
	sets: [makeSet()],
	...overrides,
})

export const makeWorkout = (overrides: Partial<StatsWorkoutRow> = {}): StatsWorkoutRow => ({
	id: 'w1',
	localDate: '2026-10-28',
	durationMin: 60,
	kcalBurned: null,
	kcalSource: null,
	finishedAt: null,
	finishedMessageId: null,
	entries: [],
	...overrides,
})
