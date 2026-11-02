import { Injectable, Logger } from '@nestjs/common'
import {
	EXERCISE_DICTIONARY_LIMIT,
	type ExerciseDictionaryItem,
	type ExerciseDictionaryQuery,
	type ExerciseDictionaryResponse,
	matchMuscleGroup,
	normalizeExerciseName,
	type ProgramLastSet,
	type WorkoutResponse,
	type WorkoutsRangeQuery,
} from '@kus/shared'

import { formatDbDate, toDbDate } from '../../common/time'
import type { Prisma } from '../../generated/prisma/client'
import type { ExerciseKind, MuscleGroup } from '../../generated/prisma/enums'
import { WorkoutNotFoundException } from './workouts.exceptions'
import { WorkoutKcalService } from './workout-kcal.service'
import { type WorkoutWithExercises, WorkoutsRepository } from './workouts.repository'

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
	/**
	 * The group the caller holds (a program template's). Undefined: the caller sets none (the chat
	 * resolves it itself); null: it has none. Fills a new or group-less dictionary row, never overwrites.
	 */
	muscleGroup?: MuscleGroup | null
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
	durationMin: number | null
	distanceM: number | null
}

/** The last cardio result, or null when it never happened or carried no number. */
const toLastCardio = (
	last: LastExerciseResult | undefined,
): ExerciseDictionaryItem['lastCardio'] => {
	if (!last || (last.durationMin === null && last.distanceM === null)) return null
	return { durationMin: last.durationMin, distanceM: last.distanceM }
}

@Injectable()
export class WorkoutsService {
	private readonly logger = new Logger(WorkoutsService.name)

	constructor(
		private readonly workoutsRepository: WorkoutsRepository,
		private readonly kcal: WorkoutKcalService,
	) {}

	/** The workouts of one day, in the order they were logged. */
	async getDay(userId: string, localDate: string): Promise<WorkoutResponse[]> {
		const workouts = await this.workoutsRepository.findOfDay({
			userId,
			localDate: toDbDate(localDate),
		})
		return this.kcal.toResponses(userId, workouts)
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
		return this.kcal.toResponses(userId, workouts)
	}

	/** One live workout of the owner — the session screen; another user's or a deleted one is 404. */
	async getOne(userId: string, id: string): Promise<WorkoutResponse> {
		const workout = await this.workoutsRepository.findLiveOwned({ userId, id })
		if (!workout) throw new WorkoutNotFoundException()
		return this.toOneResponse(userId, workout)
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
		return this.toOneResponse(userId, workout)
	}

	private async toOneResponse(
		userId: string,
		workout: WorkoutWithExercises,
	): Promise<WorkoutResponse> {
		const [response] = await this.kcal.toResponses(userId, [workout])
		if (!response) throw new WorkoutNotFoundException()
		return response
	}

	/**
	 * The dictionary row with this name or alias, else a new one (a parallel create returns the row it
	 * lost to). Runs inside the caller's transaction.
	 */
	async findOrCreateExercise(
		userId: string,
		item: Pick<ExerciseToResolve, 'name' | 'kind' | 'muscleGroup'>,
		tx: Prisma.TransactionClient,
	): Promise<ExerciseRow> {
		const { name, kind } = item
		const nameNormalized = normalizeExerciseName(name)
		const known = await this.workoutsRepository.findExerciseByName({ userId, nameNormalized }, tx)
		if (known) return this.fillMuscleGroup(userId, known, item, tx)
		const muscleGroup = this.pickMuscleGroup(item)
		return this.workoutsRepository.createExercise(
			{ userId, name, nameNormalized, kind, muscleGroup },
			tx,
		)
	}

	/** The group a caller's item gives the dictionary: none for cardio and for callers that set none. */
	private pickMuscleGroup({
		name,
		kind,
		muscleGroup,
	}: Pick<ExerciseToResolve, 'name' | 'kind' | 'muscleGroup'>): MuscleGroup | null {
		if (kind === 'CARDIO' || muscleGroup === undefined) return null
		return muscleGroup ?? matchMuscleGroup(name)
	}

	/** A group-less row takes the item's group; a row that has one keeps it. */
	private async fillMuscleGroup(
		userId: string,
		row: ExerciseRow,
		item: Pick<ExerciseToResolve, 'name' | 'kind' | 'muscleGroup'>,
		tx: Prisma.TransactionClient,
	): Promise<ExerciseRow> {
		if (row.muscleGroup !== null || row.kind === 'CARDIO') return row
		const muscleGroup = this.pickMuscleGroup(item)
		if (muscleGroup === null) return row
		await this.workoutsRepository.fillExerciseMuscleGroup({ userId, id: row.id, muscleGroup }, tx)
		return { ...row, muscleGroup }
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
			rows.push(
				byId
					? await this.fillMuscleGroup(userId, byId, item, tx)
					: await this.findOrCreateExercise(userId, item, tx),
			)
		}
		return rows
	}

	/** The user's explicit bodyweight flag of an exercise (the live mode, the form) goes to the dictionary. */
	setExerciseBodyweight(
		userId: string,
		{ id, isBodyweight }: { id: string; isBodyweight: boolean },
		tx: Prisma.TransactionClient,
	): Promise<void> {
		return this.workoutsRepository.setExerciseBodyweight({ userId, id, isBodyweight }, tx)
	}

	/** The last non-deleted workout done by a program template; null when there is none. */
	async findLastTemplatedWorkout(userId: string): Promise<LastTemplatedWorkout | null> {
		const workout = await this.workoutsRepository.findLastTemplatedWorkout({ userId })
		if (!workout?.template) return null
		return { templateKey: workout.template.key, localDate: formatDbDate(workout.localDate) }
	}

	/** «Мої вправи» of the template editor: the owner's dictionary with the last result of each. */
	async listExercises(
		userId: string,
		{ query, group }: ExerciseDictionaryQuery,
	): Promise<ExerciseDictionaryResponse> {
		const nameContains = query ? normalizeExerciseName(query) : undefined
		const rows = await this.workoutsRepository.findExercisesFiltered({
			userId,
			nameContains,
			group,
			take: EXERCISE_DICTIONARY_LIMIT,
		})
		const lastSets = await this.getLastSets(
			userId,
			rows.map(({ id }) => id),
		)
		return rows.map(({ id, name, kind, muscleGroup }) => ({
			id,
			name,
			kind,
			muscleGroup,
			lastSets: lastSets.get(id)?.sets ?? null,
			lastCardio: kind === 'CARDIO' ? toLastCardio(lastSets.get(id)) : null,
		}))
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
		for (const { exerciseId, performedAt, durationMin, distanceM, sets } of entries) {
			if (exerciseId === null) continue
			results.set(exerciseId, {
				performedAt,
				durationMin,
				distanceM,
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
