import { Injectable } from '@nestjs/common'
import type { TrainingGroupKey } from '@kus/shared'

import type { Prisma } from '../../generated/prisma/client'
import type { ExerciseKind, MuscleGroup } from '../../generated/prisma/enums'
import { PrismaService } from '../../prisma'
import { placeAfter } from './workout-session'
import { HIDE_OPEN_LIVE } from './workout-visibility'

/** A workout and the message it started; `deletedAt` tells it was deleted since. */
export interface WorkoutStart {
	id: string
	sourceMessageId: string | null
	deletedAt: Date | null
}

/**
 * A workout with its live exercises and their sets, in the order they were done; the dictionary
 * row's group is the one shown.
 */
export const WITH_EXERCISES = {
	exercises: {
		where: { deletedAt: null },
		orderBy: { position: 'asc' },
		include: {
			sets: { orderBy: { position: 'asc' } },
			exercise: { select: { muscleGroup: true, isBodyweight: true } },
		},
	},
	// the name in the version it was done by: the journal's «· Тренування А»
	template: { select: { name: true } },
} satisfies Prisma.WorkoutInclude

export type WorkoutWithExercises = Prisma.WorkoutGetPayload<{ include: typeof WITH_EXERCISES }>

/** The fields of a workout the chat writes; the rows below it are written with it. */
export interface WorkoutWrite {
	userId: string
	localDate: Date
	startedAt: Date | null
	durationMin: number | null
	place: Prisma.WorkoutUncheckedCreateInput['place']
	kcalBurned: number | null
	/** The program template it is done by; null when none. */
	templateId: string | null
	sourceMessageId: string | null
	/** Set when the message finishes the session (or tells it whole); a replace leaves them as they are. */
	finishedAt: Date | null
	finishedMessageId: string | null
	exercises: ExerciseWrite[]
}

/** What a later message adds to a session: its rows keep the session's day. */
export type ExercisesAppend = Pick<
	WorkoutWrite,
	'userId' | 'localDate' | 'sourceMessageId' | 'exercises'
>

/** Session fields a later message names; undefined leaves the field as it is. */
export interface SessionFields {
	place?: NonNullable<WorkoutWrite['place']>
	durationMin?: number
	kcalBurned?: number
	finishedAt?: Date
	finishedMessageId?: string
	templateId?: string
}

export interface ExerciseWrite {
	exerciseId: string
	name: string
	kind: ExerciseKind
	/** The snapshot of the group when logged; null for cardio. */
	muscleGroup: MuscleGroup | null
	position: number
	durationMin: number | null
	distanceM: number | null
	performedAt: Date
	/** The message the row came from when not the workout's own (a replace keeps the earlier one). */
	sourceMessageId?: string | null
	/** A chat rewrite of an exercise of the live mode keeps its key, template exercise and flag. */
	clientKey?: string | null
	templateExerciseId?: string | null
	isBodyweight?: boolean | null
	sets: {
		position: number
		reps: number | null
		weightKg: number | null
		isWarmup: boolean
		/** Set only for the sets of a rewritten live exercise; the chat's own sets have none. */
		doneAt?: Date | null
	}[]
}

const toExerciseCreate = (
	write: ExercisesAppend,
): Prisma.ExerciseEntryUncheckedCreateWithoutWorkoutInput[] =>
	write.exercises.map((exercise) => ({
		userId: write.userId,
		exerciseId: exercise.exerciseId,
		name: exercise.name,
		kind: exercise.kind,
		muscleGroup: exercise.muscleGroup,
		position: exercise.position,
		durationMin: exercise.durationMin,
		distanceM: exercise.distanceM,
		source: 'MANUAL',
		performedAt: exercise.performedAt,
		localDate: write.localDate,
		sourceMessageId:
			exercise.sourceMessageId === undefined ? write.sourceMessageId : exercise.sourceMessageId,
		clientKey: exercise.clientKey ?? null,
		templateExerciseId: exercise.templateExerciseId ?? null,
		isBodyweight: exercise.isBodyweight ?? null,
		sets: {
			create: exercise.sets.map((set) => ({ ...set, userId: write.userId })),
		},
	}))

/** Every read is scoped by `userId`; a soft-deleted workout shows only through `findOwned`. */
@Injectable()
export class WorkoutsRepository {
	constructor(private readonly prisma: PrismaService) {}

