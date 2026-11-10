import { describe, expect, it } from 'vitest'

import {
	formatGetWorkoutsResult,
	formatWorkoutsDigest,
	GET_WORKOUTS_DESCRIPTION,
	GET_WORKOUTS_INVALID_ARGUMENTS_RESULT,
	getWorkoutsInputSchema,
	parseGetWorkoutsArguments,
	type WorkoutsReadData,
	workoutsReadDataSchema,
} from './get-workouts.js'
import { formatFindFoodDigest } from './find-food.js'
import { READ_DIGEST_MAX_CHARS } from './read-digest.js'
import { getAiFunctionTools } from './tools.js'

const data: WorkoutsReadData = {
	from: '2026-10-12',
	to: '2026-11-10',
	days: 30,
	firstEverDate: '2025-09-03',
	totalEver: 84,
	exercise: null,
	periodCount: 2,
	count: 2,
	firstDate: '2026-10-13',
	lastDate: '2026-11-03',
	avgDurationMin: 52,
	hasEstimatedDuration: true,
	workingSets: 18,
	sessions: [
		{
			date: '2026-11-03',
			templateName: 'Все тіло',
			durationMin: 55,
			isDurationEstimate: true,
			exercises: [
				{ name: 'Жим "лежачи"', summary: '3×5 at 85 kg', isRecord: true },
				{ name: 'Біг', summary: '30 min, 5.0 km', isRecord: false },
			],
		},
		{
			date: '2026-10-13',
			templateName: null,
			durationMin: null,
			isDurationEstimate: false,
			exercises: [],
		},
	],
	olderNotListed: 3,
	exercises: [
		{
			name: 'Жим лежачи',
			sessionCount: 2,
			setCount: 6,
			bestInPeriod: { weightKg: 85, reps: 5 },
			bestEver: { weightKg: 90, reps: 3 },
			bestEverDate: '2026-08-01',
			change: 5,
		},
	],
	records: [{ date: '2026-11-03', exercise: 'Жим лежачи', type: 'WEIGHT', value: 85 }],
	program: {
		title: 'Все тіло',
		mode: 'ROTATE',
		perWeek: 3,
		since: '2026-10-05',
		judged: { from: '2026-10-12', to: '2026-11-01' },
		planned: 9,
		done: 7,
		missed: [{ from: '2026-10-26', to: '2026-11-01', done: 1, planned: 3 }],
		notJudged: 0,
		thisWeek: null,
	},
	hasOpenSession: false,
}

describe('get_workouts arguments', () => {
	it('fills endDate and exercise with null', () => {
		expect(parseGetWorkoutsArguments('{"days":30}')).toEqual({
			days: 30,
			endDate: null,
			exercise: null,
		})
	})

	it('rejects days out of 1..92, a bad date, an empty exercise and broken JSON', () => {
		for (const raw of [
			'{"days":0}',
			'{"days":93}',
			'{"days":7.5}',
			'{"days":7,"endDate":"yesterday"}',
			'{"days":7,"exercise":"  "}',
			`{"days":7,"exercise":"${'x'.repeat(41)}"}`,
			'not json',
		]) {
			expect(parseGetWorkoutsArguments(raw), raw).toBeNull()
		}
		expect(GET_WORKOUTS_INVALID_ARGUMENTS_RESULT).toMatch(/^error: invalid arguments/)
	})

	it('trims the exercise', () => {
		expect(getWorkoutsInputSchema.parse({ days: 7, exercise: ' жим ' }).exercise).toBe('жим')
	})
})

