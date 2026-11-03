import { formatWorkout, type TodayWorkoutContext } from '@kus/shared'
import { describe, expect, it, vi } from 'vitest'

import { toWorkoutContext } from './workout-turn'
import { WorkoutsTurnService } from './workouts-turn.service'
import type { WorkoutKcalService } from './workout-kcal.service'
import type { WorkoutRecordsService } from './workout-records.service'
import type { WorkoutSessionsService } from './workout-sessions.service'
import type { WorkoutWithExercises, WorkoutsRepository } from './workouts.repository'

const NOW = new Date('2026-11-10T18:30:00Z')
const LOCAL_DATE = new Date('2026-11-10T00:00:00Z')
const TIMEZONE = 'Europe/Warsaw'
const LIVE_KEY = '11111111-1111-4111-8111-111111111111'

const kg = (value: number) => ({ toNumber: () => value })

type SetFixture = {
	reps?: number | null
	weightKg?: number | null
	isWarmup?: boolean
	doneAt?: Date | null
}

const setRow = ({ reps = 8, weightKg = 80, isWarmup = false, doneAt = null }: SetFixture = {}) => ({
	reps,
	weightKg: weightKg === null ? null : kg(weightKg),
	isWarmup,
	doneAt,
})

type ExerciseFixture = {
	name?: string
	exerciseId?: string | null
	clientKey?: string | null
	sets?: SetFixture[]
	durationMin?: number | null
	distanceM?: number | null
	muscleGroup?: string | null
}

const exerciseRow = ({
	name = 'Жим лежачи',
	exerciseId = null,
	clientKey = null,
	sets = [],
	durationMin = null,
	distanceM = null,
	muscleGroup = 'CHEST',
}: ExerciseFixture = {}) => ({
	name,
	exerciseId,
	exercise: null,
	clientKey,
	muscleGroup,
	performedAt: NOW,
	sets: sets.map(setRow),
	durationMin,
	distanceM,
})

const workoutRow = (
	exercises: ReturnType<typeof exerciseRow>[],
	overrides: Record<string, unknown> = {},
): WorkoutWithExercises =>
	({
		id: 'workout-1',
		place: 'GYM',
		source: 'LIVE',
		startedAt: null,
		finishedAt: null,
		durationMin: null,
		kcalBurned: null,
		localDate: LOCAL_DATE,
		exercises,
		...overrides,
	}) as unknown as WorkoutWithExercises

const toContext = (workout: WorkoutWithExercises, exerciseRefs = new Map<string, string>()) =>
	toWorkoutContext(workout, { ref: 'w1', time: null, lastAt: null, exerciseRefs })

const DONE = new Date('2026-11-10T18:00:00Z')

