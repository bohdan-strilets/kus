import { Injectable } from '@nestjs/common'

import type { Achievement, AchievementType, Prisma } from '../../generated/prisma/client'
import { PrismaService } from '../../prisma'

@Injectable()
export class AchievementsRepository {
	constructor(private readonly prisma: PrismaService) {}

	/**
	 * Inserts the thresholds the user does not have yet and returns only those rows: ON CONFLICT DO
	 * NOTHING RETURNING, so of two parallel turns only the one whose insert landed sees an event.
	 */
	createMissing(
		{
			userId,
			type,
			values,
			achievedAt,
		}: { userId: string; type: AchievementType; values: number[]; achievedAt: Date },
		tx: Prisma.TransactionClient,
	): Promise<Achievement[]> {
		return tx.achievement.createManyAndReturn({
			data: values.map((value) => ({ userId, type, value, achievedAt })),
			skipDuplicates: true,
		})
	}

	/** The reply that announces the achievement; the silent ones keep no message. */
	async attachToMessage(
		{ userId, id, messageId }: { userId: string; id: string; messageId: string },
		tx: Prisma.TransactionClient,
	): Promise<void> {
		await tx.achievement.updateMany({ where: { id, userId }, data: { messageId } })
	}

	findByMessageIds({
		userId,
		messageIds,
	}: {
		userId: string
		messageIds: string[]
	}): Promise<Achievement[]> {
		return this.prisma.achievement.findMany({
			where: { userId, messageId: { in: messageIds } },
			orderBy: [{ type: 'asc' }, { value: 'asc' }],
		})
	}
}
