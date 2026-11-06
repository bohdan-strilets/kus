import { describe, expect, it, vi } from 'vitest'

import type { Prisma } from '../../generated/prisma/client'
import {
	computeChronologicalRecords,
	getBodyweightMaxReps,
	getRecordExerciseIds,
	isRecord,
	type RecordEntryInput,
	type RecordSet,
} from './workout-records'
import { WorkoutRecordsService } from './workout-records.service'
import type { WorkoutRecord } from './workout-turn'
import type { WorkoutsRepository } from './workouts.repository'

const kg = (value: number) => ({ toNumber: () => value })

describe('getBodyweightMaxReps', () => {
	it('takes the most reps of the working sets when none has weight', () => {
		expect(
			getBodyweightMaxReps([
				{ reps: 10, weightKg: null, isWarmup: false },
				{ reps: 12, weightKg: null, isWarmup: false },
				{ reps: null, weightKg: null, isWarmup: false },
			]),
		).toBe(12)
	})

	it('reads weight 0 as no weight', () => {
		expect(
			getBodyweightMaxReps([
				{ reps: 9, weightKg: kg(0), isWarmup: false },
				{ reps: 11, weightKg: null, isWarmup: false },
			]),
		).toBe(11)
	})

	it('counts only the sets without weight: a weighted set is a WEIGHT result, not reps', () => {
		expect(
			getBodyweightMaxReps([
				{ reps: 15, weightKg: null, isWarmup: false },
				{ reps: 20, weightKg: kg(10), isWarmup: false },
			]),
		).toBe(15)
		expect(getBodyweightMaxReps([{ reps: 8, weightKg: kg(10), isWarmup: false }])).toBeNull()
	})

	it('ignores warm-up sets: their reps never count and their weight does not block', () => {
		expect(
			getBodyweightMaxReps([
				{ reps: 20, weightKg: kg(5), isWarmup: true },
				{ reps: 30, weightKg: null, isWarmup: true },
				{ reps: 10, weightKg: null, isWarmup: false },
			]),
		).toBe(10)
		expect(getBodyweightMaxReps([{ reps: 30, weightKg: null, isWarmup: true }])).toBeNull()
	})

	it('has no result without sets or reps', () => {
		expect(getBodyweightMaxReps([])).toBeNull()
		expect(getBodyweightMaxReps([{ reps: null, weightKg: null, isWarmup: false }])).toBeNull()
	})
})

describe('isRecord', () => {
	it('is a record only above an earlier result: a first one is none', () => {
		expect(isRecord(null, 12)).toBe(false)
		expect(isRecord(10, 12)).toBe(true)
		expect(isRecord(12, 12)).toBe(false)
		expect(isRecord(12, null)).toBe(false)
	})
})

const DAY_MS = 86_400_000
const BASE = new Date('2026-10-01T12:00:00Z').getTime()
const EX_A = 'exercise-a'
const EX_B = 'exercise-b'

const makeSet = (
	weightKg: number | null,
	reps: number | null = 8,
	isWarmup = false,
): RecordSet => ({
	reps,
	weightKg,
	isWarmup,
})

const makeInput = (
	overrides: Partial<RecordEntryInput> & { day: number; workoutId: string },
): RecordEntryInput => {
	const { day, ...rest } = overrides
	return {
		entryId: `e-${rest.workoutId}`,
		exerciseId: EX_A,
		performedAt: new Date(BASE + day * DAY_MS),
		position: 0,
		distanceM: null,
		isBodyweight: false,
		sets: [makeSet(80)],
		...rest,
	}
}

const typesOf = (result: Map<string, WorkoutRecord[]>, workoutId: string): string[] =>
	(result.get(workoutId) ?? []).map((record) => record.type)