describe('toWorkoutContext: LIVE exercises give the model only done work', () => {
	it('keeps one done set of a live exercise with three planned ones, in the structure and the line', () => {
		const workout = workoutRow([
			exerciseRow({
				clientKey: LIVE_KEY,
				sets: [
					{ reps: 8, weightKg: 80 },
					{ reps: 8, weightKg: 80 },
					{ reps: 8, weightKg: 80, doneAt: DONE },
					{ reps: 8, weightKg: 80 },
				],
			}),
		])

		const context = toContext(workout)

		expect(context.exercises).toHaveLength(1)
		expect(context.exercises[0]?.sets).toEqual([{ reps: 8, weightKg: 80, isWarmup: false }])
		const line = formatWorkout(context)
		expect(line).toBe('- w1 GYM: "Жим лежачи" [CHEST] 1×8 at 80 kg')
		expect(line).not.toContain('4×8')
		expect(line).not.toContain('3×8')
	})

	it('drops a live exercise with only planned sets, but the session stays with no exercises', () => {
		const context = toContext(
			workoutRow([exerciseRow({ clientKey: LIVE_KEY, sets: [{ reps: 8 }, { reps: 8 }] })]),
		)

		expect(context.ref).toBe('w1')
		expect(context.exercises).toEqual([])
		expect(formatWorkout(context)).toBe('- w1 GYM: ')
	})

	it('keeps a live cardio with minutes or distance (sets empty) and drops an empty one', () => {
		const context = toContext(
			workoutRow([
				exerciseRow({
					name: 'Доріжка',
					clientKey: LIVE_KEY,
					durationMin: 12,
					distanceM: 1500,
					muscleGroup: null,
				}),
				exerciseRow({ name: 'Орбітрек', clientKey: 'k2', muscleGroup: null, durationMin: 20 }),
				exerciseRow({ name: 'Велотренажер', clientKey: 'k3', muscleGroup: null }),
			]),
		)

		expect(context.exercises.map((exercise) => exercise.name)).toEqual(['Доріжка', 'Орбітрек'])
		expect(context.exercises[0]).toMatchObject({ durationMin: 12, distanceKm: 1.5, sets: [] })
		expect(formatWorkout(context)).toBe('- w1 GYM: "Доріжка" 12 min, 1.5 km; "Орбітрек" 20 min')
	})

	it('keeps a done warm-up set (flag preserved) and drops an undone one', () => {
		const context = toContext(
			workoutRow([
				exerciseRow({
					clientKey: LIVE_KEY,
					sets: [
						{ reps: 10, weightKg: 40, isWarmup: true, doneAt: DONE },
						{ reps: 10, weightKg: 50, isWarmup: true },
						{ reps: 8, weightKg: 80, doneAt: DONE },
					],
				}),
			]),
		)

		expect(context.exercises[0]?.sets).toEqual([
			{ reps: 10, weightKg: 40, isWarmup: true },
			{ reps: 8, weightKg: 80, isWarmup: false },
		])
		expect(formatWorkout(context)).toContain('warm-up 1×10 at 40 kg, 1×8 at 80 kg')
	})

	it('mixed session: A done+undone, B planned only, C told in the chat with all its sets', () => {
		const context = toContext(
			workoutRow([
				exerciseRow({
					name: 'A',
					clientKey: 'ka',
					sets: [
						{ reps: 5, weightKg: 100, doneAt: DONE },
						{ reps: 5, weightKg: 100 },
					],
				}),
				exerciseRow({ name: 'B', clientKey: 'kb', sets: [{ reps: 12 }, { reps: 12 }] }),
				exerciseRow({
					name: 'C',
					sets: [
						{ reps: 10, weightKg: 20 },
						{ reps: 10, weightKg: 20 },
					],
				}),
			]),
		)

		expect(context.exercises.map((exercise) => [exercise.name, exercise.sets.length])).toEqual([
			['A', 1],
			['C', 2],
		])
	})

	it('a null weight and null reps stay null for a done set', () => {
		const context = toContext(
			workoutRow([
				exerciseRow({
					clientKey: LIVE_KEY,
					sets: [{ reps: null, weightKg: null, doneAt: DONE }],
				}),
			]),
		)

		expect(context.exercises[0]?.sets).toEqual([{ reps: null, weightKg: null, isWarmup: false }])
	})
})

describe('toWorkoutContext: CHAT and FORM sessions are unchanged', () => {
	const planned = (count: number): SetFixture[] =>
		Array.from({ length: count }, () => ({ reps: 8, weightKg: 80, doneAt: null }))

	it.each(['CHAT', 'FORM'])(
		'%s: sets without doneAt are all kept, nothing is dropped',
		(source) => {
			const workout = workoutRow(
				[
					exerciseRow({
						name: 'Жим лежачи',
						sets: [...planned(3), { reps: 10, weightKg: 40, isWarmup: true }],
					}),
					exerciseRow({
						name: 'Присідання',
						muscleGroup: 'LEGS',
						sets: [{ reps: 5, weightKg: 100 }],
					}),
					exerciseRow({ name: 'Біг', muscleGroup: null, durationMin: 30, distanceM: 5000 }),
					exerciseRow({ name: 'Розтяжка', muscleGroup: null }),
				],
				{ source, startedAt: new Date('2026-11-10T17:30:00Z'), durationMin: 55 },
			)

			const context = toWorkoutContext(workout, {
				ref: 'w1',
				time: '18:30',
				lastAt: '19:30',
				exerciseRefs: new Map(),
			})

			expect(context.exercises).toHaveLength(4)
			expect(context.exercises[0]?.sets).toHaveLength(4)
			expect(formatWorkout(context)).toBe(
				'- w1 GYM 18:30, last 19:30, 55 min: "Жим лежачи" [CHEST] 3×8 at 80 kg, warm-up 1×10 at 40 kg; ' +
					'"Присідання" [LEGS] 1×5 at 100 kg; "Біг" 30 min, 5.0 km; "Розтяжка"',
			)
		},
	)

	it('a chat-added exercise inside a LIVE session (no clientKey) keeps undone sets', () => {
		const context = toContext(workoutRow([exerciseRow({ name: 'Жим', sets: planned(2) })]))

		expect(context.exercises[0]?.sets).toHaveLength(2)
		expect(formatWorkout(context)).toBe('- w1 GYM: "Жим" [CHEST] 2×8 at 80 kg')
	})

	it('a chat session with no exercises stays in the list', () => {
		const context = toContext(workoutRow([], { source: 'CHAT' }))

		expect(context.exercises).toEqual([])
	})
})

