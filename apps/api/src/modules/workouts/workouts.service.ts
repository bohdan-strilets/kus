import { Injectable, Logger } from '@nestjs/common'
import {
	normalizeExerciseName,
	type ProgramLastSet,
	type WorkoutResponse,
	type WorkoutsRangeQuery,
} from '@kus/shared'

import { formatDbDate, toDbDate } from '../../common/time'
import type { Prisma } from '../../generated/prisma/client'
import type { ExerciseKind, MuscleGroup } from '../../generated/prisma/enums'
import { WorkoutNotFoundException } from './workouts.exceptions'
import { toWorkoutResponse } from './workouts.mapper'
import { WorkoutsRepository } from './workouts.repository'

/** A row of the user's exercise dictionary, as much as the callers need. */
export interface ExerciseRow {
	id: string
	name: string
	kind: ExerciseKind
	muscleGroup: MuscleGroup | null
	aliases?: readonly string[]
}

export interface ExerciseToResolve {
	name: string
	kind: ExerciseKind
	/** A dictionary id the caller holds; used only when it is the user's own live row. */
	exerciseId?: string | null
}

/** The workout a program turn counts from: the template's key and the day. */
export interface LastTemplatedWorkout {
	templateKey: string
	/** `YYYY-MM-DD` */
	localDate: string
}

export interface LastExerciseResult {
	sets: ProgramLastSet[]
	performedAt: Date
}

@Injectable()
export class WorkoutsService {
	private readonly logger = new Logger(WorkoutsService.name)

	constructor(private readonly workoutsRepository: WorkoutsRepository) {}

	/** The workouts of one day, in the order they were logged. */
	async getDay(userId: string, localDate: string): Promise<WorkoutResponse[]> {
		const workouts = await this.workoutsRepository.findOfDay({
			userId,
			localDate: toDbDate(localDate),
		})
		return workouts.map(toWorkoutResponse)
	}

	/** Exactly one live workout: the one just logged is the user's first ever. */
	async hasOnlyOneWorkout(userId: string, tx?: Prisma.TransactionClient): Promise<boolean> {
		const count = await this.workoutsRepository.countLive({ userId, upTo: 2 }, tx)
		return count === 1
	}

	/** The workouts of the days `from … to`, newest first: the tab groups them by day. */
	async getRange(userId: string, { from, to }: WorkoutsRangeQuery): Promise<WorkoutResponse[]> {
		const workouts = await this.workoutsRepository.findInRange({
			userId,
			from: toDbDate(from),
			to: toDbDate(to),
		})
		return workouts.map(toWorkoutResponse)
	}

	/** One live workout of the owner — the session screen; another user's or a deleted one is 404. */
	async getOne(userId: string, id: string): Promise<WorkoutResponse> {
		const workout = await this.workoutsRepository.findLiveOwned({ userId, id })
		if (!workout) throw new WorkoutNotFoundException()
		return toWorkoutResponse(workout)
	}

	async remove(userId: string, id: string): Promise<void> {
		if (!(await this.workoutsRepository.softDelete({ userId, id }))) {
			throw new WorkoutNotFoundException()
		}
		this.logger.log(`Workout deleted user=${userId} workout=${id}`)
	}

	/** Idempotent: a workout that was not deleted comes back as it is. */
	async restore(userId: string, id: string): Promise<WorkoutResponse> {
		if (await this.workoutsRepository.restore({ userId, id })) {
			this.logger.log(`Workout restored user=${userId} workout=${id}`)
		}
		const workout = await this.workoutsRepository.findOwned({ userId, id })
		if (!workout) throw new WorkoutNotFoundException()
		return toWorkoutResponse(workout)
	}

	/**
	 * The dictionary row with this name or alias, else a new one (a parallel create returns the row it
	 * lost to). Runs inside the caller's transaction.
	 */
	async findOrCreateExercise(
		userId: string,
		{ name, kind }: Pick<ExerciseToResolve, 'name' | 'kind'>,
		tx: Prisma.TransactionClient,
	): Promise<ExerciseRow> {
		const nameNormalized = normalizeExerciseName(name)
		const known = await this.workoutsRepository.findExerciseByName({ userId, nameNormalized }, tx)
		if (known) return known
		return this.workoutsRepository.createExercise({ userId, name, nameNormalized, kind }, tx)
	}

	/** The dictionary rows with these names or aliases, in the same order; null where none. Never creates. */
	async findExercisesByNames(
		userId: string,
		names: readonly string[],
	): Promise<(ExerciseRow | null)[]> {
		return Promise.all(
			names.map((name) =>
				this.workoutsRepository.findExerciseByName({
					userId,
					nameNormalized: normalizeExerciseName(name),
				}),
			),
		)
	}

	/** The user's own live dictionary rows among `ids`; others' and deleted ones are absent. */
	findExercisesByIds(userId: string, ids: string[]): Promise<ExerciseRow[]> {
		return this.workoutsRepository.findExercisesByIds({ userId, ids })
	}

	/**
	 * Dictionary rows for a list of exercises, in the same order: the user's own row by id when it is
	 * still there, else by name (found or created). One at a time, so equal names meet one row.
	 */
	async findOrCreateExercises(
		userId: string,
		items: readonly ExerciseToResolve[],
		tx: Prisma.TransactionClient,
	): Promise<ExerciseRow[]> {
		const ids = items.flatMap(({ exerciseId }) => exerciseId ?? [])
		const owned = new Map<string, ExerciseRow>()
		if (ids.length > 0) {
			const rows = await this.workoutsRepository.findExercisesByIds({ userId, ids }, tx)
			for (const row of rows) owned.set(row.id, row)
		}
		const rows: ExerciseRow[] = []
		for (const item of items) {
			const byId = item.exerciseId ? owned.get(item.exerciseId) : undefined
			rows.push(byId ?? (await this.findOrCreateExercise(userId, item, tx)))
		}
		return rows
	}

	/** The last non-deleted workout done by a program template; null when there is none. */
	async findLastTemplatedWorkout(userId: string): Promise<LastTemplatedWorkout | null> {
		const workout = await this.workoutsRepository.findLastTemplatedWorkout({ userId })
		if (!workout?.template) return null
		return { templateKey: workout.template.key, localDate: formatDbDate(workout.localDate) }
	}

	/** Exercise id → the sets of the last time it was done; exercises never done are absent. */
	async getLastSets(
		userId: string,
		exerciseIds: readonly string[],
	): Promise<Map<string, LastExerciseResult>> {
		const results = new Map<string, LastExerciseResult>()
		if (exerciseIds.length === 0) return results
		const entries = await this.workoutsRepository.findLastEntriesOfExercises({
			userId,
			exerciseIds: [...exerciseIds],
		})
		for (const { exerciseId, performedAt, sets } of entries) {
			if (exerciseId === null) continue
			results.set(exerciseId, {
				performedAt,
				sets: sets.map((set) => ({
					reps: set.reps,
					weightKg: set.weightKg === null ? null : set.weightKg.toNumber(),
					isWarmup: set.isWarmup,
				})),
			})
		}
		return results
	}
}
