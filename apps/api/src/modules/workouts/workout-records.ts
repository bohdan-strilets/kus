import { isBodyweightByName, type WorkoutRecordType } from '@kus/shared'

import type { WorkoutRecord } from './workout-turn'

type WeightLike = number | { toNumber: () => number }

export interface RecordSet {
	reps: number | null
	weightKg: WeightLike | null
	isWarmup: boolean
}

/** One live entry of an exercise, as much as the records need. */
export interface RecordEntryInput {
	entryId: string
	workoutId: string
	exerciseId: string
	performedAt: Date
	position: number
	distanceM: number | null
	/** Only a bodyweight exercise can hold a REPS record. */
	isBodyweight: boolean
	sets: readonly RecordSet[]
}

/**
 * The one rule for «bodyweight» in the records: the entry's own flag, then the dictionary's,
 * then the name. The journal and the exercise screen both go through it.
 */
export const resolveIsBodyweight = ({
	entryFlag,
	exerciseFlag,
	name,
}: {
	entryFlag: boolean | null | undefined
	exerciseFlag: boolean | null | undefined
	name: string
}): boolean => entryFlag ?? exerciseFlag ?? isBodyweightByName(name)

/** The order records are listed in on a session. */
const TYPE_ORDER: readonly WorkoutRecordType[] = ['WEIGHT', 'DISTANCE', 'REPS']

/** A record is a result above everything before it: a first result is none. */
export const isRecord = (before: number | null, now: number | null): boolean =>
	before !== null && before > 0 && now !== null && now > before

const toKg = (weightKg: WeightLike | null): number => {
	if (weightKg === null) return 0
	return typeof weightKg === 'number' ? weightKg : weightKg.toNumber()
}

/** Weight 0 is «without weight» too: the model writes it for pull-ups as often as null. */
const hasWeight = (set: RecordSet): boolean => toKg(set.weightKg) > 0

/**
 * The most reps in a working set done without weight, the result a REPS record is about. Null when
 * no working set is without weight, or there are no reps; warm-up sets never count.
 */
export const getBodyweightMaxReps = (sets: readonly RecordSet[]): number | null => {
	const reps = sets.flatMap((set) =>
		!set.isWarmup && !hasWeight(set) && set.reps !== null ? [set.reps] : [],
	)
	return reps.length === 0 ? null : Math.max(...reps)
}

const getMaxWeightKg = (sets: readonly RecordSet[]): number | null => {
	const weights = sets.flatMap((set) =>
		set.isWarmup || !hasWeight(set) ? [] : [toKg(set.weightKg)],
	)
	return weights.length === 0 ? null : Math.max(...weights)
}

/** The exercises of the entries that are in the dictionary. */
export const getRecordExerciseIds = (entries: readonly { exerciseId: string | null }[]): string[] =>
	entries.flatMap(({ exerciseId }) => exerciseId ?? [])

interface Best {
	value: number
	entryId: string
	position: number
}

type SessionBests = Record<WorkoutRecordType, Best | null>

const isBetter = (candidate: Best, current: Best | null): boolean =>
	current === null ||
	candidate.value > current.value ||
	(candidate.value === current.value && candidate.position < current.position)

const getEntryValue = (entry: RecordEntryInput, type: WorkoutRecordType): number | null => {
	if (type === 'WEIGHT') return getMaxWeightKg(entry.sets)
	if (type === 'DISTANCE') return entry.distanceM
	return entry.isBodyweight ? getBodyweightMaxReps(entry.sets) : null
}

/** The best result of each type in one session; two entries of an exercise make one result. */
const getSessionBests = (entries: readonly RecordEntryInput[]): SessionBests => {
	const bests: SessionBests = { WEIGHT: null, DISTANCE: null, REPS: null }
	for (const entry of entries) {
		for (const type of TYPE_ORDER) {
			const value = getEntryValue(entry, type)
			if (value === null || value <= 0) continue
			const candidate = { value, entryId: entry.entryId, position: entry.position }
			if (isBetter(candidate, bests[type])) bests[type] = candidate
		}
	}
	return bests
}

interface Session {
	workoutId: string
	startedAt: number
	entries: RecordEntryInput[]
}

/** Sessions of one exercise, oldest first; the same moment goes by the workout id. */
const toSessions = (entries: readonly RecordEntryInput[]): Session[] => {
	const byWorkout = new Map<string, Session>()
	for (const entry of entries) {
		const session = byWorkout.get(entry.workoutId) ?? {
			workoutId: entry.workoutId,
			startedAt: entry.performedAt.getTime(),
			entries: [],
		}
		session.startedAt = Math.min(session.startedAt, entry.performedAt.getTime())
		session.entries.push(entry)
		byWorkout.set(entry.workoutId, session)
	}
	return [...byWorkout.values()].sort(
		(a, b) => a.startedAt - b.startedAt || a.workoutId.localeCompare(b.workoutId),
	)
}

const compareRecords = (a: WorkoutRecord, b: WorkoutRecord): number =>
	a.exerciseEntryId.localeCompare(b.exerciseEntryId) ||
	TYPE_ORDER.indexOf(a.type) - TYPE_ORDER.indexOf(b.type)

/**
 * The trophies in time order: per exercise and type a session is a record when it beats the best of
 * all sessions before it (the first and an equal result are none). Warm-ups never count; REPS only
 * for a bodyweight exercise. The map holds only sessions that got a record.
 */
export const computeChronologicalRecords = (
	entries: readonly RecordEntryInput[],
): Map<string, WorkoutRecord[]> => {
	const byExercise = new Map<string, RecordEntryInput[]>()
	for (const entry of entries) {
		byExercise.set(entry.exerciseId, [...(byExercise.get(entry.exerciseId) ?? []), entry])
	}
	const result = new Map<string, WorkoutRecord[]>()
	for (const exerciseEntries of byExercise.values()) {
		const maxes: Record<WorkoutRecordType, number | null> = {
			WEIGHT: null,
			DISTANCE: null,
			REPS: null,
		}
		for (const session of toSessions(exerciseEntries)) {
			const bests = getSessionBests(session.entries)
			for (const type of TYPE_ORDER) {
				const best = bests[type]
				if (best === null) continue
				if (isRecord(maxes[type], best.value)) {
					result.set(session.workoutId, [
						...(result.get(session.workoutId) ?? []),
						{ exerciseEntryId: best.entryId, type },
					])
				}
				maxes[type] = Math.max(maxes[type] ?? 0, best.value)
			}
		}
	}
	for (const [workoutId, records] of result)
		result.set(workoutId, [...records].sort(compareRecords))
	return result
}
