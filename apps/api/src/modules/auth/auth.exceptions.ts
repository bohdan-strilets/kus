import { HttpStatus } from '@nestjs/common'

import { AppException, ErrorCodes } from '../../common/exceptions'

/** Missing, invalid or expired access token, or its session was revoked. */
export class AuthRequiredException extends AppException {
	constructor() {
		super({ status: HttpStatus.UNAUTHORIZED, errorCode: ErrorCodes.UNAUTHORIZED })
	}
}

export class InvalidCredentialsException extends AppException {
	constructor() {
		super({ status: HttpStatus.UNAUTHORIZED, errorCode: ErrorCodes.INVALID_CREDENTIALS })
	}
}

/**
 * Reveals that the account exists — accepted for single-user v0.1 (docs/database.md, «Відкладено»).
 * The lock time lets the web app say when to try again.
 */
export class AccountLockedException extends AppException {
	constructor(lockedUntil: Date) {
		super({
			status: HttpStatus.LOCKED,
			errorCode: ErrorCodes.ACCOUNT_LOCKED,
			details: { lockedUntil: lockedUntil.toISOString() },
		})
	}
}

export class RegistrationDisabledException extends AppException {
	constructor() {
		super({ status: HttpStatus.FORBIDDEN, errorCode: ErrorCodes.REGISTRATION_DISABLED })
	}
}

export class EmailTakenException extends AppException {
	constructor() {
		super({ status: HttpStatus.CONFLICT, errorCode: ErrorCodes.EMAIL_TAKEN })
	}
}

export class RefreshTokenInvalidException extends AppException {
	constructor() {
		super({ status: HttpStatus.UNAUTHORIZED, errorCode: ErrorCodes.REFRESH_TOKEN_INVALID })
	}
}

export class RefreshTokenReusedException extends AppException {
	constructor() {
		super({ status: HttpStatus.UNAUTHORIZED, errorCode: ErrorCodes.REFRESH_TOKEN_REUSED })
	}
}

/**
 * The password typed to confirm a change or an account deletion is wrong. 400 on purpose: the
 * web app treats a 401 on a regular route as an expired session (refresh, then logout).
 */
export class PasswordIncorrectException extends AppException {
	constructor() {
		super({ status: HttpStatus.BAD_REQUEST, errorCode: ErrorCodes.PASSWORD_INCORRECT })
	}
}

export class PasswordSameException extends AppException {
	constructor() {
		super({ status: HttpStatus.BAD_REQUEST, errorCode: ErrorCodes.PASSWORD_SAME })
	}
}