describe('WorkoutsTurnService.getContext: refs do not shift', () => {
	const dictionaryRow = (id: string, name: string) => ({
		id,
		name,
		aliases: [],
		kind: 'STRENGTH' as const,
		muscleGroup: null,
	})

	const buildService = (
		sessions: WorkoutWithExercises[],
		dictionary: ReturnType<typeof dictionaryRow>[],
	) => {
		const repository = {
			findOfDay: vi.fn().mockResolvedValue(sessions),
			findRecent: vi.fn().mockResolvedValue([]),
			findDeletedOfDay: vi.fn().mockResolvedValue([]),
			findDictionary: vi.fn().mockResolvedValue(dictionary),
			findLastResult: vi.fn().mockResolvedValue(null),
		}
		const service = new WorkoutsTurnService(
			repository as unknown as WorkoutsRepository,
			{} as WorkoutSessionsService,
			{} as WorkoutKcalService,
			{} as WorkoutRecordsService,
		)
		return service.getContext({
			userId: 'user-1',
			localDate: LOCAL_DATE,
			timezone: TIMEZONE,
			text: '',
			now: NOW,
		})
	}

	it('keeps wN of the sessions and xN of the dictionary when a live exercise is hidden', async () => {
		const liveSession = workoutRow(
			[
				exerciseRow({ name: 'Присідання', exerciseId: 'd1', clientKey: 'k1', sets: [{ reps: 5 }] }),
				exerciseRow({ name: 'Біг', exerciseId: 'd2', muscleGroup: null, durationMin: 15 }),
				exerciseRow({
					name: 'Жим',
					exerciseId: 'd3',
					clientKey: 'k3',
					sets: [{ reps: 8, weightKg: 60, doneAt: DONE }],
				}),
			],
			{ id: 'live-1' },
		)
		const emptyLive = workoutRow(
			[exerciseRow({ exerciseId: 'd1', clientKey: 'k9', sets: [{ reps: 5 }] })],
			{ id: 'live-2' },
		)
		const chatSession = workoutRow(
			[exerciseRow({ name: 'Тяга', exerciseId: 'd4', sets: [{ reps: 6 }] })],
			{
				id: 'chat-1',
				source: 'CHAT',
			},
		)

		const context = await buildService(
			[liveSession, emptyLive, chatSession],
			[
				dictionaryRow('d1', 'Присідання'),
				dictionaryRow('d2', 'Біг'),
				dictionaryRow('d3', 'Жим'),
				dictionaryRow('d4', 'Тяга'),
			],
		)

		expect(context.workouts.map((workout) => workout.ref)).toEqual(['w1', 'w2', 'w3'])
		expect([...context.refIds.workouts]).toEqual([
			['w1', 'live-1'],
			['w2', 'live-2'],
			['w3', 'chat-1'],
		])
		expect(context.refIds.exercises.get('x1')).toBe('d1')
		expect(context.refIds.exercises.get('x3')).toBe('d3')
		expect(context.exercises.map((exercise) => exercise.ref)).toEqual(['x1', 'x2', 'x3', 'x4'])

		const [first, second, third] = context.workouts as [
			TodayWorkoutContext,
			TodayWorkoutContext,
			TodayWorkoutContext,
		]
		expect(first.exercises.map((exercise) => [exercise.name, exercise.exerciseRef])).toEqual([
			['Біг', 'x2'],
			['Жим', 'x3'],
		])
		expect(second.exercises).toEqual([])
		expect(third.exercises.map((exercise) => [exercise.name, exercise.exerciseRef])).toEqual([
			['Тяга', 'x4'],
		])
		expect(formatWorkout(first)).toBe('- w1 GYM: "Біг" [x2] 15 min; "Жим" [x3 CHEST] 1×8 at 60 kg')
	})
})
