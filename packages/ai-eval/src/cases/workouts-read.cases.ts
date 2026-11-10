// get_workouts (0.11.2): the model reads the workouts of a period instead of saying it only sees
// today's. The runner answers the call with the shared formatter over `workoutsRead`, the numbers
// the backend would have counted; a case judges whether the call was right (period, end, exercise)
// and whether the reply quotes the numbers. Synthetic data only. Clock: Tue 2026-11-10 evening.
import type { FoodParseContext, WorkoutsReadData } from '@kus/shared'

import { atClock } from './case-builders.js'
import type { EvalCase } from './case.types.js'

const CLOCK = atClock('2026-11-10 19:00, Tuesday')

const NO_SESSIONS: WorkoutsReadData = {
	from: '2026-10-12',
	to: '2026-11-10',
	days: 30,
	firstEverDate: '2025-09-03',
	totalEver: 84,
	exercise: null,
	count: 0,
	firstDate: null,
	lastDate: null,
	avgDurationMin: null,
	hasEstimatedDuration: false,
	workingSets: 0,
	sessions: [],
	olderNotListed: 0,
	exercises: [],
	records: [],
	program: null,
	hasOpenSession: false,
}

const BENCH_SESSION = { name: 'Жим лежачи', summary: '5×5 at 80 kg', isRecord: false }

/** Sessions of the «Все тіло» template on the given days, newest first. */
const sessionsOn = (dates: string[], exercises = [BENCH_SESSION]) =>
	dates.map((date) => ({
		date,
		templateName: 'Все тіло',
		durationMin: 55,
		isDurationEstimate: false,
		exercises,
	}))

/** w1 of today: a finished gym session the context already shows. */
const TODAY_GYM: Partial<FoodParseContext> = {
	...CLOCK,
	workouts: [
		{
			ref: 'w1',
			place: 'GYM',
			time: '17:30',
			lastAt: '18:20',
			finished: true,
			durationMin: 50,
			kcalBurned: null,
			exercises: [
				{
					name: 'Жим лежачи',
					exerciseRef: 'x1',
					muscleGroup: 'CHEST',
					sets: Array.from({ length: 3 }, () => ({ reps: 8, weightKg: 80, isWarmup: false })),
					durationMin: null,
					distanceKm: null,
				},
			],
		},
	],
}

const NOVEMBER_DATES = ['2026-11-09', '2026-11-06', '2026-11-04', '2026-11-02']

const MONTH_DATES = [
	'2026-11-09',
	'2026-11-07',
	'2026-11-05',
	'2026-11-03',
	'2026-11-02',
	'2026-10-30',
	'2026-10-28',
	'2026-10-26',
	'2026-10-23',
	'2026-10-21',
	'2026-10-19',
	'2026-10-16',
]

const MONTH_REVIEW: WorkoutsReadData = {
	...NO_SESSIONS,
	count: 12,
	firstDate: '2026-10-16',
	lastDate: '2026-11-09',
	avgDurationMin: 54,
	workingSets: 118,
	sessions: sessionsOn(MONTH_DATES).map((session) =>
		session.date === '2026-11-03'
			? {
					...session,
					exercises: [{ name: 'Жим лежачи', summary: '5×5 at 85 kg', isRecord: true }],
				}
			: session,
	),
	exercises: [
		{
			name: 'Жим лежачи',
			sessionCount: 12,
			setCount: 60,
			bestInPeriod: { weightKg: 85, reps: 5 },
			bestEver: { weightKg: 85, reps: 5 },
			bestEverDate: '2026-11-03',
			change: 5,
		},
	],
	records: [{ date: '2026-11-03', exercise: 'Жим лежачи', type: 'WEIGHT', value: 85 }],
	program: {
		title: 'Все тіло',
		mode: 'ROTATE',
		perWeek: 3,
		since: '2026-10-05',
		planned: 12,
		done: 10,
		missed: [
			{ from: '2026-10-19', to: '2026-10-25', done: 2, planned: 3 },
			{ from: '2026-10-26', to: '2026-11-01', done: 2, planned: 3 },
		],
	},
}