	/** Live workouts of the days `from … to`, newest day first; an open live session is not among them. */
	findInRange(
		{ userId, from, to }: { userId: string; from: Date; to: Date },
		tx?: Prisma.TransactionClient,
	): Promise<WorkoutWithExercises[]> {
		return (tx ?? this.prisma).workout.findMany({
			where: { userId, deletedAt: null, localDate: { gte: from, lte: to }, ...HIDE_OPEN_LIVE },
			include: WITH_EXERCISES,
			orderBy: [{ localDate: 'desc' }, { createdAt: 'desc' }],
		})
	}

	/**
	 * Live workouts of one day, in the order they were logged. An open live session only with
	 * `withOpenLive`: the chat (its context, «все») sees it, the day and the journal do not.
	 */
	findOfDay(
		{
			userId,
			localDate,
			withOpenLive = false,
		}: { userId: string; localDate: Date; withOpenLive?: boolean },
		tx?: Prisma.TransactionClient,
	): Promise<WorkoutWithExercises[]> {
		return (tx ?? this.prisma).workout.findMany({
			where: { userId, deletedAt: null, localDate, ...(withOpenLive ? {} : HIDE_OPEN_LIVE) },
			include: WITH_EXERCISES,
			orderBy: { createdAt: 'asc' },
		})
	}

	/** Live workouts with a live entry done since `since` (any day), in the order they were logged. */
	findRecent(
		{ userId, since }: { userId: string; since: Date },
		tx?: Prisma.TransactionClient,
	): Promise<WorkoutWithExercises[]> {
		return (tx ?? this.prisma).workout.findMany({
			where: {
				userId,
				deletedAt: null,
				exercises: { some: { userId, deletedAt: null, performedAt: { gte: since } } },
			},
			include: WITH_EXERCISES,
			orderBy: { createdAt: 'asc' },
		})
	}

	/** Workouts deleted on a day (by their own day), the latest deletion first. */
	findDeletedOfDay(
		{ userId, localDate, take }: { userId: string; localDate: Date; take: number },
		tx?: Prisma.TransactionClient,
	): Promise<WorkoutWithExercises[]> {
		return (tx ?? this.prisma).workout.findMany({
			// a discarded live session («Вийти без збереження») is a draft nobody brings back
			where: { userId, localDate, deletedAt: { not: null }, ...HIDE_OPEN_LIVE },
			include: WITH_EXERCISES,
			orderBy: { deletedAt: 'desc' },
			take,
		})
	}

	/**
	 * The workouts user messages started, finished or added exercises to; a deleted one stays, the
	 * chat shows it as a line.
	 */
	findBySourceMessages(
		{ userId, messageIds }: { userId: string; messageIds: string[] },
		tx?: Prisma.TransactionClient,
	): Promise<WorkoutWithExercises[]> {
		return (tx ?? this.prisma).workout.findMany({
			where: {
				userId,
				OR: [
					{ sourceMessageId: { in: messageIds } },
					{ finishedMessageId: { in: messageIds } },
					{
						exercises: {
							some: { userId, deletedAt: null, sourceMessageId: { in: messageIds } },
						},
					},
				],
			},
			include: WITH_EXERCISES,
			orderBy: { createdAt: 'asc' },
		})
	}

	/**
	 * Which workouts the user messages started and whether they were deleted since, for the markers
	 * of the model's history. A discarded open live session stays out: nobody brings that draft back.
	 */
	findStartedByMessages(
		{ userId, messageIds }: { userId: string; messageIds: string[] },
		tx?: Prisma.TransactionClient,
	): Promise<WorkoutStart[]> {
		return (tx ?? this.prisma).workout.findMany({
			where: {
				userId,
				sourceMessageId: { in: messageIds },
				OR: [{ deletedAt: null }, HIDE_OPEN_LIVE],
			},
			select: { id: true, sourceMessageId: true, deletedAt: true },
			orderBy: { createdAt: 'asc' },
		})
	}

	/** The owner's live workout; null when it is not theirs or was deleted. */
	findLiveOwned(
		{ userId, id }: { userId: string; id: string },
		tx?: Prisma.TransactionClient,
	): Promise<WorkoutWithExercises | null> {
		return (tx ?? this.prisma).workout.findFirst({
			where: { id, userId, deletedAt: null },
			include: WITH_EXERCISES,
		})
	}

