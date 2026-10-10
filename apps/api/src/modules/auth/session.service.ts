import { randomUUID } from 'node:crypto'

import { Injectable, Logger } from '@nestjs/common'

import type { AuthenticatedUser } from '../../common/decorators'
import type { Prisma, Session } from '../../generated/prisma/client'
import { PrismaService } from '../../prisma'
import {
	REFRESH_REUSE_GRACE_MS,
	REFRESH_TOKEN_TTL_MS,
	USER_AGENT_MAX_LENGTH,
} from './auth.constants'
import { RefreshTokenInvalidException, RefreshTokenReusedException } from './auth.exceptions'
import { AuthRepository } from './auth.repository'
import type { ClientMeta, IssuedTokens } from './auth.types'
import { TokenService } from './token.service'

interface StartSessionOptions {
	userId: string
	meta: ClientMeta
	/** Omitted on login (new family); passed on rotation to stay in the same family. */
	tokenFamily?: string
	tx?: Prisma.TransactionClient
}

/** Refresh-token sessions: issuing, rotation with reuse detection, revocation. */
@Injectable()
export class SessionService {
	private readonly logger = new Logger(SessionService.name)

	constructor(
		private readonly prisma: PrismaService,
		private readonly authRepository: AuthRepository,
		private readonly tokenService: TokenService,
	) {}

	async startSession({
		userId,
		meta,
		tokenFamily = randomUUID(),
		tx,
	}: StartSessionOptions): Promise<IssuedTokens> {
		const refreshToken = this.tokenService.generateRefreshToken()
		await this.authRepository.createSession(
			{
				userId,
				tokenFamily,
				refreshTokenHash: this.tokenService.hashRefreshToken(refreshToken),
				expiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_MS),
				userAgent: meta.userAgent?.slice(0, USER_AGENT_MAX_LENGTH) ?? null,
			},
			tx,
		)
		const accessToken = await this.tokenService.signAccessToken({ sub: userId, fam: tokenFamily })
		return { accessToken, refreshToken }
	}

	/**
	 * Rotates the refresh token. A used token coming back means it leaked, so the whole family is
	 * revoked — unless it's a quick replay by the legitimate client (see `reissueWithinGrace`).
	 */
	async refresh(refreshToken: string | null, meta: ClientMeta): Promise<IssuedTokens> {
		if (!refreshToken) throw new RefreshTokenInvalidException()

		const now = new Date()
		const tokenHash = this.tokenService.hashRefreshToken(refreshToken)
		const session = await this.authRepository.findSessionByTokenHash(tokenHash)
		if (!session) throw new RefreshTokenInvalidException()
		// checked before reuse: an old token of an already logged-out family is dead, not an attack
		if (session.revokedAt || (await this.authRepository.hasRevokedSession(session.tokenFamily))) {
			throw new RefreshTokenInvalidException()
		}

		if (session.usedAt) return this.handleUsedToken(session, meta, now)
		if (session.expiresAt <= now) throw new RefreshTokenInvalidException()

		const tokens = await this.prisma.$transaction(async (tx) => {
			const claimed = await this.authRepository.markSessionUsed(session.id, now, tx)
			if (claimed === 0) return null
			return this.startSession({
				userId: session.userId,
				meta,
				tokenFamily: session.tokenFamily,
				tx,
			})
		})
		if (tokens) return tokens

		// a parallel refresh with the same token won; it has committed by now, so re-read the row
		const claimedSession = await this.authRepository.findSessionByTokenHash(tokenHash)
		if (!claimedSession?.usedAt) throw new RefreshTokenInvalidException()
		return this.handleUsedToken(claimedSession, meta, now)
	}

	/** Revokes the current login session. Idempotent: a missing or unknown token is not an error. */
	async logout(refreshToken: string | null): Promise<void> {
		if (!refreshToken) return

		const session = await this.authRepository.findSessionByTokenHash(
			this.tokenService.hashRefreshToken(refreshToken),
		)
		if (!session) return

		await this.authRepository.revokeFamily(session.tokenFamily, new Date())
		this.logger.log(`Logout userId=${session.userId}`)
	}

	async logoutAll(userId: string, tx?: Prisma.TransactionClient): Promise<void> {
		const revoked = await this.authRepository.revokeAllForUser(userId, new Date(), tx)
		this.logger.log(`Logout from all sessions userId=${userId} revoked=${revoked}`)
	}

	/** After a password change: every device but the one that changed it. */
	async logoutOthers(
		{ sub, fam }: AuthenticatedUser,
		tx?: Prisma.TransactionClient,
	): Promise<void> {
		const revoked = await this.authRepository.revokeAllForUserExceptFamily(
			{ userId: sub, tokenFamily: fam, revokedAt: new Date() },
			tx,
		)
		this.logger.log(`Logout from other sessions userId=${sub} revoked=${revoked}`)
	}

	/**
	 * Lets logout-all and reuse detection cut off access tokens at once, not after their TTL.
	 * Revocation always covers a whole family, so one revoked row means the family is dead — this
	 * also kills a row a parallel rotation committed just after the revoking UPDATE ran.
	 */
	async isSessionActive({ sub, fam }: AuthenticatedUser): Promise<boolean> {
		const [currentCount, hasRevoked] = await Promise.all([
			this.authRepository.countCurrentSessions({ userId: sub, tokenFamily: fam, now: new Date() }),
			this.authRepository.hasRevokedSession(fam),
		])
		return currentCount > 0 && !hasRevoked
	}

	private async handleUsedToken(
		session: Session,
		meta: ClientMeta,
		now: Date,
	): Promise<IssuedTokens> {
		const tokens = await this.reissueWithinGrace(session, meta, now)
		if (tokens) return tokens

		await this.authRepository.revokeFamily(session.tokenFamily, now)
		this.logger.warn(
			`Refresh token reuse detected, session family revoked userId=${session.userId}`,
		)
		throw new RefreshTokenReusedException()
	}

	/**
	 * A replay of the just-used token is the legitimate client, not a thief, when the rotation
	 * response got lost on a flaky network or two contexts (PWA + Safari tab) share the cookie.
	 * Allowed once per rotation: within the grace window, while its successor is still unused and
	 * is the family's only current session. The successor's token can't be returned again (only its
	 * hash is stored), so a sibling pair is issued in the same family.
	 */
	private async reissueWithinGrace(
		session: Session,
		meta: ClientMeta,
		now: Date,
	): Promise<IssuedTokens | null> {
		const { usedAt, tokenFamily, userId } = session
		if (!usedAt || now.getTime() - usedAt.getTime() > REFRESH_REUSE_GRACE_MS) return null

		const tokens = await this.prisma.$transaction(async (tx) => {
			// serializes parallel replays: without it both would see one current session and both reissue
			await this.authRepository.lockFamily(tokenFamily, tx)
			const currentCount = await this.authRepository.countCurrentSessions(
				{ userId, tokenFamily, now },
				tx,
			)
			if (currentCount !== 1) return null
			if (await this.authRepository.hasSessionUsedAfter({ tokenFamily, usedAt }, tx)) return null
			return this.startSession({ userId, meta, tokenFamily, tx })
		})

		if (tokens) this.logger.log(`Refresh token replayed within grace window userId=${userId}`)
		return tokens
	}
}
