import type { WorkoutStatsResponse } from '@kus/shared'

export const BENCH_ID = '0199b3a4-0000-7000-8000-0000000000b1'
export const PULLUP_ID = '0199b3a4-0000-7000-8000-0000000000b2'
export const TREADMILL_ID = '0199b3a4-0000-7000-8000-0000000000b3'
export const BIKE_ID = '0199b3a4-0000-7000-8000-0000000000b4'

/** Tests only: a month with strength and cardio; `overrides` change the top-level parts. */
export const makeWorkoutStats = (
	overrides: Partial<WorkoutStatsResponse> = {},
): WorkoutStatsResponse => ({
	period: 'month',
	from: '2026-10-01',
	to: '2026-10-31',
	previous: { from: '2026-09-01', to: '2026-09-30' },
	overview: {
		workoutCount: 6,
		workoutCountPrev: 4,
		avgPerWeek: 1.5,
		exerciseCount: 2,
		setCount: 14,
		durationMin: 310,
		durationWorkoutCount: 6,
		avgDurationMin: 52,
		hasEstimatedDuration: true,
		burned: null,
		buckets: [
			{
				from: '2026-09-28',
				to: '2026-10-04',
				isFuture: false,
				workoutCount: 2,
				setCount: 6,
				cardioMin: 40,
			},
			{
				from: '2026-10-05',
				to: '2026-10-11',
				isFuture: false,
				workoutCount: 3,
				setCount: 8,
				cardioMin: 0,
			},
			{
				from: '2026-10-12',
				to: '2026-10-18',
				isFuture: false,
				workoutCount: 1,
				setCount: 0,
				cardioMin: 20,
			},
		],
		groups: [
			{ muscleGroup: 'CHEST', setCount: 8 },
			{ muscleGroup: 'BACK', setCount: 4 },
			{ muscleGroup: null, setCount: 2 },
		],
	},
	exercises: [
		{
			exerciseId: BENCH_ID,
			name: 'Жим лежачи',
			muscleGroup: 'CHEST',
			isBodyweight: false,
			sessionCount: 3,
			setCount: 9,
			lastLocalDate: '2026-10-26',
			best: { weightKg: 70, reps: 5, localDate: '2026-10-26' },
			change: 10,
			trend: [60, 65, 70],
		},
		{
			exerciseId: PULLUP_ID,
			name: 'Підтягування',
			muscleGroup: 'BACK',
			isBodyweight: true,
			sessionCount: 2,
			setCount: 5,
			lastLocalDate: '2026-10-20',
			best: { weightKg: null, reps: 9, localDate: '2026-10-20' },
			change: null,
			trend: [8, 9],
		},
	],
	cardio: {
		sessionCount: 2,
		durationMin: 60,
		distanceM: 3000,
		buckets: [
			{ from: '2026-09-28', to: '2026-10-04', isFuture: false, minutes: 40 },
			{ from: '2026-10-05', to: '2026-10-11', isFuture: false, minutes: 0 },
			{ from: '2026-10-12', to: '2026-10-18', isFuture: false, minutes: 20 },
		],
		byExercise: [
			{
				exerciseId: TREADMILL_ID,
				name: 'Бігова доріжка',
				sessionCount: 1,
				durationMin: 40,
				distanceM: 3000,
			},
			{
				exerciseId: BIKE_ID,
				name: 'Велотренажер',
				sessionCount: 1,
				durationMin: 20,
				distanceM: null,
			},
		],
	},
	...overrides,
})