describe('computeChronologicalRecords', () => {
	it('gives no trophy to the first result or to an equal one', () => {
		const result = computeChronologicalRecords([
			makeInput({ workoutId: 'w1', day: 0, sets: [makeSet(80)] }),
			makeInput({ workoutId: 'w2', day: 1, sets: [makeSet(80)] }),
		])
		expect(result.size).toBe(0)
	})

	it('gives a trophy to every step up and points at the entry', () => {
		const result = computeChronologicalRecords([
			makeInput({ workoutId: 'w1', day: 0, sets: [makeSet(80)] }),
			makeInput({ workoutId: 'w2', day: 1, sets: [makeSet(82.5)] }),
			makeInput({ workoutId: 'w3', day: 2, sets: [makeSet(85)] }),
			makeInput({ workoutId: 'w4', day: 3, sets: [makeSet(84)] }),
		])
		expect([...result.keys()]).toEqual(['w2', 'w3'])
		expect(result.get('w3')).toEqual([{ exerciseEntryId: 'e-w3', type: 'WEIGHT' }])
	})

	it('orders by performedAt, not by input order: a backdated stronger session takes the trophy', () => {
		const result = computeChronologicalRecords([
			makeInput({ workoutId: 'late', day: 5, sets: [makeSet(90)] }),
			makeInput({ workoutId: 'first', day: 0, sets: [makeSet(80)] }),
			makeInput({ workoutId: 'backdated', day: 2, sets: [makeSet(100)] }),
		])
		expect(typesOf(result, 'backdated')).toEqual(['WEIGHT'])
		expect(result.has('late')).toBe(false)
	})

	it('ignores warm-up sets, even heavier ones', () => {
		const result = computeChronologicalRecords([
			makeInput({ workoutId: 'w1', day: 0, sets: [makeSet(80)] }),
			makeInput({ workoutId: 'w2', day: 1, sets: [makeSet(120, 3, true), makeSet(80)] }),
		])
		expect(result.size).toBe(0)
	})

	it('gives REPS only to a bodyweight-flagged entry; weight 0 is no weight', () => {
		const pullUp = (workoutId: string, day: number, reps: number, isBodyweight: boolean) =>
			makeInput({ workoutId, day, isBodyweight, sets: [makeSet(0, reps)] })
		const flagged = computeChronologicalRecords([
			pullUp('w1', 0, 10, true),
			pullUp('w2', 1, 12, true),
		])
		expect(typesOf(flagged, 'w2')).toEqual(['REPS'])
		const unflagged = computeChronologicalRecords([
			pullUp('w1', 0, 10, false),
			pullUp('w2', 1, 12, false),
		])
		expect(unflagged.size).toBe(0)
	})

	it('gives a flagged mixed session both WEIGHT and REPS', () => {
		const result = computeChronologicalRecords([
			makeInput({
				workoutId: 'w1',
				day: 0,
				isBodyweight: true,
				sets: [makeSet(10, 5), makeSet(null, 10)],
			}),
			makeInput({
				workoutId: 'w2',
				day: 1,
				isBodyweight: true,
				sets: [makeSet(15, 5), makeSet(null, 12)],
			}),
		])
		expect(typesOf(result, 'w2')).toEqual(['WEIGHT', 'REPS'])
	})

	it('does not count a weighted set as reps of a bodyweight exercise', () => {
		const result = computeChronologicalRecords([
			makeInput({ workoutId: 'w1', day: 0, isBodyweight: true, sets: [makeSet(null, 10)] }),
			makeInput({ workoutId: 'w2', day: 1, isBodyweight: true, sets: [makeSet(10, 20)] }),
		])
		expect(typesOf(result, 'w2')).toEqual([])
	})

	it('records DISTANCE when it grows', () => {
		const run = (workoutId: string, day: number, distanceM: number | null) =>
			makeInput({ workoutId, day, distanceM, sets: [] })
		const result = computeChronologicalRecords([
			run('w1', 0, 3000),
			run('w2', 1, 5000),
			run('w3', 2, null),
			run('w4', 3, 5000),
		])
		expect([...result.keys()]).toEqual(['w2'])
		expect(typesOf(result, 'w2')).toEqual(['DISTANCE'])
	})

	it('orders the same moment by workout id', () => {
		const same = (workoutId: string, kg: number) =>
			makeInput({ workoutId, day: 0, sets: [makeSet(kg)] })
		const result = computeChronologicalRecords([same('b', 80), same('a', 70)])
		// a (70) is first, then b (80) beats it
		expect([...result.keys()]).toEqual(['b'])
	})

	it('treats two entries of one exercise in a session as one result, the lower position on a tie', () => {
		const result = computeChronologicalRecords([
			makeInput({ workoutId: 'w1', day: 0, sets: [makeSet(80)] }),
			makeInput({ workoutId: 'w2', day: 1, entryId: 'high', position: 3, sets: [makeSet(85)] }),
			makeInput({ workoutId: 'w2', day: 1, entryId: 'low', position: 1, sets: [makeSet(85)] }),
			makeInput({ workoutId: 'w2', day: 1, entryId: 'light', position: 0, sets: [makeSet(60)] }),
		])
		expect(result.get('w2')).toEqual([{ exerciseEntryId: 'low', type: 'WEIGHT' }])
	})

	it('keeps exercises apart', () => {
		const result = computeChronologicalRecords([
			makeInput({ workoutId: 'w1', day: 0, exerciseId: EX_A, sets: [makeSet(100)] }),
			makeInput({ workoutId: 'w2', day: 1, exerciseId: EX_B, sets: [makeSet(50)] }),
		])
		expect(result.size).toBe(0)
	})
})

