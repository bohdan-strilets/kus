import { Injectable } from '@nestjs/common'

import type { Prisma } from '../../generated/prisma/client'
import type { ExerciseKind, MuscleGroup } from '../../generated/prisma/enums'
import { PrismaService } from '../../prisma'

const STATS_ENTRY_INCLUDE = {
	sets: { orderBy: { position: 'asc' } },
	exercise: { select: { name: true, muscleGroup: true } },
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

/**
 * Reads for the training statistics. An entry counts by its workout: a deleted workout leaves its
 * entries live, and the workout's day is the truth (an entry's own day is only a copy).
 */
@Injectable()
export class WorkoutStatsRepository {
	constructor(private readonly prisma: PrismaService) {}

	findWorkoutsInRange(
		{ userId, from, to }: { userId: string; from: Date; to: Date },
		tx?: Prisma.TransactionClient,
	): Promise<StatsWorkoutRecord[]> {
		return (tx ?? this.prisma).workout.findMany({
			where: { userId, deletedAt: null, localDate: { gte: from, lte: to } },
			select: STATS_WORKOUT_SELECT,
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
				workout: { userId, deletedAt: null, localDate: { gte: from, lte: to } },
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
				workout: { userId, deletedAt: null },
			},
			include: STATS_ENTRY_INCLUDE,
		})
	}

	findEntriesOfExercise(
		{ userId, exerciseId }: { userId: string; exerciseId: string },
		tx?: Prisma.TransactionClient,
	): Promise<StatsEntryRecord[]> {
		return (tx ?? this.prisma).exerciseEntry.findMany({
			where: { userId, deletedAt: null, exerciseId, workout: { userId, deletedAt: null } },
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
