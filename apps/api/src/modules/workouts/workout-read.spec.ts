import { describe, expect, it } from 'vitest'

import { buildWorkoutsReadData, type BuildWorkoutsReadInput, matchExercises } from './workout-read'
import { EX_BENCH, EX_PULLUP, makeEntry, makeSet, makeWorkout } from './workout-stats.test-utils'

const BENCH = { id: EX_BENCH, name: 'Жим лежачи', aliases: ['bench'] }
const OHP = { id: 'ex-ohp', name: 'Жим стоячи', aliases: [] }
const SQUAT = { id: 'ex-squat', name: 'Присідання', aliases: [] }

const base = (overrides: Partial<BuildWorkoutsReadInput> = {}): BuildWorkoutsReadInput => ({
	from: '2026-11-01',
	to: '2026-11-10',
	today: '2026-11-10',
	firstEverDate: '2025-09-03',
	totalEver: 84,
	exercise: null,
	knownExerciseNames: [],
	workouts: [],
	entries: [],
	allTimeStrengthEntries: [],
	program: null,
	hasOpenSession: false,
	...overrides,
})

const bench = (workoutId: string, date: string, weightKg: number, id = `e-${workoutId}`) =>
	makeEntry({
		id,
		workoutId,
		workoutLocalDate: date,
		sets: [makeSet({ reps: 5, weightKg }), makeSet({ reps: 5, weightKg })],
	})

describe('matchExercises', () => {
	it('finds the exercises a spoken stem stands for, best first, and none for a stranger word', () => {
		const names = matchExercises('жим', [BENCH, OHP, SQUAT]).map(({ name }) => name)

		expect(names.sort()).toEqual(['Жим лежачи', 'Жим стоячи'])
		expect(matchExercises('станова', [BENCH, OHP, SQUAT])).toEqual([])
	})
})