	/**
	 * How many live (not deleted) workouts the owner has, counting no further than `upTo`; an open
	 * live-mode session is not one yet.
	 */
	countLive(
		{ userId, upTo }: { userId: string; upTo: number },
		tx?: Prisma.TransactionClient,
	): Promise<number> {
		return (tx ?? this.prisma).workout.count({
			where: { userId, deletedAt: null, ...HIDE_OPEN_LIVE },
			take: upTo,
		})
	}

	/** The owner's workout, deleted or not; null when it is not theirs. */
	findOwned(
		{ userId, id }: { userId: string; id: string },
		tx?: Prisma.TransactionClient,
	): Promise<WorkoutWithExercises | null> {
		return (tx ?? this.prisma).workout.findFirst({
			where: { id, userId },
			include: WITH_EXERCISES,
		})
	}

	/** Marks the owner's workout deleted; false when it is not theirs or already deleted. */
	async softDelete(
		{ userId, id }: { userId: string; id: string },
		tx?: Prisma.TransactionClient,
	): Promise<boolean> {
		const { count } = await (tx ?? this.prisma).workout.updateMany({
			where: { id, userId, deletedAt: null },
			data: { deletedAt: new Date() },
		})
		return count > 0
	}

	/**
	 * Brings the owner's deleted workout back; false when it is not theirs, not deleted, or a
	 * discarded live session that was never finished.
	 */
	async restore(
		{ userId, id }: { userId: string; id: string },
		tx?: Prisma.TransactionClient,
	): Promise<boolean> {
		const { count } = await (tx ?? this.prisma).workout.updateMany({
			// not a discarded open live session: it would be a second open one (workouts_one_open_live)
			where: { id, userId, deletedAt: { not: null }, ...HIDE_OPEN_LIVE },
			data: { deletedAt: null },
		})
		return count > 0
	}

	create(write: WorkoutWrite, tx: Prisma.TransactionClient): Promise<WorkoutWithExercises> {
		return tx.workout.create({
			data: {
				userId: write.userId,
				localDate: write.localDate,
				startedAt: write.startedAt,
				durationMin: write.durationMin,
				place: write.place,
				kcalBurned: write.kcalBurned,
				kcalSource: write.kcalBurned === null ? null : 'MANUAL',
				templateId: write.templateId,
				sourceMessageId: write.sourceMessageId,
				finishedAt: write.finishedAt,
				finishedMessageId: write.finishedMessageId,
				exercises: { create: toExerciseCreate(write) },
			},
			include: WITH_EXERCISES,
		})
	}

	/**
	 * Adds exercises to the owner's live workout; the session's own fields stay. Null when it is not
	 * theirs or was deleted meanwhile.
	 */
	async appendExercises(
		{ id, append }: { id: string; append: ExercisesAppend },
		tx: Prisma.TransactionClient,
	): Promise<WorkoutWithExercises | null> {
		const workout = await tx.workout.findFirst({
			where: { id, userId: append.userId, deletedAt: null },
			select: { id: true },
		})
		if (!workout) return null
		// read in this transaction, right before the write: the new rows go after every row there is
		const { _max } = await tx.exerciseEntry.aggregate({
			_max: { position: true },
			where: { workoutId: id, userId: append.userId },
		})
		const exercises = placeAfter(append.exercises, _max.position)
		return tx.workout.update({
			where: { id, userId: append.userId },
			data: { exercises: { create: toExerciseCreate({ ...append, exercises }) } },
			include: WITH_EXERCISES,
		})
	}

	/** Sets the named fields of the owner's live workout; false when it is not theirs or deleted. */
	async updateSessionFields(
		{ userId, id, fields }: { userId: string; id: string; fields: SessionFields },
		tx: Prisma.TransactionClient,
	): Promise<boolean> {
		const { count } = await tx.workout.updateMany({
			where: { id, userId, deletedAt: null },
			data: {
				...fields,
				...(fields.kcalBurned === undefined ? {} : { kcalSource: 'MANUAL' as const }),
			},
		})
		return count > 0
	}

