import { Injectable } from '@nestjs/common'

import type { Prisma } from '../../generated/prisma/client'
import type { ExerciseKind, MuscleGroup } from '../../generated/prisma/enums'
import { PrismaService } from '../../prisma'

/**
 * A workout with its live exercises and their sets, in the order they were done; the dictionary
 * row's group is the one shown.
 */
const WITH_EXERCISES = {
	exercises: {
		where: { deletedAt: null },
		orderBy: { position: 'asc' },
		include: {
			sets: { orderBy: { position: 'asc' } },
			exercise: { select: { muscleGroup: true } },
		},
	},
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
	sourceMessageId: string | null
	exercises: ExerciseWrite[]
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
	sets: { position: number; reps: number | null; weightKg: number | null; isWarmup: boolean }[]
}

const toExerciseCreate = (
	write: WorkoutWrite,
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
		sourceMessageId: write.sourceMessageId,
		sets: {
			create: exercise.sets.map((set) => ({ ...set, userId: write.userId })),
		},
	}))

/** Every read is scoped by `userId`; a soft-deleted workout shows only through `findOwned`. */
@Injectable()
export class WorkoutsRepository {
	constructor(private readonly prisma: PrismaService) {}

	/** Live workouts of the days `from … to`, newest day first. */
	findInRange(
		{ userId, from, to }: { userId: string; from: Date; to: Date },
		tx?: Prisma.TransactionClient,
	): Promise<WorkoutWithExercises[]> {
		return (tx ?? this.prisma).workout.findMany({
			where: { userId, deletedAt: null, localDate: { gte: from, lte: to } },
			include: WITH_EXERCISES,
			orderBy: [{ localDate: 'desc' }, { createdAt: 'desc' }],
		})
	}

	/** Live workouts of one day, in the order they were logged. */
	findOfDay(
		{ userId, localDate }: { userId: string; localDate: Date },
		tx?: Prisma.TransactionClient,
	): Promise<WorkoutWithExercises[]> {
		return (tx ?? this.prisma).workout.findMany({
			where: { userId, deletedAt: null, localDate },
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
			where: { userId, localDate, deletedAt: { not: null } },
			include: WITH_EXERCISES,
			orderBy: { deletedAt: 'desc' },
			take,
		})
	}

	/** The workouts a user message recorded; a deleted one stays, the chat shows it as a line. */
	findBySourceMessages(
		{ userId, messageIds }: { userId: string; messageIds: string[] },
		tx?: Prisma.TransactionClient,
	): Promise<WorkoutWithExercises[]> {
		return (tx ?? this.prisma).workout.findMany({
			where: { userId, sourceMessageId: { in: messageIds } },
			include: WITH_EXERCISES,
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

	/** Brings the owner's deleted workout back; false when it is not theirs or not deleted. */
	async restore(
		{ userId, id }: { userId: string; id: string },
		tx?: Prisma.TransactionClient,
	): Promise<boolean> {
		const { count } = await (tx ?? this.prisma).workout.updateMany({
			where: { id, userId, deletedAt: { not: null } },
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
				sourceMessageId: write.sourceMessageId,
				exercises: { create: toExerciseCreate(write) },
			},
			include: WITH_EXERCISES,
		})
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
		tx: Prisma.TransactionClient,
	) {
		return tx.exercise.findFirst({
			where: {
				userId,
				deletedAt: null,
				OR: [{ nameNormalized }, { aliases: { has: nameNormalized } }],
			},
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
		data: { userId: string; name: string; nameNormalized: string; kind: ExerciseKind },
		tx: Prisma.TransactionClient,
	) {
		await tx.exercise.createMany({ data: [{ ...data, aliases: [] }], skipDuplicates: true })
		return tx.exercise.findFirstOrThrow({
			where: { userId: data.userId, nameNormalized: data.nameNormalized, deletedAt: null },
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
			where: { userId, exerciseId, deletedAt: null, workout: { deletedAt: null } },
			orderBy: { performedAt: 'desc' },
			include: { sets: { orderBy: { position: 'asc' } } },
		})
	}

	/** The heaviest working (not warm-up) set of the exercise in other live workouts. */
	async findMaxWeightKg(
		{
			userId,
			exerciseId,
			exceptWorkoutId,
		}: { userId: string; exerciseId: string; exceptWorkoutId: string },
		tx: Prisma.TransactionClient,
	): Promise<number | null> {
		const { _max } = await tx.exerciseSet.aggregate({
			_max: { weightKg: true },
			where: {
				userId,
				isWarmup: false,
				exerciseEntry: {
					exerciseId,
					deletedAt: null,
					workout: { deletedAt: null, id: { not: exceptWorkoutId } },
				},
			},
		})
		return _max.weightKg === null ? null : _max.weightKg.toNumber()
	}

	/** The most reps in a working set without weight (none or 0 kg) of the exercise in other live workouts. */
	async findMaxReps(
		{
			userId,
			exerciseId,
			exceptWorkoutId,
		}: { userId: string; exerciseId: string; exceptWorkoutId: string },
		tx: Prisma.TransactionClient,
	): Promise<number | null> {
		const { _max } = await tx.exerciseSet.aggregate({
			_max: { reps: true },
			where: {
				userId,
				isWarmup: false,
				OR: [{ weightKg: null }, { weightKg: 0 }],
				exerciseEntry: {
					exerciseId,
					deletedAt: null,
					workout: { deletedAt: null, id: { not: exceptWorkoutId } },
				},
			},
		})
		return _max.reps
	}

	/** The longest distance of the exercise in other live workouts, metres. */
	async findMaxDistanceM(
		{
			userId,
			exerciseId,
			exceptWorkoutId,
		}: { userId: string; exerciseId: string; exceptWorkoutId: string },
		tx: Prisma.TransactionClient,
	): Promise<number | null> {
		const { _max } = await tx.exerciseEntry.aggregate({
			_max: { distanceM: true },
			where: {
				userId,
				exerciseId,
				deletedAt: null,
				workout: { deletedAt: null, id: { not: exceptWorkoutId } },
			},
		})
		return _max.distanceM
	}
}
