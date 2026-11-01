import { Injectable } from '@nestjs/common'

import type { Prisma } from '../../generated/prisma/client'
import { PrismaService } from '../../prisma'

/** Versions by the chat card they came from; every read carries the owner's `userId`. */
@Injectable()
export class ProgramProposalsRepository {
	constructor(private readonly prisma: PrismaService) {}

	findVersionsBySourceMessages({ userId, messageIds }: { userId: string; messageIds: string[] }) {
		return this.prisma.programVersion.findMany({
			where: { userId, sourceMessageId: { in: messageIds } },
			select: { id: true, createdAt: true, sourceMessageId: true },
		})
	}

	findVersionBySourceMessage(
		{ userId, messageId }: { userId: string; messageId: string },
		tx?: Prisma.TransactionClient,
	) {
		return (tx ?? this.prisma).programVersion.findFirst({
			where: { userId, sourceMessageId: messageId },
			select: { id: true },
		})
	}
}
