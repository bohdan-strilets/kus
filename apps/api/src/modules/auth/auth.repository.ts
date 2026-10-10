import { Injectable } from '@nestjs/common'

import type { AuthCredentials, Prisma, Session } from '../../generated/prisma/client'
import { PrismaService } from '../../prisma'

export interface CreateSessionData {
	userId: string
	tokenFamily: string
	refreshTokenHash: string
	expiresAt: Date
	userAgent: string | null
}

@Injectable()
export class AuthRepository {
	constructor(private readonly prisma: PrismaService) {}

	createCredentials(
		data: { userId: string; passwordHash: string },
		tx?: Prisma.TransactionClient,
	): Promise<AuthCredentials> {
		return (tx ?? this.prisma).authCredentials.create({ data })
	}

	findCredentials(userId: string, tx?: Prisma.TransactionClient): Promise<AuthCredentials | null> {
		return (tx ?? this.prisma).authCredentials.findUnique({ where: { userId } })
	}

	/**
	 * Counts an attempt *before* the password check, in one conditional UPDATE: parallel requests
	 * can't all slip past the lock check, and at most `maxAttempts` checks run per lock window.
	 * `false` = locked, or the attempt budget is used up.
	 */
	async reserveLoginAttempt(
		{ userId, maxAttempts, now }: { userId: string; maxAttempts: number; now: Date },
		tx?: Prisma.TransactionClient,
	): Promise<boolean> {
		const { count } = await (tx ?? this.prisma).authCredentials.updateMany({
			where: {
				userId,
				failedLoginAttempts: { lt: maxAttempts },
				OR: [{ lockedUntil: null }, { lockedUntil: { lte: now } }],
			},
			data: { failedLoginAttempts: { increment: 1 } },
		})
		return count === 1
	}

	/** Conditional, so of several failures hitting the limit at once only one sets the lock. */
	async lockIfAttemptsExhausted(
		{
			userId,
			maxAttempts,
			lockedUntil,
		}: { userId: string; maxAttempts: number; lockedUntil: Date },
		tx?: Prisma.TransactionClient,
	): Promise<boolean> {
		const { count } = await (tx ?? this.prisma).authCredentials.updateMany({
			where: { userId, failedLoginAttempts: { gte: maxAttempts } },
			data: { lockedUntil, failedLoginAttempts: 0 },
		})
		return count === 1
	}

	resetFailedAttempts(userId: string, tx?: Prisma.TransactionClient): Promise<AuthCredentials> {
		return (tx ?? this.prisma).authCredentials.update({
			where: { userId },
			data: { failedLoginAttempts: 0, lockedUntil: null },
		})
	}

	updatePassword(
		{ userId, passwordHash, changedAt }: { userId: string; passwordHash: string; changedAt: Date },
		tx?: Prisma.TransactionClient,
	): Promise<AuthCredentials> {
		return (tx ?? this.prisma).authCredentials.update({
			where: { userId },
			data: { passwordHash, passwordChangedAt: changedAt },
		})
	}

	createSession(data: CreateSessionData, tx?: Prisma.TransactionClient): Promise<Session> {
		return (tx ?? this.prisma).session.create({ data })
	}

	findSessionByTokenHash(
		refreshTokenHash: string,
		tx?: Prisma.TransactionClient,
	): Promise<Session | null> {
		return (tx ?? this.prisma).session.findUnique({ where: { refreshTokenHash } })
	}

	/**
	 * Claims an unused session for rotation. Conditional update, so of two parallel refreshes with
	 * the same token only one gets `1`; the other gets `0`.
	 */
	async markSessionUsed(id: string, usedAt: Date, tx?: Prisma.TransactionClient): Promise<number> {
		const { count } = await (tx ?? this.prisma).session.updateMany({
			where: { id, usedAt: null, revokedAt: null },
			data: { usedAt },
		})
		return count
	}

	async revokeFamily(
		tokenFamily: string,
		revokedAt: Date,
		tx?: Prisma.TransactionClient,
	): Promise<number> {
		const { count } = await (tx ?? this.prisma).session.updateMany({
			where: { tokenFamily, revokedAt: null },
			data: { revokedAt },
		})
		return count
	}

	async revokeAllForUser(
		userId: string,
		revokedAt: Date,
		tx?: Prisma.TransactionClient,
	): Promise<number> {
		const { count } = await (tx ?? this.prisma).session.updateMany({
			where: { userId, revokedAt: null },
			data: { revokedAt },
		})
		return count
	}

	/** Every other device: all families of the user but the one making the request. */
	async revokeAllForUserExceptFamily(
		{ userId, tokenFamily, revokedAt }: { userId: string; tokenFamily: string; revokedAt: Date },
		tx?: Prisma.TransactionClient,
	): Promise<number> {
		const { count } = await (tx ?? this.prisma).session.updateMany({
			where: { userId, tokenFamily: { not: tokenFamily }, revokedAt: null },
			data: { revokedAt },
		})
		return count
	}

	/** Unused, unrevoked, unexpired rows of the family — normally one, two after a grace reissue. */
	countCurrentSessions(
		{ userId, tokenFamily, now }: { userId: string; tokenFamily: string; now: Date },
		tx?: Prisma.TransactionClient,
	): Promise<number> {
		return (tx ?? this.prisma).session.count({
			where: { userId, tokenFamily, usedAt: null, revokedAt: null, expiresAt: { gt: now } },
		})
	}

	/** Some row of the family was rotated after `usedAt`, i.e. the successor was already used. */
	async hasSessionUsedAfter(
		{ tokenFamily, usedAt }: { tokenFamily: string; usedAt: Date },
		tx?: Prisma.TransactionClient,
	): Promise<boolean> {
		const session = await (tx ?? this.prisma).session.findFirst({
			where: { tokenFamily, usedAt: { gt: usedAt } },
			select: { id: true },
		})
		return session !== null
	}

	/** Transaction-scoped advisory lock on a family; released on commit or rollback. */
	async lockFamily(tokenFamily: string, tx: Prisma.TransactionClient): Promise<void> {
		// parameterized; hashtextextended maps the uuid to the bigint key the lock needs
		// (selected as 1: the function itself returns `void`, which the driver can't deserialize)
		await tx.$queryRaw`SELECT 1 FROM pg_advisory_xact_lock(hashtextextended(${tokenFamily}::text, 0))`
	}

	async hasRevokedSession(tokenFamily: string, tx?: Prisma.TransactionClient): Promise<boolean> {
		const session = await (tx ?? this.prisma).session.findFirst({
			where: { tokenFamily, revokedAt: { not: null } },
			select: { id: true },
		})
		return session !== null
	}
}
