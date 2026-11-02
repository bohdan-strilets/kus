import { Injectable } from '@nestjs/common'

import type { Prisma } from '../../generated/prisma/client'
import type { ExerciseKind, MuscleGroup } from '../../generated/prisma/enums'
import { PrismaService } from '../../prisma'
import { WITH_EXERCISES, type WorkoutWithExercises } from '../workouts/workouts.repository'

/** One exercise the live mode or the form writes, with its sets. */
export interface LoggedExerciseWrite {
	exerciseId: string
	name: string
	kind: ExerciseKind
	muscleGroup: MuscleGroup | null
	position: number
	durationMin: number | null
	distanceM: number | null
	performedAt: Date
	/** The live mode's key of the exercise; null for the form. */
	clientKey: string | null
	templateExerciseId: string | null
	isBodyweight: boolean | null
	sets: {
		position: number
		reps: number | null
		weightKg: number | null
		durationSec: number | null
		distanceM: number | null
		isWarmup: boolean
		doneAt: Date | null
	}[]
}

/**
 * An exercise of the live mode always has its key: the upsert finds it by that. `performedAt` is
 * written on create; an existing row takes `performedAtOnUpdate`, null keeps its own.
 */
export type LiveExerciseWrite = LoggedExerciseWrite & {
	clientKey: string
	performedAtOnUpdate: Date | null
}

/** A finished session of the form, written at once. */
export interface FormWorkoutWrite {
	userId: string
	localDate: Date
	startedAt: Date
	finishedAt: Date
	durationMin: number
	templateId: string | null
	exercises: LoggedExerciseWrite[]
}

const toEntryData = (
	{ userId, localDate }: { userId: string; localDate: Date },
	{ sets, ...exercise }: LoggedExerciseWrite,
) => ({
	...exercise,
	userId,
	localDate,
	source: 'MANUAL' as const,
	sourceMessageId: null,
	sets: { create: sets.map((set) => ({ ...set, userId })) },
})

/**
 * Writes of the live mode and the form. «Live» here is the live mode (source = LIVE), not «not
 * deleted» as in WorkoutsRepository. Every query is scoped by `userId`.
 */
@Injectable()
export class WorkoutLoggingRepository {
	constructor(private readonly prisma: PrismaService) {}

	/** A new open live session; P2002 on `workouts_one_open_live` when the user already has one. */
	createLiveSession(
		data: { userId: string; localDate: Date; startedAt: Date; templateId: string | null },
		tx?: Prisma.TransactionClient,
	): Promise<WorkoutWithExercises> {
		return (tx ?? this.prisma).workout.create({
			data: { ...data, source: 'LIVE' },
			include: WITH_EXERCISES,
		})
	}

	/**
	 * Locks the owner's open live session for a snapshot while it is as the client last saw it
	 * (`editedAt`): false when it is gone, finished or replaced by the chat meanwhile.
	 */
	async lockOpenLive(
		{ userId, id, knownEditedAt }: { userId: string; id: string; knownEditedAt: Date | null },
		tx: Prisma.TransactionClient,
	): Promise<boolean> {
		const { count } = await tx.workout.updateMany({
			where: {
				id,
				userId,
				source: 'LIVE',
				finishedAt: null,
				deletedAt: null,
				editedAt: knownEditedAt,
			},
			data: { updatedAt: new Date() },
		})
		return count > 0
	}

	/** When each live exercise of the session (by its key) happened, for those already written. */
	async findLivePerformedAt(
		{ userId, workoutId, keys }: { userId: string; workoutId: string; keys: string[] },
		tx: Prisma.TransactionClient,
	): Promise<Map<string, Date>> {
		const rows = await tx.exerciseEntry.findMany({
			where: { workoutId, userId, clientKey: { in: keys } },
			select: { clientKey: true, performedAt: true },
		})
		return new Map(
			rows.flatMap(({ clientKey, performedAt }) =>
				clientKey === null ? [] : [[clientKey, performedAt] as const],
			),
		)
	}

	/**
	 * Removes the live mode's exercises (a key, no message behind them) that the snapshot no longer
	 * has: a draft of a session still going on. The chat's exercises stay, and so do rows without a
	 * key (a replaceRef rewrote them; the live mode does not lead them any more).
	 */
	async deleteMissingLiveExercises(
		{ userId, workoutId, keepKeys }: { userId: string; workoutId: string; keepKeys: string[] },
		tx: Prisma.TransactionClient,
	): Promise<void> {
		await tx.exerciseEntry.deleteMany({
			where: {
				workoutId,
				userId,
				sourceMessageId: null,
				clientKey: { not: null, notIn: keepKeys },
			},
		})
	}

	/**
	 * Inserts or rewrites (sets and all) each live exercise by its key in the session; the snapshot is
	 * the truth, so a row soft-deleted meanwhile comes back.
	 */
	async upsertLiveExercises(
		{
			userId,
			workoutId,
			localDate,
			exercises,
		}: { userId: string; workoutId: string; localDate: Date; exercises: LiveExerciseWrite[] },
		tx: Prisma.TransactionClient,
	): Promise<void> {
		for (const { performedAtOnUpdate, ...exercise } of exercises) {
			const { sets, performedAt, ...data } = toEntryData({ userId, localDate }, exercise)
			await tx.exerciseEntry.upsert({
				where: { workoutId_clientKey: { workoutId, clientKey: exercise.clientKey } },
				create: { ...data, performedAt, workoutId, sets },
				update: {
					...data,
					...(performedAtOnUpdate === null ? {} : { performedAt: performedAtOnUpdate }),
					deletedAt: null,
					sets: { deleteMany: {}, ...sets },
				},
			})
		}
	}

	createFormWorkout(
		write: FormWorkoutWrite,
		tx: Prisma.TransactionClient,
	): Promise<WorkoutWithExercises> {
		const { exercises, ...workout } = write
		return tx.workout.create({
			data: {
				...workout,
				source: 'FORM',
				exercises: {
					create: exercises.map((exercise) =>
						toEntryData({ userId: write.userId, localDate: write.localDate }, exercise),
					),
				},
			},
			include: WITH_EXERCISES,
		})
	}

	/** The session whose summary is this message, deleted or not; null when none of the owner's. */
	findByFinishedMessage(
		{ userId, messageId }: { userId: string; messageId: string },
		tx?: Prisma.TransactionClient,
	): Promise<WorkoutWithExercises | null> {
		return (tx ?? this.prisma).workout.findFirst({
			where: { userId, finishedMessageId: messageId },
			include: WITH_EXERCISES,
		})
	}
}
