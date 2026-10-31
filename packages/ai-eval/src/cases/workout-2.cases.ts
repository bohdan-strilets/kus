// Training 2.0 (0.10.0): a session told over several messages — appendRef to an open workout of
// «Today's workouts», finish on «все» / «закінчив» or a whole workout in one message, a group fix
// of an exercise from «Exercises» (exerciseGroups), the muscle group of a named exercise (the
// shared dictionary first, the model's own where it has none), a warm-up and body weight.
// Synthetic data only. Clock: Wed 2026-10-07 evening.
import type { FoodParseContext, TodayWorkoutContext, WorkoutSetContext } from '@kus/shared'

import { atClock } from './case-builders.js'
import type { EvalCase } from './case.types.js'

const EVENING = atClock('2026-10-07 19:30, Wednesday')
const LATE_EVENING = atClock('2026-10-07 20:15, Wednesday')
const YESTERDAY = '2026-10-06'

const sets = (count: number, reps: number, weightKg: number | null): WorkoutSetContext[] =>
	Array.from({ length: count }, () => ({ reps, weightKg, isWarmup: false }))

const BENCH = { name: 'Жим лежачи', exerciseRef: 'x1', muscleGroup: 'CHEST' as const }
const SQUAT = { name: 'Присідання', exerciseRef: 'x2', muscleGroup: 'LEGS' as const }

/** w1: a gym session started at 18:30, the last entry at 19:10 — still open at 19:30. */
const OPEN_GYM: TodayWorkoutContext = {
	ref: 'w1',
	place: 'GYM',
	time: '18:30',
	lastAt: '19:10',
	finished: false,
	durationMin: null,
	kcalBurned: null,
	exercises: [
		{ ...BENCH, sets: sets(3, 8, 80), durationMin: null, distanceKm: null },
		{ ...SQUAT, sets: sets(4, 6, 90), durationMin: null, distanceKm: null },
	],
}

/** «Exercises» with the two exercises of the open session, done today. */
const SESSION_EXERCISES: FoodParseContext['exercises'] = [
	{
		ref: 'x1',
		name: BENCH.name,
		kind: 'STRENGTH',
		muscleGroup: BENCH.muscleGroup,
		last: { date: '2026-10-07', sets: sets(3, 8, 80), durationMin: null, distanceKm: null },
	},
	{
		ref: 'x2',
		name: SQUAT.name,
		kind: 'STRENGTH',
		muscleGroup: SQUAT.muscleGroup,
		last: { date: '2026-10-07', sets: sets(4, 6, 90), durationMin: null, distanceKm: null },
	},
]

const WITH_OPEN_GYM: Partial<FoodParseContext> = {
	...EVENING,
	workouts: [OPEN_GYM],
	exercises: SESSION_EXERCISES,
}

/** The same session closed with «все» at 19:40; 35 minutes later it is still within 3 h. */
const WITH_FINISHED_GYM: Partial<FoodParseContext> = {
	...LATE_EVENING,
	workouts: [{ ...OPEN_GYM, lastAt: '19:40', finished: true }],
	exercises: SESSION_EXERCISES,
}

/** The squat was stored with a wrong group (BACK); the user corrects it. */
const WITH_SQUAT_AS_BACK: Partial<FoodParseContext> = {
	...EVENING,
	workouts: [
		{
			...OPEN_GYM,
			exercises: [
				{
					...SQUAT,
					exerciseRef: 'x1',
					muscleGroup: 'BACK',
					sets: sets(4, 6, 90),
					durationMin: null,
					distanceKm: null,
				},
			],
		},
	],
	exercises: [
		{
			ref: 'x1',
			name: SQUAT.name,
			kind: 'STRENGTH',
			muscleGroup: 'BACK',
			last: { date: '2026-10-07', sets: sets(4, 6, 90), durationMin: null, distanceKm: null },
		},
	],
}

