import { JwtService } from '@nestjs/jwt'
import { vi } from 'vitest'

import type { Session } from '../../generated/prisma/client'
import type { PrismaService } from '../../prisma'
import type { AuthRepository } from './auth.repository'
import { SessionService } from './session.service'
import { TokenService } from './token.service'

export const USER_ID = '01999a00-0000-7000-8000-000000000001'
export const FAMILY = '01999a00-0000-7000-8000-0000000000f1'
export const META = { userAgent: 'vitest' }

export const tokenService = new TokenService(
	new JwtService({ secret: 'unit-test-secret-at-least-32-characters' }),
)

export const createSessionRow = (overrides: Partial<Session> = {}): Session => ({
	id: '01999a00-0000-7000-8000-0000000000a1',
	userId: USER_ID,
	refreshTokenHash: 'hash',
	tokenFamily: FAMILY,
	expiresAt: new Date(Date.now() + 60_000),
	usedAt: null,
	revokedAt: null,
	userAgent: null,
	createdAt: new Date(),
	...overrides,
})

/** Repository mock with "happy path" defaults; tests override what they exercise. */
export const createAuthRepositoryMock = () => ({
	createCredentials: vi.fn(),
	findCredentials: vi.fn<AuthRepository['findCredentials']>(),
	reserveLoginAttempt: vi.fn<AuthRepository['reserveLoginAttempt']>().mockResolvedValue(true),
	lockIfAttemptsExhausted: vi
		.fn<AuthRepository['lockIfAttemptsExhausted']>()
		.mockResolvedValue(false),
	resetFailedAttempts: vi.fn(),
	createSession: vi.fn(),
	findSessionByTokenHash: vi.fn<AuthRepository['findSessionByTokenHash']>(),
	markSessionUsed: vi.fn<AuthRepository['markSessionUsed']>(),
	revokeFamily: vi.fn(),
	revokeAllForUser: vi.fn(),
	countCurrentSessions: vi.fn<AuthRepository['countCurrentSessions']>().mockResolvedValue(1),
	hasRevokedSession: vi.fn<AuthRepository['hasRevokedSession']>().mockResolvedValue(false),
	hasSessionUsedAfter: vi.fn<AuthRepository['hasSessionUsedAfter']>().mockResolvedValue(false),
	lockFamily: vi.fn(),
})

export type AuthRepositoryMock = ReturnType<typeof createAuthRepositoryMock>

/** Runs interactive-transaction callbacks inline, with an empty stand-in for the tx client. */
export const createPrismaMock = (): PrismaService =>
	({
		$transaction: vi.fn((callback: (client: unknown) => Promise<unknown>) => callback({})),
	}) as unknown as PrismaService

export const createSessionService = (authRepository: AuthRepositoryMock): SessionService =>
	new SessionService(createPrismaMock(), authRepository as unknown as AuthRepository, tokenService)