describe('formatGetWorkoutsResult', () => {
	it('starts with the period and the first workout ever, then lists the numbers', () => {
		expect(formatGetWorkoutsResult(data).split('\n')).toEqual([
			'Period 2026-10-12…2026-11-10 (30 days). First workout ever: 2025-09-03; all time: 84 workouts.',
			'Workouts: 2 (first 2026-10-13, last 2026-11-03); avg 52 min (some estimated); working sets 18.',
			'Program "Все тіло" (3/week, rotation) since 2026-10-05. Plan check counts only whole Mon–Sun weeks of the period that are over: 12.10–01.11 — planned 9, done 7; short weeks: 26.10–01.11 1 of 3.',
			'Sessions, newest first:',
			'- 2026-11-03 "Все тіло" ≈55 min: "Жим \'лежачи\'" 3×5 at 85 kg (record); "Біг" 30 min, 5.0 km',
			'- 2026-10-13',
			'(3 older not listed)',
			'Exercises:',
			'- "Жим лежачи": 2 sessions; 6 working sets; best in period 85 kg×5; best ever 90 kg×3 on 2026-08-01; change +5 kg',
			'Records in period:',
			'- 2026-11-03 "Жим лежачи" WEIGHT 85 kg',
		])
	})

	it('keeps the first workout ever when the period is empty', () => {
		const text = formatGetWorkoutsResult({
			...data,
			count: 0,
			firstDate: null,
			lastDate: null,
			avgDurationMin: null,
			workingSets: 0,
			sessions: [],
			olderNotListed: 0,
			exercises: [],
			records: [],
			program: null,
		})

		expect(text.split('\n')).toEqual([
			'Period 2026-10-12…2026-11-10 (30 days). First workout ever: 2025-09-03; all time: 84 workouts.',
			'No workouts in this period.',
		])
	})

	it('says so when the user has no workout at all', () => {
		const text = formatGetWorkoutsResult({
			...data,
			firstEverDate: null,
			totalEver: 0,
			count: 0,
			sessions: [],
			exercises: [],
			records: [],
			program: null,
		})

		expect(text).toContain('First workout ever: none logged; all time: 0 workouts.')
	})

	it('names the matched exercises, or the known ones when nothing matched', () => {
		const matched = formatGetWorkoutsResult({
			...data,
			exercise: { query: 'жим', matched: ['Жим лежачи', 'Жим стоячи'] },
		})
		const none = formatGetWorkoutsResult({
			...data,
			count: 0,
			exercise: { query: 'присід', matched: [] },
			knownExercises: ['Жим лежачи', 'Станова тяга'],
		})

		expect(matched).toContain(
			'Matched exercises: "Жим лежачи"; "Жим стоячи" (the user said "жим"). Figures below are per exercise.',
		)
		expect(matched).toContain('Workouts with it: 2 of 2 in the period (first 2026-10-13')
		expect(matched).toContain('Records in period (this exercise only):')
		expect(none).toContain(
			'Exercise "присід": no match among the user\'s exercises. Known exercises: "Жим лежачи", "Станова тяга".',
		)
	})

	it('notes an open session, and prints a rotation without a plan as one line', () => {
		const text = formatGetWorkoutsResult({
			...data,
			hasOpenSession: true,
			program: {
				title: 'Все тіло',
				mode: 'ROTATE',
				perWeek: null,
				since: '2026-10-05',
				judged: null,
				planned: 0,
				done: 0,
				missed: [],
				notJudged: 0,
				thisWeek: null,
			},
		})

		expect(text).toContain('Program "Все тіло" (rotation) since 2026-10-05.')
		expect(text.split('\n').at(-1)).toBe(
			'An open session of today is not counted here — see "Today\'s workouts".',
		)
	})

	it('uses reps as the unit of a bodyweight change', () => {
		const text = formatGetWorkoutsResult({
			...data,
			exercises: [
				{
					name: 'Підтягування',
					sessionCount: 3,
					setCount: 9,
					bestInPeriod: { weightKg: null, reps: 12 },
					bestEver: { weightKg: null, reps: 12 },
					bestEverDate: '2026-11-03',
					change: -2,
				},
			],
		})

		expect(text).toContain('best ever 12 reps on 2026-11-03; change -2 reps')
	})
})

const getProgram = (): NonNullable<WorkoutsReadData['program']> => {
	if (data.program === null) throw new Error('the fixture has a program')
	return data.program
}

