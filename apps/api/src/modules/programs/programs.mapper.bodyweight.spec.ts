import { describe, expect, it } from 'vitest'

import type { LastExerciseResult } from '../workouts/workouts.service'
import { toProgramResponse } from './programs.mapper'
import type { ActiveProgram } from './programs.repository'

type VersionRow = NonNullable<ActiveProgram['activeVersion']>
type ExerciseRow = VersionRow['templates'][number]['exercises'][number]

const EX_ID = '0199b3a4-0000-7000-8000-0000000000b1'
const decimal = (value: number): { toNumber: () => number } => ({ toNumber: () => value })

const makeExercise = (overrides: Record<string, unknown> = {}): ExerciseRow =>
	({
		id: '0199b3a4-0000-7000-8000-0000000000c1',
		exerciseId: null,
		name: 'Жим лежачи',
		kind: 'STRENGTH',
		muscleGroup: null,
		position: 0,
		isBodyweight: null,
		exercise: null,
		sets: 3,
		repsMin: 8,
		repsMax: 10,
		weightKg: decimal(60),
		progressStepKg: decimal(2.5),
		restSec: 90,
		durationMin: null,
		distanceM: null,
		...overrides,
	}) as unknown as ExerciseRow

const respond = (exercise: ExerciseRow, lastSets: Map<string, LastExerciseResult> = new Map()) => {
	const program = {
		id: '0199b3a4-0000-7000-8000-0000000000d1',
		title: 'Програма',
		mode: 'WEEKDAYS',
		perWeek: null,
		pinnedTemplateId: null,
		activeVersion: {
			id: '0199b3a4-0000-7000-8000-0000000000d2',
			createdAt: new Date('2026-10-01T00:00:00Z'),
			templates: [
				{
					id: '0199b3a4-0000-7000-8000-0000000000d3',
					key: '0199b3a4-0000-7000-8000-0000000000d4',
					name: 'День А',
					position: 0,
					weekdays: [1],
					exercises: [exercise],
				},
			],
		},
	} as unknown as ActiveProgram & { activeVersion: VersionRow }
	const [template] = toProgramResponse({ program, lastSets, next: null }).templates
	const [response] = template?.exercises ?? []
	if (!response) throw new Error('no exercise in the response')
	return response
}

const lastResult = (reps: number, weightKg: number | null): Map<string, LastExerciseResult> =>
	new Map([
		[
			EX_ID,
			{
				sets: [
					{ reps, weightKg, isWarmup: false },
					{ reps, weightKg, isWarmup: false },
				],
				performedAt: new Date('2026-10-20T10:00:00Z'),
				durationMin: null,
				distanceM: null,
			},
		],
	])

describe('toProgramResponse: isBodyweight', () => {
	it('the template flag wins over the dictionary and the name', () => {
		expect(
			respond(
				makeExercise({
					name: 'Підтягування',
					isBodyweight: false,
					exercise: { isBodyweight: true },
				}),
			).isBodyweight,
		).toBe(false)
		expect(
			respond(
				makeExercise({ name: 'Жим лежачи', isBodyweight: true, exercise: { isBodyweight: false } }),
			).isBodyweight,
		).toBe(true)
	})

	it('the dictionary comes before the name', () => {
		expect(
			respond(makeExercise({ name: 'Підтягування', exercise: { isBodyweight: false } }))
				.isBodyweight,
		).toBe(false)
		expect(
			respond(makeExercise({ name: 'Жим лежачи', exercise: { isBodyweight: true } })).isBodyweight,
		).toBe(true)
	})

	it('falls back to the name rule', () => {
		expect(respond(makeExercise({ name: 'Віджимання' })).isBodyweight).toBe(true)
		expect(respond(makeExercise({ name: 'Жим лежачи' })).isBodyweight).toBe(false)
	})

	it('cardio keeps the stored flag untouched', () => {
		expect(respond(makeExercise({ kind: 'CARDIO', name: 'Планка' })).isBodyweight).toBeNull()
	})
})

describe('toProgramResponse: progressHintKg', () => {
	it('adds the step when the last sets reached the top of the range', () => {
		const exercise = makeExercise({ exerciseId: EX_ID })
		expect(respond(exercise, lastResult(10, 60)).progressHintKg).toBe(62.5)
	})

	it('is null when the top was not reached', () => {
		const exercise = makeExercise({ exerciseId: EX_ID })
		expect(respond(exercise, lastResult(8, 60)).progressHintKg).toBeNull()
	})

	it('is null without a last result and without a dictionary id', () => {
		expect(respond(makeExercise({ exerciseId: EX_ID })).progressHintKg).toBeNull()
		expect(respond(makeExercise(), lastResult(10, 60)).progressHintKg).toBeNull()
	})

	it('is null for a bodyweight exercise even when the top was reached', () => {
		const exercise = makeExercise({ exerciseId: EX_ID, isBodyweight: true })
		expect(respond(exercise, lastResult(10, 60)).progressHintKg).toBeNull()
	})

	it('is null for cardio', () => {
		const exercise = makeExercise({ exerciseId: EX_ID, kind: 'CARDIO' })
		expect(respond(exercise, lastResult(10, 60)).progressHintKg).toBeNull()
	})
})
