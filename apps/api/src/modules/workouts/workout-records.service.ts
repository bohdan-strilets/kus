import { Injectable } from '@nestjs/common'
import { isBodyweightByName } from '@kus/shared'

import type { Prisma } from '../../generated/prisma/client'
import { computeChronologicalRecords, type RecordEntryInput } from './workout-records'
import type { WorkoutRecord } from './workout-turn'
import { readWorkoutRecords } from './workouts.mapper'
import { WorkoutsRepository } from './workouts.repository'

type RecordEntryRow = Awaited<ReturnType<WorkoutsRepository['findRecordEntries']>>[number]

/** Entries without a workout or a dictionary row hold no record. */
const toRecordEntry = (row: RecordEntryRow): RecordEntryInput | null => {
	if (row.workoutId === null || row.exerciseId === null) return null
	return {
		entryId: row.id,
		workoutId: row.workoutId,
		exerciseId: row.exerciseId,
		performedAt: row.performedAt,
		position: row.position,
		distanceM: row.distanceM,
		// the entry's own flag, then the dictionary's, then the name
		isBodyweight: row.isBodyweight ?? row.exercise?.isBodyweight ?? isBodyweightByName(row.name),
		sets: row.sets.map((set) => ({
			reps: set.reps,
			weightKg: set.weightKg,
			isWarmup: set.isWarmup,
		})),
	}
}

/** The records of the sessions, one place for the chat, «Завершити», the form and delete / restore. */
@Injectable()
export class WorkoutRecordsService {
	constructor(private readonly workoutsRepository: WorkoutsRepository) {}

	/**
	 * Recomputes the trophies of the exercises over all the user's sessions in time order and
	 * stores what changed, inside the caller's transaction. Only the records of these exercises'
	 * entries are replaced; the rest of a session's records stay. Returns every touched session's
	 * records after the change (a session of other exercises only is not in the map).
	 */
	async recompute(
		userId: string,
		exerciseIds: Iterable<string>,
		tx: Prisma.TransactionClient,
	): Promise<Map<string, WorkoutRecord[]>> {
		const ids = [...new Set(exerciseIds)]
		const result = new Map<string, WorkoutRecord[]>()
		if (ids.length === 0) return result
		const rows = await this.workoutsRepository.findRecordEntries({ userId, exerciseIds: ids }, tx)
		const computed = computeChronologicalRecords(rows.flatMap((row) => toRecordEntry(row) ?? []))
		const sessions = new Map<
			string,
			{ stored: WorkoutRecord[]; entryIds: Set<string>; liveIds: Set<string> }
		>()
		for (const row of rows) {
			if (row.workoutId === null) continue
			const session = sessions.get(row.workoutId) ?? {
				stored: readWorkoutRecords(row.workout ?? { records: null }),
				entryIds: new Set<string>(),
				liveIds: new Set((row.workout?.exercises ?? []).map(({ id }) => id)),
			}
			session.entryIds.add(row.id)
			sessions.set(row.workoutId, session)
		}
		for (const [workoutId, { stored, entryIds, liveIds }] of sessions) {
			// records of other live entries stay; those of replaced (deleted) entries and of these exercises go
			const kept = stored.filter(
				(record) => liveIds.has(record.exerciseEntryId) && !entryIds.has(record.exerciseEntryId),
			)
			const next = [...kept, ...(computed.get(workoutId) ?? [])]
			result.set(workoutId, next)
			if (JSON.stringify(next) === JSON.stringify(stored)) continue
			await this.workoutsRepository.setRecords({ id: workoutId, records: next }, tx)
		}
		return result
	}
}