describe('buildWorkoutsReadData', () => {
	it('keeps the first workout ever and the total for an empty period', () => {
		const data = buildWorkoutsReadData(base())

		expect(data).toMatchObject({
			days: 10,
			firstEverDate: '2025-09-03',
			totalEver: 84,
			count: 0,
			firstDate: null,
			lastDate: null,
			avgDurationMin: null,
			sessions: [],
			exercises: [],
			records: [],
			program: null,
		})
	})

	it('counts sessions, sets and the average, lists newest first with the template and the record', () => {
		const data = buildWorkoutsReadData(
			base({
				workouts: [
					makeWorkout({
						id: 'w1',
						localDate: '2026-11-03',
						durationMin: 50,
						templateName: 'Все тіло',
					}),
					makeWorkout({
						id: 'w2',
						localDate: '2026-11-07',
						durationMin: 70,
						records: [{ exerciseEntryId: 'e-w2', type: 'WEIGHT' }],
					}),
				],
				entries: [bench('w1', '2026-11-03', 80), bench('w2', '2026-11-07', 85)],
				allTimeStrengthEntries: [
					bench('w0', '2026-08-01', 90, 'e-old'),
					bench('w1', '2026-11-03', 80),
					bench('w2', '2026-11-07', 85),
				],
			}),
		)

		expect(data).toMatchObject({
			count: 2,
			firstDate: '2026-11-03',
			lastDate: '2026-11-07',
			avgDurationMin: 60,
			hasEstimatedDuration: false,
			workingSets: 4,
		})
		expect(data.sessions.map(({ date }) => date)).toEqual(['2026-11-07', '2026-11-03'])
		expect(data.sessions[1]?.templateName).toBe('Все тіло')
		expect(data.sessions[0]?.exercises).toEqual([
			{ name: 'Жим лежачи', summary: '2×5 at 85 kg', isRecord: true },
		])
		expect(data.exercises).toEqual([
			{
				name: 'Жим лежачи',
				sessionCount: 2,
				setCount: 4,
				bestInPeriod: { weightKg: 85, reps: 5 },
				bestEver: { weightKg: 90, reps: 5 },
				bestEverDate: '2026-08-01',
				change: 5,
			},
		])
		expect(data.records).toEqual([
			{ date: '2026-11-07', exercise: 'Жим лежачи', type: 'WEIGHT', value: 85 },
		])
	})

	it('lists at most 20 sessions and counts the older ones', () => {
		const workouts = Array.from({ length: 23 }, (_, index) =>
			makeWorkout({ id: `w${index}`, localDate: `2026-10-${String(index + 1).padStart(2, '0')}` }),
		)

		const data = buildWorkoutsReadData(base({ from: '2026-10-01', to: '2026-10-31', workouts }))

		expect(data.count).toBe(23)
		expect(data.sessions).toHaveLength(20)
		expect(data.olderNotListed).toBe(3)
		expect(data.sessions[0]?.date).toBe('2026-10-23')
	})

	it('narrows to the sessions that hold the asked exercise, and names what matched', () => {
		const pullUp = makeEntry({
			id: 'e-p',
			workoutId: 'w2',
			workoutLocalDate: '2026-11-05',
			exerciseId: EX_PULLUP,
			name: 'Підтягування',
			sets: [makeSet({ reps: 8, weightKg: null })],
		})
		const data = buildWorkoutsReadData(
			base({
				exercise: { query: 'жим', matched: [BENCH] },
				workouts: [
					makeWorkout({ id: 'w1', localDate: '2026-11-03' }),
					makeWorkout({ id: 'w2', localDate: '2026-11-05' }),
				],
				entries: [bench('w1', '2026-11-03', 80), pullUp],
				allTimeStrengthEntries: [bench('w1', '2026-11-03', 80)],
			}),
		)

		expect(data.exercise).toEqual({ query: 'жим', matched: ['Жим лежачи'] })
		expect(data.count).toBe(1)
		expect(data.sessions.map(({ date }) => date)).toEqual(['2026-11-03'])
		expect(data.exercises.map(({ name }) => name)).toEqual(['Жим лежачи'])
		expect(data.knownExercises).toBeUndefined()
	})

	it('offers the known exercises when the spoken one matched nothing', () => {
		const names = Array.from({ length: 12 }, (_, index) => `Вправа ${index}`)

		const data = buildWorkoutsReadData(
			base({
				exercise: { query: 'присід', matched: [] },
				knownExerciseNames: names,
				workouts: [makeWorkout({ id: 'w1', localDate: '2026-11-03' })],
				entries: [bench('w1', '2026-11-03', 80)],
			}),
		)

		expect(data.count).toBe(0)
		expect(data.knownExercises).toEqual(names.slice(0, 10))
	})

	it('reports a bodyweight record in reps and a distance record in km', () => {
		const pullUp = makeEntry({
			id: 'e-p',
			workoutId: 'w1',
			workoutLocalDate: '2026-11-05',
			exerciseId: EX_PULLUP,
			name: 'Підтягування',
			sets: [makeSet({ reps: 12, weightKg: null })],
		})
		const run = makeEntry({
			id: 'e-r',
			workoutId: 'w1',
			workoutLocalDate: '2026-11-05',
			exerciseId: null,
			name: 'Біг',
			kind: 'CARDIO',
			position: 1,
			durationMin: 30,
			distanceM: 5200,
			sets: [],
		})

		const data = buildWorkoutsReadData(
			base({
				workouts: [
					makeWorkout({
						id: 'w1',
						localDate: '2026-11-05',
						records: [
							{ exerciseEntryId: 'e-p', type: 'REPS' },
							{ exerciseEntryId: 'e-r', type: 'DISTANCE' },
						],
					}),
				],
				entries: [pullUp, run],
			}),
		)

		expect(data.records.map(({ type, value }) => [type, value])).toEqual([
			['REPS', 12],
			['DISTANCE', 5.2],
		])
		expect(data.sessions[0]?.exercises.map(({ summary }) => summary)).toEqual([
			'1×12',
			'30 min, 5.2 km',
		])
	})

	it('flags an open session and passes the date range', () => {
		expect(buildWorkoutsReadData(base({ hasOpenSession: true })).hasOpenSession).toBe(true)
	})
})