export const WORKOUT_2_CASES: EvalCase[] = [
	{
		id: 'workout-2-done-vse',
		text: 'все',
		context: WITH_OPEN_GYM,
		expect: {
			decision: 'workout',
			workouts: [{ appendRef: 'w1', replaceRef: null, finish: true, exercises: [] }],
		},
		reference: '«все» during an open session: appendRef w1 + finish, no exercises',
	},
	{
		id: 'workout-2-done-zakinchyv',
		text: 'закінчив',
		context: WITH_OPEN_GYM,
		expect: {
			decision: 'workout',
			workouts: [{ appendRef: 'w1', replaceRef: null, finish: true, exercises: [] }],
		},
		reference: '«закінчив» is the same as «все»: appendRef w1 + finish, no exercises',
	},
	{
		id: 'workout-2-squat-is-legs',
		text: 'присід — це ноги',
		context: WITH_SQUAT_AS_BACK,
		expect: {
			decision: 'workout',
			workouts: [{ replaceRef: null, finish: false, exerciseGroups: ['x1:LEGS'], exercises: [] }],
		},
		reference:
			'A group fix of x1 from «Exercises» (stored as BACK): exerciseGroups ["x1:LEGS"], no new exercise or workout',
	},
	{
		id: 'workout-2-whole-in-one',
		text: 'сьогодні в залі: жим лежачи 80 3×8, тяга верхнього блоку 55 3×10, присід 90 4×6, бруси 3×12',
		context: atClock('2026-10-07 21:00, Wednesday'),
		expect: {
			decision: 'workout',
			workouts: [
				{
					place: 'GYM',
					appendRef: null,
					finish: true,
					exercises: [
						{ nameIncludes: 'жим', sets: 3, weightKg: 80, reps: 8, muscleGroup: 'CHEST' },
						{ nameIncludes: 'тяг', sets: 3, weightKg: 55, reps: 10, muscleGroup: 'BACK' },
						{ nameIncludes: 'присід', sets: 4, weightKg: 90, reps: 6, muscleGroup: 'LEGS' },
						{ nameIncludes: 'брус', sets: 3, reps: 12, muscleGroup: 'CHEST' },
					],
				},
			],
		},
		reference:
			'A whole workout told afterwards in one message, without «все»: finish true, a new session',
	},
	{
		id: 'workout-2-deadlift-legs',
		text: 'станова 120 3×5',
		expect: {
			decision: 'workout',
			workouts: [
				{
					exercises: [
						{ nameIncludes: 'станов', sets: 3, weightKg: 120, reps: 5, muscleGroup: 'LEGS' },
					],
				},
			],
		},
		reference: 'The dictionary puts the deadlift in LEGS (the name must keep «станова»)',
	},
	{
		id: 'workout-2-dips-chest',
		text: 'бруси 3 по 10',
		expect: {
			decision: 'workout',
			workouts: [
				{
					exercises: [
						{ nameIncludes: 'брус', sets: 3, reps: 10, weightKg: null, muscleGroup: 'CHEST' },
					],
				},
			],
		},
		reference: 'Dips on parallel bars → CHEST by the dictionary; body weight, no kg',
	},
	{
		id: 'workout-2-model-group',
		text: 'розгинання спини 3×15',
		expect: {
			decision: 'workout',
			workouts: [
				{
					exercises: [
						{ nameIncludes: 'спин', sets: 3, reps: 15, muscleGroup: 'BACK', isModelGroup: true },
					],
				},
			],
		},
		reference:
			"«Розгинання спини» has no dictionary group (matchMuscleGroup → null): the model's own group is checked, BACK",
	},
	{
		id: 'workout-2-append-open',
		text: 'тяга штанги в нахилі 60 4×10',
		context: WITH_OPEN_GYM,
		expect: {
			decision: 'workout',
			workouts: [
				{
					appendRef: 'w1',
					replaceRef: null,
					finish: false,
					exercises: [{ nameIncludes: 'тяг', sets: 4, weightKg: 60, reps: 10 }],
				},
			],
		},
		reference:
			'The last entry of w1 was 20 min ago and no place is named: append to w1, the session goes on',
	},
	{
		id: 'workout-2-append-same-place',
		text: 'в залі ще жим ногами 150 3×12',
		context: WITH_OPEN_GYM,
		expect: {
			decision: 'workout',
			workouts: [
				{
					appendRef: 'w1',
					replaceRef: null,
					exercises: [
						{ nameIncludes: 'жим', sets: 3, weightKg: 150, reps: 12, muscleGroup: 'LEGS' },
					],
				},
			],
		},
		reference: 'The same place as w1 (GYM), within 3 h: append to w1',
	},
	{
		id: 'workout-2-other-place',
		text: 'вдома зробив віджимання 3 по 20',
		context: WITH_OPEN_GYM,
		expect: {
			decision: 'workout',
			workouts: [
				{
					place: 'HOME',
					appendRef: null,
					replaceRef: null,
					exercises: [{ nameIncludes: 'віджим', sets: 3, reps: 20 }],
				},
			],
		},
		reference: 'w1 is a GYM session, this one is at home: a new workout, no appendRef',
	},
	{
		id: 'workout-2-finish-bike-kcal',
		text: 'все, наостанок вело 20 хв, табло показало 180 ккал',
		context: WITH_OPEN_GYM,
		expect: {
			decision: 'workout',
			workouts: [
				{
					appendRef: 'w1',
					finish: true,
					kcalBurned: 180,
					exercises: [{ nameIncludes: 'вел', kind: 'CARDIO', durationMin: 20 }],
				},
			],
		},
		reference:
			'«все» with a last exercise: appendRef w1 + finish, the bike added, the kcal from the display stored',
	},
	{
		id: 'workout-2-warmup',
		text: 'жим: 40 на 10 розминка, потім 60 на 8 три підходи',
		expect: {
			decision: 'workout',
			workouts: [
				{
					exercises: [{ nameIncludes: 'жим', sets: 4, warmupSets: 1, weightKg: 60, reps: 8 }],
				},
			],
		},
		reference: 'The first set is a warm-up (isWarmup), then three working sets of 60 × 8',
	},
	{
		id: 'workout-2-bodyweight-pullups',
		text: 'підтягування 8, 7, 6',
		expect: {
			decision: 'workout',
			workouts: [
				{
					exercises: [
						{ nameIncludes: 'підтяг', sets: 3, reps: 8, weightKg: null, muscleGroup: 'BACK' },
					],
				},
			],
		},
		reference: 'Body weight: three sets 8, 7, 6 and weightKg null, not 0 or a made-up number',
	},
	{
		id: 'workout-2-forgot-after-finish',
		text: 'забув: ще скручування 3 по 15',
		context: WITH_FINISHED_GYM,
		expect: {
			decision: 'workout',
			workouts: [
				{
					appendRef: 'w1',
					replaceRef: null,
					exercises: [{ nameIncludes: 'скруч', sets: 3, reps: 15, muscleGroup: 'CORE' }],
				},
			],
		},
		reference:
			'w1 is finished, but its last entry was 35 min ago: «забув: ще…» is added to it, not a new workout',
	},
	{
		id: 'workout-2-fix-not-append',
		text: 'ні, жим був 85',
		context: WITH_OPEN_GYM,
		expect: {
			decision: 'workout',
			workouts: [
				{
					replaceRef: 'w1',
					appendRef: null,
					exercises: [
						{ nameIncludes: 'жим', sets: 3, weightKg: 85, reps: 8 },
						{ nameIncludes: 'присід', sets: 4, weightKg: 90, reps: 6 },
					],
				},
			],
		},
		reference: 'A fix of an open session is a replace with the whole workout, never an append',
	},
	{
		id: 'workout-2-yesterday',
		text: 'вчора бігав 5 км',
		context: WITH_OPEN_GYM,
		expect: {
			decision: 'workout',
			workouts: [
				{
					date: YESTERDAY,
					appendRef: null,
					replaceRef: null,
					exercises: [{ nameIncludes: 'біг', kind: 'CARDIO', distanceKm: 5 }],
				},
			],
		},
		reference: 'Another day is a new workout with its date, even while w1 is open today',
	},
]