	/**
	 * Replaces what the owner's live workout holds with `write`, keeping the workout itself (its id,
	 * its message). Null when it is not theirs or was deleted meanwhile.
	 */
	async replace(
		{ id, write }: { id: string; write: WorkoutWrite },
		tx: Prisma.TransactionClient,
	): Promise<WorkoutWithExercises | null> {
		const { count } = await tx.workout.updateMany({
			where: { id, userId: write.userId, deletedAt: null },
			data: {
				localDate: write.localDate,
				startedAt: write.startedAt,
				durationMin: write.durationMin,
				place: write.place,
				kcalBurned: write.kcalBurned,
				kcalSource: write.kcalBurned === null ? null : 'MANUAL',
				templateId: write.templateId,
				editedAt: new Date(),
			},
		})
		if (count === 0) return null
		await tx.exerciseEntry.deleteMany({ where: { workoutId: id, userId: write.userId } })
		return tx.workout.update({
			where: { id, userId: write.userId },
			data: { records: [], exercises: { create: toExerciseCreate(write) } },
			include: WITH_EXERCISES,
		})
	}

	setRecords(
		{ id, records }: { id: string; records: Prisma.InputJsonValue },
		tx: Prisma.TransactionClient,
	): Promise<unknown> {
		return tx.workout.update({ where: { id }, data: { records } })
	}

	/** The user's dictionary, for a message to be matched against. */
	findDictionary(
		{ userId, take }: { userId: string; take: number },
		tx?: Prisma.TransactionClient,
	) {
		return (tx ?? this.prisma).exercise.findMany({
			where: { userId, deletedAt: null },
			orderBy: { updatedAt: 'desc' },
			take,
		})
	}

	/** The dictionary row of the owner by name or alias (both already normalized). */
	findExerciseByName(
		{ userId, nameNormalized }: { userId: string; nameNormalized: string },
		tx?: Prisma.TransactionClient,
	) {
		return (tx ?? this.prisma).exercise.findFirst({
			where: {
				userId,
				deletedAt: null,
				OR: [{ nameNormalized }, { aliases: { has: nameNormalized } }],
			},
		})
	}

	/** The owner's live dictionary rows, filtered by a part of the name (normalized) and a group. */
	findExercisesFiltered(
		{
			userId,
			nameContains,
			group,
			take,
		}: { userId: string; nameContains?: string; group?: TrainingGroupKey; take: number },
		tx?: Prisma.TransactionClient,
	) {
		return (tx ?? this.prisma).exercise.findMany({
			where: {
				userId,
				deletedAt: null,
				...(nameContains ? { nameNormalized: { contains: nameContains } } : {}),
				...(group === 'CARDIO' ? { kind: 'CARDIO' } : {}),
				...(group !== undefined && group !== 'CARDIO' ? { muscleGroup: group } : {}),
			},
			orderBy: { nameNormalized: 'asc' },
			take,
		})
	}

	findExercisesByIds(
		{ userId, ids }: { userId: string; ids: string[] },
		tx?: Prisma.TransactionClient,
	) {
		return (tx ?? this.prisma).exercise.findMany({
			where: { userId, deletedAt: null, id: { in: ids } },
		})
	}

	/**
	 * Creates the dictionary row, or leaves the one a parallel turn just created (ON CONFLICT DO NOTHING
	 * on the partial unique: a failed insert would abort the whole turn's transaction), and returns it.
	 */
	async createExercise(
		data: {
			userId: string
			name: string
			nameNormalized: string
			kind: ExerciseKind
			muscleGroup?: MuscleGroup | null
		},
		tx: Prisma.TransactionClient,
	) {
		await tx.exercise.createMany({ data: [{ ...data, aliases: [] }], skipDuplicates: true })
		return tx.exercise.findFirstOrThrow({
			where: { userId: data.userId, nameNormalized: data.nameNormalized, deletedAt: null },
		})
	}

	/** The user's fix of a group: overwrites the owner's dictionary row (never a cardio one). */
	async setExerciseMuscleGroup(
		{ userId, id, muscleGroup }: { userId: string; id: string; muscleGroup: MuscleGroup },
		tx: Prisma.TransactionClient,
	): Promise<void> {
		await tx.exercise.updateMany({
			where: { id, userId, deletedAt: null, kind: { not: 'CARDIO' } },
			data: { muscleGroup },
		})
	}

	/** The user's explicit «Власна вага» on or off: the dictionary learns it. */
	async setExerciseBodyweight(
		{ userId, id, isBodyweight }: { userId: string; id: string; isBodyweight: boolean },
		tx: Prisma.TransactionClient,
	): Promise<void> {
		// only a real change: each live snapshot would bump the row's updatedAt (the dictionary's order)
		await tx.exercise.updateMany({
			where: {
				id,
				userId,
				deletedAt: null,
				OR: [{ isBodyweight: null }, { isBodyweight: !isBodyweight }],
			},
			data: { isBodyweight },
		})
	}

