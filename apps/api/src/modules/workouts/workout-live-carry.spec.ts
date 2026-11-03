import { describe, expect, it } from 'vitest'

import { carryLiveFields, getEditTime, matchOldEntries } from './workout-live-carry'
import type { ExerciseWrite, WorkoutWithExercises } from './workouts.repository'

type OldEntry = WorkoutWithExercises['exercises'][number]

const NOW = new Date('2026-11-10T12:00:00Z')
const STARTED_AT = new Date('2026-11-10T11:00:00Z')
const SET_1_AT = new Date('2026-11-10T11:10:00Z')
const SET_2_AT = new Date('2026-11-10T11:20:00Z')
const OLD_TIME = new Date('2026-11-10T11:05:00Z')
const NEW_TIME = new Date('2026-11-10T11:55:00Z')

interface OldOverrides {
	exerciseId?: string | null
	name?: string
	clientKey?: string | null
	templateExerciseId?: string | null
	isBodyweight?: boolean | null
	sourceMessageId?: string | null
	doneAts?: (Date | null)[]
}

/** Only the fields the helpers read; the rest of a Prisma row is irrelevant here. */
const oldEntry = ({
	exerciseId = 'ex-bench',
	name = 'Жим лежачи',
	clientKey = 'key-1',
	templateExerciseId = 'tpl-1',
	isBodyweight = false,
	sourceMessageId = null,
	doneAts = [SET_1_AT, SET_2_AT],
}: OldOverrides = {}): OldEntry =>
	({
		exerciseId,
		name,
		clientKey,
		templateExerciseId,
		isBodyweight,
		sourceMessageId,
		performedAt: OLD_TIME,
		sets: doneAts.map((doneAt) => ({ doneAt })),
	}) as unknown as OldEntry

const written = (overrides: Partial<ExerciseWrite> = {}): ExerciseWrite => ({
	exerciseId: 'ex-bench',
	name: 'Жим лежачи',
	kind: 'STRENGTH',
	muscleGroup: 'CHEST',
	position: 0,
	durationMin: null,
	distanceM: null,
	performedAt: NEW_TIME,
	sourceMessageId: 'msg-new',
	sets: [
		{ position: 0, reps: 8, weightKg: 85, isWarmup: false },
		{ position: 1, reps: 8, weightKg: 85, isWarmup: false },
	],
	...overrides,
})

describe('matchOldEntries', () => {
	it('pairs by the same dictionary exercise first, whatever the order', () => {
		const bench = oldEntry({ exerciseId: 'ex-bench', name: 'Жим' })
		const squat = oldEntry({ exerciseId: 'ex-squat', name: 'Присід' })

		const result = matchOldEntries({
			oldEntries: [bench, squat],
			exercises: [
				{ exerciseId: 'ex-squat', name: 'Присід' },
				{ exerciseId: 'ex-bench', name: 'Жим' },
			],
		})

		expect(result).toEqual([squat, bench])
	})

	it('falls back to the normalised name when the exercise id differs or is unknown', () => {
		const bench = oldEntry({ exerciseId: null, name: 'Жим  Лежачи!' })

		const result = matchOldEntries({
			oldEntries: [bench],
			exercises: [{ exerciseId: 'ex-other', name: 'жим лежачи' }],
		})

		expect(result).toEqual([bench])
	})

	it('is strictly one-to-one: two new exercises of one old entry, only the first is matched', () => {
		const bench = oldEntry()

		const result = matchOldEntries({
			oldEntries: [bench],
			exercises: [
				{ exerciseId: 'ex-bench', name: 'Жим лежачи' },
				{ exerciseId: 'ex-bench', name: 'Жим лежачи' },
			],
		})

		expect(result).toEqual([bench, null])
	})

	it('matches repeated exercises in order and leaves the extra old and the extra new ones unmatched', () => {
		const first = oldEntry({ clientKey: 'a' })
		const second = oldEntry({ clientKey: 'b' })
		const unrelated = oldEntry({ exerciseId: 'ex-row', name: 'Тяга', clientKey: 'c' })

		const result = matchOldEntries({
			oldEntries: [first, unrelated, second],
			exercises: [
				{ exerciseId: 'ex-bench', name: 'Жим лежачи' },
				{ exerciseId: 'ex-new', name: 'Присід' },
				{ exerciseId: 'ex-bench', name: 'Жим лежачи' },
			],
		})

		expect(result).toEqual([first, null, second])
	})

	it('never pairs an old entry with an empty name or a null id with an exercise lacking one', () => {
		const nameless = oldEntry({ exerciseId: null, name: '' })

		const result = matchOldEntries({
			oldEntries: [nameless],
			exercises: [{ exerciseId: 'ex-x', name: '' }],
		})

		expect(result).toEqual([null])
	})

	it('returns an empty list for no new exercises and all nulls for no old entries', () => {
		expect(matchOldEntries({ oldEntries: [oldEntry()], exercises: [] })).toEqual([])
		expect(
			matchOldEntries({ oldEntries: [], exercises: [{ exerciseId: 'ex-bench', name: 'Жим' }] }),
		).toEqual([null])
	})
})

