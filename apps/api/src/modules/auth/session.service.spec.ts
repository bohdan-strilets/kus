import { Logger } from '@nestjs/common'
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest'

import { ErrorCodes } from '../../common/exceptions'
import { REFRESH_REUSE_GRACE_MS } from './auth.constants'
import {
	type AuthRepositoryMock,
	createAuthRepositoryMock,
	createSessionRow,
	createSessionService,
	FAMILY,
	META,
	USER_ID,
} from './auth.test-utils'
import type { SessionService } from './session.service'

const secondsAgo = (seconds: number): Date => new Date(Date.now() - seconds * 1000)
const GRACE_SECONDS = REFRESH_REUSE_GRACE_MS / 1000

describe('SessionService', () => {
	let repo: AuthRepositoryMock
	let service: SessionService
	const logSpy = vi.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined)
	const warnSpy = vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined)

	beforeEach(() => {
		repo = createAuthRepositoryMock()
		service = createSessionService(repo)
		warnSpy.mockClear()
	})

	afterAll(() => {
		logSpy.mockRestore()
		warnSpy.mockRestore()
	})

	describe('refresh', () => {
		it('rotates the token within the same family', async () => {
			repo.findSessionByTokenHash.mockResolvedValue(createSessionRow())
			repo.markSessionUsed.mockResolvedValue(1)

			const tokens = await service.refresh('old-refresh-token', META)

			expect(tokens.refreshToken).not.toBe('old-refresh-token')
			const [session] = repo.createSession.mock.lastCall as [{ tokenFamily: string }]
			expect(session.tokenFamily).toBe(FAMILY)
			expect(repo.revokeFamily).not.toHaveBeenCalled()
		})

		it('revokes the whole family when a used token comes back after the grace window', async () => {
			repo.findSessionByTokenHash.mockResolvedValue(
				createSessionRow({ usedAt: secondsAgo(GRACE_SECONDS + 1) }),
			)

			await expect(service.refresh('stolen-token', META)).rejects.toMatchObject({
				errorCode: ErrorCodes.REFRESH_TOKEN_REUSED,
			})
			expect(repo.revokeFamily).toHaveBeenCalledWith(FAMILY, expect.any(Date))
			expect(repo.createSession).not.toHaveBeenCalled()
			expect(warnSpy).toHaveBeenCalledOnce()
		})

		it('reissues in the same family for a replay within the grace window', async () => {
			repo.findSessionByTokenHash.mockResolvedValue(createSessionRow({ usedAt: secondsAgo(5) }))

			const tokens = await service.refresh('replayed-token', META)

			expect(tokens.refreshToken).toBeTruthy()
			expect(repo.lockFamily).toHaveBeenCalledWith(FAMILY, expect.anything())
			const [session] = repo.createSession.mock.lastCall as [{ tokenFamily: string }]
			expect(session.tokenFamily).toBe(FAMILY)
			expect(repo.revokeFamily).not.toHaveBeenCalled()
			expect(warnSpy).not.toHaveBeenCalled()
		})

		it('treats a replay as reuse once the successor has been used', async () => {
			repo.findSessionByTokenHash.mockResolvedValue(createSessionRow({ usedAt: secondsAgo(5) }))
			repo.hasSessionUsedAfter.mockResolvedValue(true)

			await expect(service.refresh('replayed-token', META)).rejects.toMatchObject({
				errorCode: ErrorCodes.REFRESH_TOKEN_REUSED,
			})
			expect(repo.revokeFamily).toHaveBeenCalledWith(FAMILY, expect.any(Date))
		})

		it('allows only one grace reissue per rotation', async () => {
			repo.findSessionByTokenHash.mockResolvedValue(createSessionRow({ usedAt: secondsAgo(5) }))
			// the first replay already added a sibling: two current sessions now
			repo.countCurrentSessions.mockResolvedValue(2)

			await expect(service.refresh('replayed-again', META)).rejects.toMatchObject({
				errorCode: ErrorCodes.REFRESH_TOKEN_REUSED,
			})
			expect(repo.revokeFamily).toHaveBeenCalledWith(FAMILY, expect.any(Date))
		})

		it('lets the loser of a parallel rotation through the grace path', async () => {
			repo.findSessionByTokenHash
				.mockResolvedValueOnce(createSessionRow())
				.mockResolvedValueOnce(createSessionRow({ usedAt: new Date() }))
			repo.markSessionUsed.mockResolvedValue(0)

			const tokens = await service.refresh('raced-token', META)

			expect(tokens.refreshToken).toBeTruthy()
			expect(repo.lockFamily).toHaveBeenCalledWith(FAMILY, expect.anything())
			expect(repo.revokeFamily).not.toHaveBeenCalled()
		})

		it('rejects an expired or revoked session without revoking the family', async () => {
			repo.findSessionByTokenHash.mockResolvedValue(createSessionRow({ expiresAt: secondsAgo(1) }))
			await expect(service.refresh('expired', META)).rejects.toMatchObject({
				errorCode: ErrorCodes.REFRESH_TOKEN_INVALID,
			})

			repo.findSessionByTokenHash.mockResolvedValue(createSessionRow({ revokedAt: new Date() }))
			await expect(service.refresh('revoked', META)).rejects.toMatchObject({
				errorCode: ErrorCodes.REFRESH_TOKEN_INVALID,
			})
			expect(repo.revokeFamily).not.toHaveBeenCalled()
		})

		it('rejects an old token of an already revoked family as invalid, not as reuse', async () => {
			repo.findSessionByTokenHash.mockResolvedValue(
				createSessionRow({ usedAt: secondsAgo(GRACE_SECONDS + 1) }),
			)
			repo.hasRevokedSession.mockResolvedValue(true)

			await expect(service.refresh('logged-out-tab', META)).rejects.toMatchObject({
				errorCode: ErrorCodes.REFRESH_TOKEN_INVALID,
			})
			expect(repo.revokeFamily).not.toHaveBeenCalled()
		})

		it('rejects a missing or unknown token', async () => {
			await expect(service.refresh(null, META)).rejects.toMatchObject({
				errorCode: ErrorCodes.REFRESH_TOKEN_INVALID,
			})

			repo.findSessionByTokenHash.mockResolvedValue(null)
			await expect(service.refresh('unknown', META)).rejects.toMatchObject({
				errorCode: ErrorCodes.REFRESH_TOKEN_INVALID,
			})
		})
	})

	describe('isSessionActive', () => {
		const accessUser = { sub: USER_ID, fam: FAMILY }

		it('accepts a family with a current session and no revoked rows', async () => {
			await expect(service.isSessionActive(accessUser)).resolves.toBe(true)
		})

		it('rejects a family with any revoked row, even if a current row survived', async () => {
			repo.hasRevokedSession.mockResolvedValue(true)

			await expect(service.isSessionActive(accessUser)).resolves.toBe(false)
		})

		it('rejects a family without a current session', async () => {
			repo.countCurrentSessions.mockResolvedValue(0)

			await expect(service.isSessionActive(accessUser)).resolves.toBe(false)
		})
	})
})
