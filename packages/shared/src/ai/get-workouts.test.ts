import { describe, expect, it } from 'vitest'

import {
	formatGetWorkoutsResult,
	GET_WORKOUTS_DESCRIPTION,
	GET_WORKOUTS_INVALID_ARGUMENTS_RESULT,
	getWorkoutsInputSchema,
	parseGetWorkoutsArguments,
	type WorkoutsReadData,
	workoutsReadDataSchema,
} from './get-workouts.js'
import { getAiFunctionTools } from './tools.js'

const data: WorkoutsReadData = {
	from: '2026-10-12',
	to: '2026-11-10',
	days: 30,
	firstEverDate: '2025-09-03',
	totalEver: 84,
	exercise: null,
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
		planned: 9,
		done: 7,
		missed: [{ from: '2026-10-26', to: '2026-11-01', done: 1, planned: 3 }],
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
			'Program "Все тіло" (3/week, rotation) since 2026-10-05: planned 9, done 7; short weeks: 26.10–01.11 1 of 3.',
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

		expect(matched).toContain('Exercise "жим" matches: "Жим лежачи", "Жим стоячи".')
		expect(matched).toContain('Workouts with it: 2')
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
				planned: 0,
				done: 0,
				missed: [],
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
