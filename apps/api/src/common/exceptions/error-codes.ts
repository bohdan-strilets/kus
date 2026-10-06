/** Stable error codes the web app translates via i18n (`errors.<CODE>`). */
export const ErrorCodes = {
	VALIDATION_ERROR: 'VALIDATION_ERROR',
	BAD_REQUEST: 'BAD_REQUEST',
	UNAUTHORIZED: 'UNAUTHORIZED',
	FORBIDDEN: 'FORBIDDEN',
	NOT_FOUND: 'NOT_FOUND',
	CONFLICT: 'CONFLICT',
	PAYLOAD_TOO_LARGE: 'PAYLOAD_TOO_LARGE',
	TOO_MANY_REQUESTS: 'TOO_MANY_REQUESTS',
	/** Any other 4xx without a dedicated code (405, 415, …). */
	CLIENT_ERROR: 'CLIENT_ERROR',
	INTERNAL_ERROR: 'INTERNAL_ERROR',

	// auth & users
	/** Same code for an unknown email and a wrong password, so accounts can't be enumerated. */
	INVALID_CREDENTIALS: 'INVALID_CREDENTIALS',
	ACCOUNT_LOCKED: 'ACCOUNT_LOCKED',
	REGISTRATION_DISABLED: 'REGISTRATION_DISABLED',
	EMAIL_TAKEN: 'EMAIL_TAKEN',
	REFRESH_TOKEN_INVALID: 'REFRESH_TOKEN_INVALID',
	REFRESH_TOKEN_REUSED: 'REFRESH_TOKEN_REUSED',
	USER_NOT_FOUND: 'USER_NOT_FOUND',
} as const

export type ErrorCode = (typeof ErrorCodes)[keyof typeof ErrorCodes]