describe('matchExercises family', () => {
	it('takes every exercise that shares the first word of a longer spoken name', () => {
		const chestPress = { id: 'ex-chest', name: 'Жим від грудей', aliases: [] }

		const names = matchExercises('жим від грудей', [BENCH, chestPress, SQUAT, OHP]).map(
			({ name }) => name,
		)

		expect(names).toHaveLength(3)
		expect(names[0]).toBe('Жим від грудей')
		expect(names).toEqual(expect.arrayContaining(['Жим лежачи', 'Жим стоячи']))
	})
})

describe('buildWorkoutsReadData program', () => {
	const rotation = {
		title: 'Все тіло',
		mode: 'ROTATE' as const,
		perWeek: 3,
		since: '2026-10-05',
		weekdays: [],
	}
	// 2026-10-12 is a Monday; weeks 12–18 and 19–25 are over, 26.10–01.11 too
	const perWeekWorkouts = (dates: string[]) =>
		dates.map((localDate, index) => makeWorkout({ id: `w${index}`, localDate }))

	it('plans N a week over finished weeks and lists the short ones', () => {
		const data = buildWorkoutsReadData(
			base({
				from: '2026-10-12',
				to: '2026-11-10',
				program: rotation,
				workouts: perWeekWorkouts([
					'2026-10-12',
					'2026-10-14',
					'2026-10-16',
					'2026-10-19',
					'2026-10-21',
					'2026-10-23',
					'2026-10-27',
				]),
			}),
		)

		// weeks 12.10, 19.10, 26.10 are finished; 02.11–08.11 too (today is Tuesday 10.11); the current week is not
		expect(data.program).toEqual({
			title: 'Все тіло',
			mode: 'ROTATE',
			perWeek: 3,
			since: '2026-10-05',
			judged: { from: '2026-10-12', to: '2026-11-08' },
			planned: 12,
			done: 7,
			missed: [
				{ from: '2026-10-26', to: '2026-11-01', done: 1, planned: 3 },
				{ from: '2026-11-02', to: '2026-11-08', done: 0, planned: 3 },
			],
			notJudged: 0,
			thisWeek: { from: '2026-11-09', to: '2026-11-15', done: 0, planned: 3 },
		})
	})

	it('does not count more than N in a week against other weeks', () => {
		const data = buildWorkoutsReadData(
			base({
				from: '2026-10-12',
				to: '2026-10-25',
				program: rotation,
				workouts: perWeekWorkouts([
					'2026-10-12',
					'2026-10-13',
					'2026-10-14',
					'2026-10-15',
					'2026-10-16',
				]),
			}),
		)

		expect(data.program).toMatchObject({ planned: 6, done: 3 })
		expect(data.program?.missed).toEqual([
			{ from: '2026-10-19', to: '2026-10-25', done: 0, planned: 3 },
		])
	})

	it('has no plan without a number a week, and ignores weeks before the program started', () => {
		const withoutPlan = buildWorkoutsReadData(
			base({ program: { ...rotation, perWeek: null } }),
		).program
		const started = buildWorkoutsReadData(
			base({ from: '2026-10-12', to: '2026-10-25', program: { ...rotation, since: '2026-10-15' } }),
		).program

		expect(withoutPlan).toMatchObject({ planned: 0, done: 0, missed: [] })
		expect(started).toMatchObject({ planned: 3, done: 0 })
	})

	it('judges only whole weeks over, tells the rest of the period apart and counts the workouts outside the check', () => {
		const data = buildWorkoutsReadData(
			base({
				from: '2026-11-01',
				to: '2026-11-10',
				today: '2026-11-10',
				program: { ...rotation, since: '2026-10-20' },
				workouts: perWeekWorkouts(['2026-11-01', '2026-11-05', '2026-11-09']),
			}),
		)

		expect(data.periodCount).toBe(3)
		expect(data.program).toEqual({
			title: 'Все тіло',
			mode: 'ROTATE',
			perWeek: 3,
			since: '2026-10-20',
			judged: { from: '2026-11-02', to: '2026-11-08' },
			planned: 3,
			done: 1,
			missed: [{ from: '2026-11-02', to: '2026-11-08', done: 1, planned: 3 }],
			notJudged: 2,
			thisWeek: { from: '2026-11-09', to: '2026-11-15', done: 1, planned: 3 },
		})
	})

	it('has nothing to judge while no whole week is over, and the week so far is no miss', () => {
		const data = buildWorkoutsReadData(
			base({
				from: '2026-11-09',
				to: '2026-11-10',
				today: '2026-11-10',
				program: rotation,
				workouts: perWeekWorkouts(['2026-11-09']),
			}),
		)

		expect(data.program).toMatchObject({
			judged: null,
			planned: 0,
			done: 0,
			missed: [],
			notJudged: 1,
			thisWeek: { from: '2026-11-09', to: '2026-11-15', done: 1, planned: 3 },
		})
	})

	it('shows no week so far when the period ended before the current week', () => {
		const data = buildWorkoutsReadData(
			base({ from: '2026-10-12', to: '2026-10-25', program: rotation, workouts: [] }),
		)

		expect(data.program?.thisWeek).toBeNull()
	})

	it('keeps every exercise of a spoken name apart: sessions, bests and records per exercise', () => {
		const chestPress = { id: 'ex-chest', name: 'Жим від грудей', aliases: [] }
		const machine = makeEntry({
			id: 'e-m',
			workoutId: 'w2',
			workoutLocalDate: '2026-10-26',
			exerciseId: chestPress.id,
			name: chestPress.name,
			sets: [makeSet({ reps: 13, weightKg: 52 })],
		})
		const data = buildWorkoutsReadData(
			base({
				from: '2026-08-11',
				exercise: { query: 'жим від грудей', matched: [chestPress, BENCH] },
				workouts: [
					makeWorkout({ id: 'w1', localDate: '2026-09-14' }),
					makeWorkout({ id: 'w2', localDate: '2026-10-26' }),
					makeWorkout({ id: 'w3', localDate: '2026-11-02' }),
				],
				entries: [bench('w1', '2026-09-14', 85), machine],
				allTimeStrengthEntries: [bench('w1', '2026-09-14', 85), machine],
			}),
		)

		expect(data.exercise?.matched).toEqual(['Жим від грудей', 'Жим лежачи'])
		expect(data.periodCount).toBe(3)
		expect(data.count).toBe(2)
		expect(
			data.exercises.map(({ name, bestEver }) => [name, bestEver?.weightKg, bestEver?.reps]),
		).toEqual(
			expect.arrayContaining([
				['Жим від грудей', 52, 13],
				['Жим лежачи', 85, 5],
			]),
		)
	})

	it('judges fixed weekdays day by day, from the start to yesterday', () => {
		const data = buildWorkoutsReadData(
			base({
				from: '2026-11-02',
				to: '2026-11-10',
				today: '2026-11-10',
				// Mon, Wed, Fri
				program: {
					...rotation,
					mode: 'WEEKDAYS',
					perWeek: null,
					since: '2026-11-02',
					weekdays: [1, 3, 5],
				},
				workouts: perWeekWorkouts(['2026-11-02', '2026-11-06', '2026-11-09']),
			}),
		)

		// planned: 02, 04, 06, 09; today (Tue 10) is not over
		expect(data.program).toMatchObject({
			planned: 4,
			done: 3,
			judged: { from: '2026-11-02', to: '2026-11-09' },
			notJudged: 0,
			// Monday 09.11 is planned and done; today (Tuesday) is not a planned day
			thisWeek: { from: '2026-11-09', to: '2026-11-10', done: 1, planned: 1 },
		})
		expect(data.program?.missed).toEqual([
			{ from: '2026-11-02', to: '2026-11-08', done: 2, planned: 3 },
		])
	})

	it('judges the program against all workouts even when an exercise is asked', () => {
		const data = buildWorkoutsReadData(
			base({
				from: '2026-10-12',
				to: '2026-10-18',
				program: rotation,
				exercise: { query: 'жим', matched: [BENCH] },
				workouts: perWeekWorkouts(['2026-10-12', '2026-10-14', '2026-10-16']),
				entries: [bench('w0', '2026-10-12', 80)],
			}),
		)

		expect(data.count).toBe(1)
		expect(data.program).toMatchObject({ planned: 3, done: 3, missed: [] })
	})
})
