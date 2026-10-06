import { Logger } from '@nestjs/common'
import type { AuthUser } from '@kus/shared'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

import { ErrorCodes } from '../../common/exceptions'
import type { AuthCredentials } from '../../generated/prisma/client'
import type { UsersService } from '../users/users.service'
import { LOGIN_LOCK_DURATION_MS, MAX_FAILED_LOGIN_ATTEMPTS } from './auth.constants'
import type { AuthRepository } from './auth.repository'
import { AuthService } from './auth.service'
import {
	createAuthRepositoryMock,
	createPrismaMock,
	createSessionService,
	META,
	tokenService,
	USER_ID,
} from './auth.test-utils'
import { PasswordService } from './password.service'

const PASSWORD = 'correct-horse-battery'

const user: AuthUser = {
	id: USER_ID,
	email: 'me@kus.app',
	name: 'Me',
	locale: 'uk',
	timezone: 'Europe/Warsaw',
	createdAt: '2026-10-01T00:00:00.000Z',
}

const passwordService = new PasswordService()
// hashing with argon2 is slow on purpose; one real hash is enough for every test
const passwordHashPromise = passwordService.hash(PASSWORD)

const createCredentials = async (
	overrides: Partial<AuthCredentials> = {},
): Promise<AuthCredentials> => ({
	userId: USER_ID,
	passwordHash: await passwordHashPromise,
	failedLoginAttempts: 0,
	lockedUntil: null,
	passwordChangedAt: new Date(),
	createdAt: new Date(),
	updatedAt: new Date(),
	...overrides,
})

const createMocks = () => {
	const authRepository = createAuthRepositoryMock()
	const usersService = {
		createUser: vi.fn<UsersService['createUser']>(),
		findByEmail: vi.fn<UsersService['findByEmail']>(),
	}
	const service = new AuthService(
		createPrismaMock(),
		authRepository as unknown as AuthRepository,
		usersService as unknown as UsersService,
		passwordService,
		createSessionService(authRepository),
	)
	return { service, authRepository, usersService }
}