describe('formatGetWorkoutsResult program line', () => {
	const program = getProgram()
	const withProgram = (overrides: Partial<typeof program>, periodCount = 3): string[] =>
		formatGetWorkoutsResult({
			...data,
			periodCount,
			program: { ...program, ...overrides },
		}).split('\n')

	it('names the judged weeks and what stayed out of the check', () => {
		const lines = withProgram({
			since: '2026-10-20',
			judged: { from: '2026-11-02', to: '2026-11-08' },
			planned: 3,
			done: 1,
			missed: [{ from: '2026-11-02', to: '2026-11-08', done: 1, planned: 3 }],
			notJudged: 2,
			thisWeek: { from: '2026-11-09', to: '2026-11-15', done: 1, planned: 3 },
		})

		expect(lines).toContain(
			'Program "Все тіло" (3/week, rotation) since 2026-10-20. Plan check counts only whole Mon–Sun weeks of the period that are over: 02.11–08.11 — planned 3, done 1; short weeks: 02.11–08.11 1 of 3. Not in the check: 2 of the period\'s 3 workouts (outside these weeks or above 3/week).',
		)
		expect(lines).toContain('This week so far: 1 of 3 (not over).')
	})

	it('says nothing is judged while no whole week is over, and the week so far is no miss', () => {
		const lines = withProgram({
			judged: null,
			planned: 0,
			done: 0,
			missed: [],
			notJudged: 1,
			thisWeek: { from: '2026-11-09', to: '2026-11-15', done: 1, planned: 3 },
		})

		expect(lines).toContain(
			'Program "Все тіло" (3/week, rotation) since 2026-10-05. No whole week of the period is over yet: nothing to judge.',
		)
		expect(lines).toContain('This week so far: 1 of 3 (not over).')
	})

	it('counts fixed weekdays from the start to the end of the judged days', () => {
		const lines = withProgram({
			mode: 'WEEKDAYS',
			perWeek: null,
			judged: { from: '2026-11-02', to: '2026-11-09' },
			planned: 4,
			done: 3,
			missed: [{ from: '2026-11-02', to: '2026-11-08', done: 2, planned: 3 }],
			notJudged: 0,
			thisWeek: { from: '2026-11-09', to: '2026-11-10', done: 1, planned: 1 },
		})

		expect(lines).toContain(
			'Program "Все тіло" (fixed weekdays) since 2026-10-05. Plan check counts planned weekdays from 02.11 to 09.11: planned 4, done 3; short weeks: 02.11–08.11 2 of 3.',
		)
		expect(lines).toContain('This week so far: 1 of 1 planned days up to today (not over).')
	})
})

describe('formatWorkoutsDigest', () => {
	it('gives the period, the count with its dates, the program verdict and the newest records', () => {
		const digest = formatWorkoutsDigest({
			...data,
			from: '2026-11-01',
			count: 3,
			periodCount: 3,
			sessions: ['2026-11-09', '2026-11-05', '2026-11-01'].map((date) => ({
				date,
				templateName: null,
				durationMin: null,
				isDurationEstimate: false,
				exercises: [],
			})),
			program: {
				...getProgram(),
				judged: { from: '2026-11-02', to: '2026-11-08' },
				planned: 3,
				done: 1,
				missed: [{ from: '2026-11-02', to: '2026-11-08', done: 1, planned: 3 }],
			},
			records: [{ date: '2026-11-09', exercise: 'Станова тяга', type: 'WEIGHT', value: 68 }],
		})

		expect(digest).toBe(
			'read workouts 01.11–10.11: 3 (01.11, 05.11, 09.11); program 3/week: 02.11–08.11 1 of 3; records: 09.11 "Станова тяга" 68 kg',
		)
	})

	it('names the exercise asked for and the share of the period', () => {
		const digest = formatWorkoutsDigest({
			...data,
			exercise: { query: 'жим', matched: ['Жим лежачи'] },
			periodCount: 3,
			count: 1,
			program: null,
			records: [],
			sessions: data.sessions.slice(0, 1),
		})

		expect(digest).toBe('read workouts 12.10–10.11, "жим": 1 of 3 (03.11)')
	})

	it('is never longer than 200 characters and keeps the head when the rest is dropped', () => {
		const long = formatWorkoutsDigest({
			...data,
			records: Array.from({ length: 5 }, (_, index) => ({
				date: '2026-11-03',
				exercise: `Дуже довга назва вправи номер ${index}`,
				type: 'WEIGHT' as const,
				value: 100,
			})),
		})

		expect(long.length).toBeLessThanOrEqual(READ_DIGEST_MAX_CHARS)
		expect(long.startsWith('read workouts 12.10–10.11: 2 (')).toBe(true)
	})
})

describe('formatFindFoodDigest', () => {
	it('is a short line without refs', () => {
		expect(formatFindFoodDigest('батончик', 2)).toBe('looked up food "батончик": 2 found')
	})
})

describe('workoutsReadDataSchema', () => {
	it('accepts the shape the formatter reads', () => {
		expect(workoutsReadDataSchema.safeParse(data).success).toBe(true)
	})
})

describe('get_workouts as the model sees it', () => {
	it('is offered after find_food with the approved description', () => {
		const names = getAiFunctionTools().map((tool) => tool.function.name)
		const tool = getAiFunctionTools().at(-1)

		expect(names.slice(-2)).toEqual(['find_food', 'get_workouts'])
		expect(tool?.function.description).toBe(GET_WORKOUTS_DESCRIPTION)
		expect(GET_WORKOUTS_DESCRIPTION.length).toBeLessThan(1200)
	})
})