describe('getRecordExerciseIds', () => {
	it('keeps only the entries bound to the dictionary', () => {
		expect(
			getRecordExerciseIds([{ exerciseId: 'a' }, { exerciseId: null }, { exerciseId: 'b' }]),
		).toEqual(['a', 'b'])
		expect(getRecordExerciseIds([])).toEqual([])
	})
})

describe('WorkoutRecordsService.recompute', () => {
	const tx = {} as Prisma.TransactionClient
	const WEIGHT_85 = [{ reps: 8, weightKg: 85, isWarmup: false }]
	const row = (overrides: Record<string, unknown>) => ({
		id: 'e1',
		workoutId: 'w1',
		exerciseId: EX_A,
		name: 'Жим лежачи',
		performedAt: new Date(BASE),
		position: 0,
		distanceM: null,
		isBodyweight: null,
		exercise: { isBodyweight: false },
		sets: [{ reps: 8, weightKg: 80, isWarmup: false }],
		workout: {
			records: [] as unknown,
			exercises: [{ id: 'e1' }, { id: 'e2' }],
		},
		...overrides,
	})
	const setup = (rows: ReturnType<typeof row>[]) => {
		const findRecordEntries = vi.fn().mockResolvedValue(rows)
		const setRecords = vi.fn().mockResolvedValue(undefined)
		const service = new WorkoutRecordsService({
			findRecordEntries,
			setRecords,
		} as unknown as WorkoutsRepository)
		return { service, findRecordEntries, setRecords }
	}

	it('returns an empty map and makes no query for no exercises', async () => {
		const { service, findRecordEntries, setRecords } = setup([])
		const result = await service.recompute('u1', [], tx)
		expect(result.size).toBe(0)
		expect(findRecordEntries).not.toHaveBeenCalled()
		expect(setRecords).not.toHaveBeenCalled()
	})

	it('asks the repository once for the distinct ids, scoped to the user', async () => {
		const { service, findRecordEntries } = setup([])
		await service.recompute('u1', [EX_A, EX_A, EX_B], tx)
		expect(findRecordEntries).toHaveBeenCalledTimes(1)
		expect(findRecordEntries).toHaveBeenCalledWith({ userId: 'u1', exerciseIds: [EX_A, EX_B] }, tx)
	})

	it('writes a new trophy and removes a stale one', async () => {
		const { service, setRecords } = setup([
			row({
				workout: {
					records: [{ exerciseEntryId: 'e1', type: 'WEIGHT' }],
					exercises: [{ id: 'e1' }, { id: 'e2' }],
				},
			}),
			row({ id: 'e2', workoutId: 'w2', performedAt: new Date(BASE + DAY_MS), sets: WEIGHT_85 }),
		])
		const result = await service.recompute('u1', [EX_A], tx)
		expect(result.get('w1')).toEqual([])
		expect(result.get('w2')).toEqual([{ exerciseEntryId: 'e2', type: 'WEIGHT' }])
		expect(setRecords).toHaveBeenCalledWith({ id: 'w1', userId: 'u1', records: [] }, tx)
		expect(setRecords).toHaveBeenCalledWith(
			{ id: 'w2', userId: 'u1', records: [{ exerciseEntryId: 'e2', type: 'WEIGHT' }] },
			tx,
		)
	})

	it('does not write what has not changed', async () => {
		const { service, setRecords } = setup([
			row({}),
			row({
				id: 'e2',
				workoutId: 'w2',
				performedAt: new Date(BASE + DAY_MS),
				sets: WEIGHT_85,
				workout: {
					records: [{ exerciseEntryId: 'e2', type: 'WEIGHT' }],
					exercises: [{ id: 'e1' }, { id: 'e2' }],
				},
			}),
		])
		await service.recompute('u1', [EX_A], tx)
		expect(setRecords).not.toHaveBeenCalled()
	})

	it('keeps the records of the session that belong to other entries', async () => {
		const other = { exerciseEntryId: 'other-entry', type: 'DISTANCE' }
		const { service, setRecords } = setup([
			row({}),
			row({
				id: 'e2',
				workoutId: 'w2',
				performedAt: new Date(BASE + DAY_MS),
				sets: WEIGHT_85,
				workout: { records: [other], exercises: [{ id: 'e2' }, { id: 'other-entry' }] },
			}),
		])
		const result = await service.recompute('u1', [EX_A], tx)
		expect(result.get('w2')).toEqual([other, { exerciseEntryId: 'e2', type: 'WEIGHT' }])
		expect(setRecords).toHaveBeenCalledTimes(1)
	})

	it('drops the records of entries that are gone, a replaced exercise leaves none behind', async () => {
		const stale = { exerciseEntryId: 'old-entry', type: 'WEIGHT' }
		const { service, setRecords } = setup([
			row({
				workout: { records: [stale], exercises: [{ id: 'e1' }] },
			}),
		])
		const result = await service.recompute('u1', [EX_A], tx)
		expect(result.get('w1')).toEqual([])
		expect(setRecords).toHaveBeenCalledWith({ id: 'w1', userId: 'u1', records: [] }, tx)
	})

	it('treats unparsable stored records as none and skips entries without a workout', async () => {
		const { service } = setup([
			row({ workout: { records: 'garbage', exercises: [{ id: 'e1' }, { id: 'e2' }] } }),
			row({ id: 'e2', workoutId: null }),
		])
		const result = await service.recompute('u1', [EX_A], tx)
		expect([...result.keys()]).toEqual(['w1'])
		expect(result.get('w1')).toEqual([])
	})

	it('reads the bodyweight flag from the entry first, then the dictionary', async () => {
		const pullUp = (id: string, day: number, reps: number, flags: Record<string, unknown>) =>
			row({
				id,
				workoutId: id,
				name: 'Підтягування',
				performedAt: new Date(BASE + day * DAY_MS),
				sets: [{ reps, weightKg: null, isWarmup: false }],
				...flags,
			})
		const fromDictionary = { isBodyweight: null, exercise: { isBodyweight: true } }
		const { service } = setup([
			pullUp('p1', 0, 10, fromDictionary),
			pullUp('p2', 1, 12, fromDictionary),
		])
		expect((await service.recompute('u1', [EX_A], tx)).get('p2')).toEqual([
			{ exerciseEntryId: 'p2', type: 'REPS' },
		])
		const entryWins = { isBodyweight: false, exercise: { isBodyweight: true } }
		const own = setup([pullUp('p1', 0, 10, entryWins), pullUp('p2', 1, 12, entryWins)])
		expect((await own.service.recompute('u1', [EX_A], tx)).get('p2')).toEqual([])
	})
})