describe('carryLiveFields', () => {
	const options = { editedAt: NEW_TIME, shouldKeepTime: true }

	it('carries the key, template exercise, bodyweight flag and message of the old entry', () => {
		const result = carryLiveFields(
			written(),
			oldEntry({ isBodyweight: true, sourceMessageId: 'msg-old' }),
			options,
		)

		expect(result).toMatchObject({
			clientKey: 'key-1',
			templateExerciseId: 'tpl-1',
			isBodyweight: true,
			sourceMessageId: 'msg-old',
		})
	})

	it('does not overwrite the bodyweight flag the rewrite names itself, even false', () => {
		const old = oldEntry({ isBodyweight: true })

		expect(carryLiveFields(written({ isBodyweight: false }), old, options).isBodyweight).toBe(false)
		expect(
			carryLiveFields(written({ isBodyweight: true }), oldEntry({ isBodyweight: false }), options)
				.isBodyweight,
		).toBe(true)
	})

	it('keeps an unknown (null) bodyweight flag of the old entry', () => {
		expect(
			carryLiveFields(written(), oldEntry({ isBodyweight: null }), options).isBodyweight,
		).toBeNull()
	})

	it('keeps the time of the old entry when the day is unchanged, takes the new one otherwise', () => {
		expect(carryLiveFields(written(), oldEntry(), options).performedAt).toBe(OLD_TIME)
		expect(
			carryLiveFields(written(), oldEntry(), { ...options, shouldKeepTime: false }).performedAt,
		).toBe(NEW_TIME)
	})

	it('gives each set the doneAt of the old set at the same index, else the edit time', () => {
		const three = written({
			sets: [0, 1, 2].map((position) => ({
				position,
				reps: 8,
				weightKg: 85,
				isWarmup: false,
			})),
		})

		const result = carryLiveFields(three, oldEntry(), options)

		expect(result.sets.map(({ doneAt }) => doneAt)).toEqual([SET_1_AT, SET_2_AT, NEW_TIME])
	})

	it('a planned-only old set (doneAt null) is a done set at the edit time now', () => {
		const result = carryLiveFields(written(), oldEntry({ doneAts: [null, SET_2_AT] }), options)

		expect(result.sets.map(({ doneAt }) => doneAt)).toEqual([NEW_TIME, SET_2_AT])
	})

	it('keeps the other fields of the rewrite (reps, weights, name)', () => {
		const result = carryLiveFields(written({ name: 'Жим 85' }), oldEntry(), options)

		expect(result.name).toBe('Жим 85')
		expect(result.sets.map(({ reps, weightKg }) => [reps, weightKg])).toEqual([
			[8, 85],
			[8, 85],
		])
	})
})

describe('getEditTime', () => {
	it('is now', () => {
		expect(getEditTime({ now: NOW, startedAt: STARTED_AT })).toBe(NOW)
	})

	it('is now when the session has no start', () => {
		expect(getEditTime({ now: NOW, startedAt: null })).toBe(NOW)
	})

	it('is never before the start of the session (a skewed clock)', () => {
		const late = new Date(NOW.getTime() + 3_600_000)

		expect(getEditTime({ now: NOW, startedAt: late })).toBe(late)
	})

	it('is the start itself when now equals it', () => {
		expect(getEditTime({ now: STARTED_AT, startedAt: STARTED_AT }).getTime()).toBe(
			STARTED_AT.getTime(),
		)
	})
})