describe('AuthService', () => {
	let mocks: ReturnType<typeof createMocks>
	const logSpies = [
		vi.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined),
		vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined),
	]

	beforeAll(async () => {
		await passwordService.onModuleInit()
	})

	beforeEach(() => {
		mocks = createMocks()
	})

	afterAll(() => {
		for (const spy of logSpies) spy.mockRestore()
	})

	describe('register', () => {
		it('creates the user with hashed credentials and starts a session', async () => {
			mocks.usersService.findByEmail.mockResolvedValue(null)
			mocks.usersService.createUser.mockResolvedValue(user)

			const result = await mocks.service.register(
				{ email: user.email, password: PASSWORD, name: 'Me' },
				META,
			)

			expect(result.user).toEqual(user)
			const [{ passwordHash }] = mocks.authRepository.createCredentials.mock.lastCall as [
				{ passwordHash: string },
			]
			expect(passwordHash).toMatch(/^\$argon2id\$/)
			expect(passwordHash).not.toContain(PASSWORD)
			const [session] = mocks.authRepository.createSession.mock.lastCall as [
				{ refreshTokenHash: string },
			]
			expect(session.refreshTokenHash).toBe(
				tokenService.hashRefreshToken(result.tokens.refreshToken),
			)
		})

		it('rejects a taken email', async () => {
			mocks.usersService.findByEmail.mockResolvedValue(user)

			await expect(
				mocks.service.register({ email: user.email, password: PASSWORD, name: 'Me' }, META),
			).rejects.toMatchObject({ errorCode: ErrorCodes.EMAIL_TAKEN })
			expect(mocks.usersService.createUser).not.toHaveBeenCalled()
		})
	})

	describe('login', () => {
		it('issues tokens for valid credentials and resets the failure counter', async () => {
			mocks.usersService.findByEmail.mockResolvedValue(user)
			mocks.authRepository.findCredentials.mockResolvedValue(
				await createCredentials({ failedLoginAttempts: 2 }),
			)

			const result = await mocks.service.login({ email: user.email, password: PASSWORD }, META)

			expect(result.user.id).toBe(USER_ID)
			expect(mocks.authRepository.reserveLoginAttempt).toHaveBeenCalledWith(
				expect.objectContaining({ userId: USER_ID, maxAttempts: MAX_FAILED_LOGIN_ATTEMPTS }),
			)
			expect(mocks.authRepository.resetFailedAttempts).toHaveBeenCalledWith(USER_ID)
			const payload = await tokenService.verifyAccessToken(result.tokens.accessToken)
			expect(payload?.sub).toBe(USER_ID)
		})

		it('answers the same for an unknown email and a wrong password', async () => {
			mocks.usersService.findByEmail.mockResolvedValue(null)
			const unknown = mocks.service.login({ email: 'nobody@kus.app', password: PASSWORD }, META)
			await expect(unknown).rejects.toMatchObject({ errorCode: ErrorCodes.INVALID_CREDENTIALS })

			mocks.usersService.findByEmail.mockResolvedValue(user)
			mocks.authRepository.findCredentials.mockResolvedValue(await createCredentials())
			const wrong = mocks.service.login({ email: user.email, password: 'wrong-password' }, META)
			await expect(wrong).rejects.toMatchObject({ errorCode: ErrorCodes.INVALID_CREDENTIALS })
			expect(mocks.authRepository.resetFailedAttempts).not.toHaveBeenCalled()
		})

		it(`locks the account once ${MAX_FAILED_LOGIN_ATTEMPTS} attempts have failed`, async () => {
			mocks.usersService.findByEmail.mockResolvedValue(user)
			mocks.authRepository.findCredentials.mockResolvedValue(await createCredentials())
			mocks.authRepository.lockIfAttemptsExhausted.mockResolvedValue(true)
			const before = Date.now()

			await expect(
				mocks.service.login({ email: user.email, password: 'wrong-password' }, META),
			).rejects.toMatchObject({ errorCode: ErrorCodes.INVALID_CREDENTIALS })

			const lockCall = mocks.authRepository.lockIfAttemptsExhausted.mock.lastCall
			if (!lockCall) throw new Error('lockIfAttemptsExhausted was not called')
			const [{ maxAttempts, lockedUntil }] = lockCall
			expect(maxAttempts).toBe(MAX_FAILED_LOGIN_ATTEMPTS)
			expect(lockedUntil.getTime()).toBeGreaterThanOrEqual(before + LOGIN_LOCK_DURATION_MS)
		})

		it('rejects even the correct password when no attempt can be reserved', async () => {
			const lockedUntil = new Date(Date.now() + LOGIN_LOCK_DURATION_MS)
			mocks.usersService.findByEmail.mockResolvedValue(user)
			mocks.authRepository.findCredentials.mockResolvedValue(
				await createCredentials({ lockedUntil }),
			)
			mocks.authRepository.reserveLoginAttempt.mockResolvedValue(false)
			const verify = vi.spyOn(passwordService, 'verify')

			await expect(
				mocks.service.login({ email: user.email, password: PASSWORD }, META),
			).rejects.toMatchObject({
				errorCode: ErrorCodes.ACCOUNT_LOCKED,
				details: { lockedUntil: lockedUntil.toISOString() },
			})
			// no password check at all while locked: that's what caps brute force
			expect(verify).not.toHaveBeenCalled()
			expect(mocks.authRepository.createSession).not.toHaveBeenCalled()
			verify.mockRestore()
		})

		it('still answers 423 when the attempt budget is used up by requests in flight', async () => {
			mocks.usersService.findByEmail.mockResolvedValue(user)
			mocks.authRepository.findCredentials.mockResolvedValue(
				await createCredentials({ failedLoginAttempts: MAX_FAILED_LOGIN_ATTEMPTS }),
			)
			mocks.authRepository.reserveLoginAttempt.mockResolvedValue(false)
			const before = Date.now()

			const error: unknown = await mocks.service
				.login({ email: user.email, password: PASSWORD }, META)
				.catch((rejection: unknown) => rejection)

			expect(error).toMatchObject({ errorCode: ErrorCodes.ACCOUNT_LOCKED })
			const { details } = error as { details: { lockedUntil: string } }
			expect(Date.parse(details.lockedUntil)).toBeGreaterThanOrEqual(
				before + LOGIN_LOCK_DURATION_MS,
			)
		})
	})
})