export const WORKOUTS_READ_CASES: EvalCase[] = [
	{
		id: 'read-workouts-first-ever',
		text: 'Коли я почав ходити в зал?',
		context: CLOCK,
		workoutsRead: {
			...NO_SESSIONS,
			from: '2026-08-11',
			days: 92,
			count: 30,
			firstDate: '2026-08-12',
			lastDate: '2026-11-09',
			avgDurationMin: 54,
			workingSets: 300,
			sessions: sessionsOn(MONTH_DATES),
			olderNotListed: 10,
		},
		expect: {
			decision: 'reply',
			getWorkouts: { called: true },
			replyIncludesAny: ['03.09', '3 вересня', 'вересн'],
			replyExcludes: ['лише сьогодн', 'не бачу', 'немає записів'],
		},
		reference:
			'The first workout ever is in the result header whatever the period (2025-09-03, 84 in all): the reply names the date, never «I only see today»',
	},
	{
		id: 'read-workouts-month-count',
		text: 'Скільки тренувань у мене цього місяця?',
		context: CLOCK,
		workoutsRead: {
			...NO_SESSIONS,
			from: '2026-11-01',
			days: 10,
			count: 4,
			firstDate: '2026-11-02',
			lastDate: '2026-11-09',
			avgDurationMin: 54,
			workingSets: 40,
			sessions: sessionsOn(NOVEMBER_DATES),
		},
		expect: {
			decision: 'reply',
			getWorkouts: { called: true, days: { min: 10, max: 10 }, endDateNull: true },
			replyIncludes: ['4'],
		},
		reference:
			'«Цього місяця» = from the 1st to today: days 10 (01.11–10.11), endDate null; the count (4) is quoted from the result, not counted by the model',
	},
	{
		id: 'read-workouts-bench-record',
		text: 'Який мій рекорд у жимі?',
		context: CLOCK,
		workoutsRead: {
			...NO_SESSIONS,
			from: '2026-08-11',
			days: 92,
			exercise: { query: 'жим', matched: ['Жим лежачи', 'Жим стоячи'] },
			count: 20,
			firstDate: '2026-08-12',
			lastDate: '2026-11-09',
			avgDurationMin: 54,
			workingSets: 160,
			sessions: sessionsOn(MONTH_DATES),
			olderNotListed: 8,
			exercises: [
				{
					name: 'Жим лежачи',
					sessionCount: 18,
					setCount: 90,
					bestInPeriod: { weightKg: 85, reps: 5 },
					bestEver: { weightKg: 85, reps: 5 },
					bestEverDate: '2026-11-03',
					change: 10,
				},
				{
					name: 'Жим стоячи',
					sessionCount: 9,
					setCount: 36,
					bestInPeriod: { weightKg: 50, reps: 8 },
					bestEver: { weightKg: 52.5, reps: 6 },
					bestEverDate: '2026-09-14',
					change: 2.5,
				},
			],
			records: [{ date: '2026-11-03', exercise: 'Жим лежачи', type: 'WEIGHT', value: 85 }],
		},
		expect: {
			decision: 'reply',
			getWorkouts: { called: true, exerciseStem: 'жим' },
			replyIncludes: ['85'],
		},
		reference:
			'«Жим» matches two exercises; the bench record (85 kg×5, 03.11) is the one the question is about and is quoted from the result',
	},
	{
		id: 'read-workouts-month-review',
		text: 'Оціни мої тренування за місяць',
		context: CLOCK,
		workoutsRead: MONTH_REVIEW,
		expect: {
			decision: 'reply',
			getWorkouts: { called: true, days: { min: 28, max: 31 } },
			replyIncludesAny: ['12', '10 з 12', '85'],
			replyExcludes: ['ккал', 'схуд'],
		},
		reference:
			"#26: a review of the month's training is a reply from get_workouts (12 sessions, program 10 of 12, bench record 85), not a show_stats card; no calories or weight-loss talk",
	},
	{
		id: 'read-workouts-today-no-call',
		text: 'Що я сьогодні робив у залі?',
		context: TODAY_GYM,
		expect: {
			decision: 'reply',
			getWorkouts: { called: false },
			replyIncludesAny: ['жим'],
		},
		reference: "Only today's workouts: they are in the context (w1), no call to get_workouts",
	},
	{
		id: 'read-workouts-empty-week',
		text: 'Я тренувався минулого тижня?',
		context: CLOCK,
		workoutsRead: {
			...NO_SESSIONS,
			from: '2026-11-02',
			to: '2026-11-08',
			days: 7,
		},
		expect: {
			decision: 'reply',
			getWorkouts: { called: true, days: { min: 7, max: 7 } },
			replyIncludesAny: ['немає', 'нема', 'жодн', 'не було', 'не записан', 'не тренув'],
			replyExcludes: ['ніколи', 'не бачу', 'лише сьогодн'],
		},
		reference:
			'Nothing in the period (the result says «No workouts in this period.» but the header has the first workout ever): the reply says none are logged last week, not that there never were any',
	},
	{
		id: 'read-workouts-missed-program',
		text: 'Скільки тренувань я пропустив за програмою?',
		context: CLOCK,
		workoutsRead: {
			...MONTH_REVIEW,
			count: 7,
			program: {
				title: 'Все тіло',
				mode: 'ROTATE',
				perWeek: 3,
				since: '2026-10-05',
				planned: 9,
				done: 7,
				missed: [
					{ from: '2026-10-26', to: '2026-11-01', done: 1, planned: 3 },
					{ from: '2026-11-02', to: '2026-11-08', done: 2, planned: 3 },
				],
			},
		},
		expect: {
			decision: 'reply',
			getWorkouts: { called: true },
			replyIncludes: ['2'],
		},
		reference:
			"The program is 3 a week: planned 9, done 7 — the reply says 2 were missed (the backend's numbers), not its own count",
	},
	{
		id: 'read-workouts-log-no-read',
		text: 'Зал: жим 80 3×8',
		context: CLOCK,
		expect: {
			decision: 'workout',
			getWorkouts: { called: false },
			workouts: [
				{
					place: 'GYM',
					exercises: [{ nameIncludes: 'жим', kind: 'STRENGTH', sets: 3, reps: 8, weightKg: 80 }],
				},
			],
		},
		reference: 'A new workout is logged straight away: reading the past is not needed for it',
	},
]
