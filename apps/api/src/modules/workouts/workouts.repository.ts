import { Injectable } from '@nestjs/common'

import type { Prisma } from '../../generated/prisma/client'
import { PrismaService } from '../../prisma'

/** A workout with its live exercises and their sets, in the order they were done. */
const WITH_EXERCISES = {
	exercises: {
		where: { deletedAt: null },
		orderBy: { position: 'asc' },
		include: { sets: { orderBy: { position: 'asc' } } },
	},
} satisfies Prisma.WorkoutInclude

export type WorkoutWithExercises = Prisma.WorkoutGetPayload<{ include: typeof WITH_EXERCISES }>

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
}
