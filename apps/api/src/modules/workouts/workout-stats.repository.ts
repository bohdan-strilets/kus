import { Injectable } from '@nestjs/common'

import type { Prisma } from '../../generated/prisma/client'
import type { ExerciseKind, MuscleGroup } from '../../generated/prisma/enums'
import { PrismaService } from '../../prisma'
import { HIDE_OPEN_LIVE } from './workout-visibility'

const STATS_ENTRY_INCLUDE = {
	sets: { orderBy: { position: 'asc' } },
	exercise: { select: { name: true, muscleGroup: true, isBodyweight: true } },
	workout: { select: { id: true, localDate: true } },
} satisfies Prisma.ExerciseEntryInclude

export type StatsEntryRecord = Prisma.ExerciseEntryGetPayload<{
	include: typeof STATS_ENTRY_INCLUDE
}>

const STATS_WORKOUT_SELECT = {
	id: true,
	localDate: true,
	durationMin: true,
	kcalBurned: true,
	kcalSource: true,
	finishedAt: true,
	finishedMessageId: true,
	records: true,
	template: { select: { name: true } },
	exercises: {
		where: { deletedAt: null },
		select: { performedAt: true, sourceMessageId: true },
	},
} satisfies Prisma.WorkoutSelect

export type StatsWorkoutRecord = Prisma.WorkoutGetPayload<{ select: typeof STATS_WORKOUT_SELECT }>

export interface StatsExerciseRecord {
	id: string
	name: string
	kind: ExerciseKind
	muscleGroup: MuscleGroup | null
}

/** An exercise of the user's dictionary, as the model's search needs it. */
export interface StatsExerciseName {
	id: string
	name: string
	aliases: string[]
}

/** The very first counted workout and how many there are, over all time. */
export interface StatsAllTimeSummary {
	firstDate: Date | null
	total: number
}

/**
 * Reads for the training statistics. An entry counts by its workout: a deleted workout leaves its
 * entries live, and the workout's day is the truth (an entry's own day is only a copy). An open
 * live session counts once it is finished.
 */
@Injectable()
export class WorkoutStatsRepository {
	constructor(private readonly prisma: PrismaService) {}

	findWorkoutsInRange(
		{ userId, from, to }: { userId: string; from: Date; to: Date },
		tx?: Prisma.TransactionClient,
	): Promise<StatsWorkoutRecord[]> {
		return (tx ?? this.prisma).workout.findMany({
			where: { userId, deletedAt: null, localDate: { gte: from, lte: to }, ...HIDE_OPEN_LIVE },
			select: STATS_WORKOUT_SELECT,
		})
	}

	/** The day of the user's very first counted workout; null without any. */
	async findFirstWorkoutDate(
		{ userId }: { userId: string },
		tx?: Prisma.TransactionClient,
	): Promise<Date | null> {
		const result = await (tx ?? this.prisma).workout.aggregate({
			where: { userId, deletedAt: null, ...HIDE_OPEN_LIVE },
			_min: { localDate: true },
		})
		return result._min.localDate
	}

	/** The first day and the number of the user's counted workouts over all time. */
	async findAllTimeSummary(
		{ userId }: { userId: string },
		tx?: Prisma.TransactionClient,
	): Promise<StatsAllTimeSummary> {
		const result = await (tx ?? this.prisma).workout.aggregate({
			where: { userId, deletedAt: null, ...HIDE_OPEN_LIVE },
			_min: { localDate: true },
			_count: { _all: true },
		})
		return { firstDate: result._min.localDate, total: result._count._all }
	}

	/** Whether a live session of the user is still going on (it is not counted in the statistics). */
	async hasOpenLiveSession(
		{ userId }: { userId: string },
		tx?: Prisma.TransactionClient,
	): Promise<boolean> {
		const open = await (tx ?? this.prisma).workout.findFirst({
			where: { userId, deletedAt: null, source: 'LIVE', finishedAt: null },
			select: { id: true },
		})
		return open !== null
	}

	/** The user's live exercises, the most recently changed first. */
	findExercisesOfUser(
		{ userId }: { userId: string },
		tx?: Prisma.TransactionClient,
	): Promise<StatsExerciseName[]> {
		return (tx ?? this.prisma).exercise.findMany({
			where: { userId, deletedAt: null },
			select: { id: true, name: true, aliases: true },
			orderBy: { updatedAt: 'desc' },
		})
	}

	findEntriesInRange(
		{ userId, from, to }: { userId: string; from: Date; to: Date },
		tx?: Prisma.TransactionClient,
	): Promise<StatsEntryRecord[]> {
		return (tx ?? this.prisma).exerciseEntry.findMany({
			where: {
				userId,
				deletedAt: null,
				workout: {
					userId,
					deletedAt: null,
					localDate: { gte: from, lte: to },
					...HIDE_OPEN_LIVE,
				},
			},
			include: STATS_ENTRY_INCLUDE,
		})
	}

	/** Strength entries of the given exercises over all time. */
	findStrengthEntriesOfExercises(
		{ userId, exerciseIds }: { userId: string; exerciseIds: string[] },
		tx?: Prisma.TransactionClient,
	): Promise<StatsEntryRecord[]> {
		if (exerciseIds.length === 0) return Promise.resolve([])
		return (tx ?? this.prisma).exerciseEntry.findMany({
			where: {
				userId,
				deletedAt: null,
				kind: 'STRENGTH',
				exerciseId: { in: exerciseIds },
				workout: { userId, deletedAt: null, ...HIDE_OPEN_LIVE },
			},
			include: STATS_ENTRY_INCLUDE,
		})
	}

	findEntriesOfExercise(
		{ userId, exerciseId }: { userId: string; exerciseId: string },
		tx?: Prisma.TransactionClient,
	): Promise<StatsEntryRecord[]> {
		return (tx ?? this.prisma).exerciseEntry.findMany({
			where: {
				userId,
				deletedAt: null,
				exerciseId,
				workout: { userId, deletedAt: null, ...HIDE_OPEN_LIVE },
			},
			include: STATS_ENTRY_INCLUDE,
		})
	}

	findExercise(
		{ userId, id }: { userId: string; id: string },
		tx?: Prisma.TransactionClient,
	): Promise<StatsExerciseRecord | null> {
		return (tx ?? this.prisma).exercise.findFirst({
			where: { id, userId, deletedAt: null },
			select: { id: true, name: true, kind: true, muscleGroup: true },
		})
	}
}
