import { Injectable, Logger } from '@nestjs/common'
import type { ChangePasswordRequest, LoginRequest, RegisterRequest } from '@kus/shared'

import type { AuthenticatedUser } from '../../common/decorators'
import { Prisma } from '../../generated/prisma/client'
import { PrismaService } from '../../prisma'
import { UsersService } from '../users/users.service'
import { LOGIN_LOCK_DURATION_MS, MAX_FAILED_LOGIN_ATTEMPTS } from './auth.constants'
import {
	AccountLockedException,
	EmailTakenException,
	InvalidCredentialsException,
	PasswordIncorrectException,
	PasswordSameException,
} from './auth.exceptions'
import { AuthRepository } from './auth.repository'
import type { AuthResult, ClientMeta } from './auth.types'
import { PasswordService } from './password.service'
import { SessionService } from './session.service'

const UNIQUE_VIOLATION = 'P2002'

const isUniqueViolation = (error: unknown): boolean =>
	error instanceof Prisma.PrismaClientKnownRequestError && error.code === UNIQUE_VIOLATION

/** Credentials: registration, login and brute-force lockout. Sessions live in SessionService. */
@Injectable()
export class AuthService {
	private readonly logger = new Logger(AuthService.name)

	constructor(
		private readonly prisma: PrismaService,
		private readonly authRepository: AuthRepository,
		private readonly usersService: UsersService,
		private readonly passwordService: PasswordService,
		private readonly sessionService: SessionService,
	) {}

	async register(
		{ email, password, name }: RegisterRequest,
		meta: ClientMeta,
	): Promise<AuthResult> {
		if (await this.usersService.findByEmail(email)) throw new EmailTakenException()

		const passwordHash = await this.passwordService.hash(password)
		const user = await this.prisma
			.$transaction(async (tx) => {
				// the client only says «yes»; the time is ours, never taken from the request
				const created = await this.usersService.createUser(
					{ email, name, consentAt: new Date() },
					tx,
				)
				await this.authRepository.createCredentials({ userId: created.id, passwordHash }, tx)
				return created
			})
			.catch((error: unknown) => {
				// a parallel registration with the same email won the race after our check
				if (isUniqueViolation(error)) throw new EmailTakenException()
				throw error
			})

		this.logger.log(`User registered userId=${user.id}`)
		return { user, tokens: await this.sessionService.startSession({ userId: user.id, meta }) }
	}

	async login({ email, password }: LoginRequest, meta: ClientMeta): Promise<AuthResult> {
		const user = await this.usersService.findByEmail(email)
		const credentials = user ? await this.authRepository.findCredentials(user.id) : null

		if (!user || !credentials) {
			await this.passwordService.verifyDummy(password)
			this.logger.log('Login failed: unknown account')
			throw new InvalidCredentialsException()
		}

		const isPasswordValid = await this.checkPasswordWithLockout({
			userId: user.id,
			passwordHash: credentials.passwordHash,
			password,
		})
		if (!isPasswordValid) throw new InvalidCredentialsException()

		this.logger.log(`Login succeeded userId=${user.id}`)
		return { user, tokens: await this.sessionService.startSession({ userId: user.id, meta }) }
	}

	/**
	 * The password typed to confirm a change or a deletion, checked with the login lockout: five
	 * wrong confirmations lock the account like five wrong logins would.
	 */
	async verifyPasswordOrThrow(userId: string, password: string): Promise<void> {
		const credentials = await this.authRepository.findCredentials(userId)
		if (!credentials) throw new PasswordIncorrectException()

		const isPasswordValid = await this.checkPasswordWithLockout({
			userId,
			passwordHash: credentials.passwordHash,
			password,
		})
		if (!isPasswordValid) throw new PasswordIncorrectException()
	}

	/** New password after the current one; every other device is logged out, this one stays. */
	async changePassword(
		{ sub: userId, fam }: AuthenticatedUser,
		{ currentPassword, newPassword }: ChangePasswordRequest,
	): Promise<void> {
		await this.verifyPasswordOrThrow(userId, currentPassword)
		// checked after the current one, so a wrong guess learns nothing from this error
		if (newPassword === currentPassword) throw new PasswordSameException()

		const passwordHash = await this.passwordService.hash(newPassword)
		const now = new Date()
		await this.prisma.$transaction(async (tx) => {
			await this.authRepository.updatePassword({ userId, passwordHash, changedAt: now }, tx)
			await this.sessionService.logoutOthers({ sub: userId, fam }, tx)
		})
		this.logger.log(`Password changed userId=${userId}`)
	}

	/**
	 * Reserves an attempt (423 when locked), verifies, and counts a failure towards the lock.
	 * false = wrong password; the caller picks the error, which differs for login and confirmation.
	 */
	private async checkPasswordWithLockout({
		userId,
		passwordHash,
		password,
	}: {
		userId: string
		passwordHash: string
		password: string
	}): Promise<boolean> {
		const now = new Date()
		const isReserved = await this.authRepository.reserveLoginAttempt({
			userId,
			maxAttempts: MAX_FAILED_LOGIN_ATTEMPTS,
			now,
		})
		if (!isReserved) throw await this.rejectLockedLogin(userId, now)

		const isPasswordValid = await this.passwordService.verify(passwordHash, password)
		if (!isPasswordValid) {
			await this.recordFailedLogin(userId, now)
			return false
		}

		await this.authRepository.resetFailedAttempts(userId)
		return true
	}

	/** Builds the 423 for a login that couldn't reserve an attempt. */
	private async rejectLockedLogin(userId: string, now: Date): Promise<AccountLockedException> {
		const credentials = await this.authRepository.findCredentials(userId)
		// no lock yet means the last attempts are still in flight; one of them is about to set it
		const lockedUntil =
			credentials?.lockedUntil && credentials.lockedUntil > now
				? credentials.lockedUntil
				: new Date(now.getTime() + LOGIN_LOCK_DURATION_MS)
		this.logger.log(`Login rejected: account locked userId=${userId}`)
		return new AccountLockedException(lockedUntil)
	}

	private async recordFailedLogin(userId: string, now: Date): Promise<void> {
		const isLocked = await this.authRepository.lockIfAttemptsExhausted({
			userId,
			maxAttempts: MAX_FAILED_LOGIN_ATTEMPTS,
			lockedUntil: new Date(now.getTime() + LOGIN_LOCK_DURATION_MS),
		})

		if (isLocked) {
			this.logger.warn(`Account locked after failed logins userId=${userId}`)
			return
		}
		this.logger.log(`Login failed: wrong password userId=${userId}`)
	}
}