	/** Sets the group of the owner's dictionary row unless it already has one. */
	async fillExerciseMuscleGroup(
		{ userId, id, muscleGroup }: { userId: string; id: string; muscleGroup: MuscleGroup },
		tx: Prisma.TransactionClient,
	): Promise<void> {
		await tx.exercise.updateMany({
			where: { id, userId, muscleGroup: null },
			data: { muscleGroup },
		})
	}

	/** The latest time the owner did the exercise (in a live workout), with its sets. */
	findLastResult(
		{ userId, exerciseId }: { userId: string; exerciseId: string },
		tx?: Prisma.TransactionClient,
	) {
		return (tx ?? this.prisma).exerciseEntry.findFirst({
			where: {
				userId,
				exerciseId,
				deletedAt: null,
				workout: { deletedAt: null, ...HIDE_OPEN_LIVE },
			},
			orderBy: { performedAt: 'desc' },
			include: { sets: { orderBy: { position: 'asc' } } },
		})
	}

	/**
	 * The latest live workout done by a program template (the template's key survives edits, its id does
	 * not): the day of the program's turn. Null when none was.
	 */
	findLastTemplatedWorkout(
		{ userId }: { userId: string },
		tx?: Prisma.TransactionClient,
	): Promise<{ localDate: Date; template: { key: string } | null } | null> {
		return (tx ?? this.prisma).workout.findFirst({
			// an open live session moves the turn only once it is finished
			where: { userId, deletedAt: null, templateId: { not: null }, ...HIDE_OPEN_LIVE },
			orderBy: [
				{ localDate: 'desc' },
				{ startedAt: { sort: 'desc', nulls: 'last' } },
				{ createdAt: 'desc' },
			],
			select: { localDate: true, template: { select: { key: true } } },
		})
	}

	/**
	 * For each exercise the most recent live entry with its sets (one batch query). A cardio entry
	 * counts only with a duration or a distance, so one without numbers does not hide earlier results.
	 */
	findLastEntriesOfExercises(
		{ userId, exerciseIds }: { userId: string; exerciseIds: string[] },
		tx?: Prisma.TransactionClient,
	) {
		return (tx ?? this.prisma).exerciseEntry.findMany({
			where: {
				userId,
				exerciseId: { in: exerciseIds },
				deletedAt: null,
				workout: { deletedAt: null, ...HIDE_OPEN_LIVE },
				OR: [
					{ kind: { not: 'CARDIO' } },
					{ durationMin: { not: null } },
					{ distanceM: { not: null } },
				],
			},
			distinct: ['exerciseId'],
			orderBy: [{ exerciseId: 'asc' }, { performedAt: 'desc' }],
			select: {
				exerciseId: true,
				performedAt: true,
				durationMin: true,
				distanceM: true,
				sets: {
					orderBy: { position: 'asc' },
					select: { reps: true, weightKg: true, isWarmup: true },
				},
			},
		})
	}

	/**
	 * Every live entry of the exercises in live workouts (an open live session is not among them),
	 * oldest first: what the chronological records are computed from.
	 */
	findRecordEntries(
		{ userId, exerciseIds }: { userId: string; exerciseIds: string[] },
		tx: Prisma.TransactionClient,
	) {
		return tx.exerciseEntry.findMany({
			where: {
				userId,
				exerciseId: { in: exerciseIds },
				deletedAt: null,
				workout: { userId, deletedAt: null, ...HIDE_OPEN_LIVE },
			},
			orderBy: [{ performedAt: 'asc' }, { id: 'asc' }],
			select: {
				id: true,
				workoutId: true,
				exerciseId: true,
				name: true,
				performedAt: true,
				position: true,
				distanceM: true,
				isBodyweight: true,
				exercise: { select: { isBodyweight: true } },
				sets: { select: { reps: true, weightKg: true, isWarmup: true } },
				// the live entries of the session: a record of an entry that is gone (a replaced exercise) is dropped
				workout: {
					select: {
						records: true,
						exercises: { where: { deletedAt: null }, select: { id: true } },
					},
				},
			},
		})
	}
}
