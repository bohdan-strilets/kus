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
	/** The API runs but can't reach the database: the healthcheck fails, the deploy isn't promoted. */
	SERVICE_UNAVAILABLE: 'SERVICE_UNAVAILABLE',

	// auth & users
	/** Same code for an unknown email and a wrong password, so accounts can't be enumerated. */
	INVALID_CREDENTIALS: 'INVALID_CREDENTIALS',
	ACCOUNT_LOCKED: 'ACCOUNT_LOCKED',
	REGISTRATION_DISABLED: 'REGISTRATION_DISABLED',
	EMAIL_TAKEN: 'EMAIL_TAKEN',
	REFRESH_TOKEN_INVALID: 'REFRESH_TOKEN_INVALID',
	REFRESH_TOKEN_REUSED: 'REFRESH_TOKEN_REUSED',
	USER_NOT_FOUND: 'USER_NOT_FOUND',
	/**
	 * The password typed to confirm a change or a deletion is wrong. 400, not 401: the web app
	 * would answer a 401 with a token refresh and a logout.
	 */
	PASSWORD_INCORRECT: 'PASSWORD_INCORRECT',
	/** The new password equals the current one. */
	PASSWORD_SAME: 'PASSWORD_SAME',
	/** Deletion requested: the account can only be restored or logged out until it is purged. */
	ACCOUNT_PENDING_DELETION: 'ACCOUNT_PENDING_DELETION',

	// profile & goals
	/** The goal calculation needs fields that «Мої дані» doesn't have yet (details.fields). */
	PROFILE_INCOMPLETE: 'PROFILE_INCOMPLETE',
	/** Manual goals: protein, carbs and fat add up to something far from the kcal. */
	GOALS_INCONSISTENT: 'GOALS_INCONSISTENT',

	// chat & AI
	/** The model failed or kept returning invalid data; the message is FAILED and can be resent. */
	AI_UNAVAILABLE: 'AI_UNAVAILABLE',
	DAILY_LIMIT_REACHED: 'DAILY_LIMIT_REACHED',
	/** The answer didn't fit the output limit; resending the same text would be cut again. */
	MESSAGE_TOO_LONG: 'MESSAGE_TOO_LONG',
	/** The same clientMessageId is being processed right now. */
	MESSAGE_IN_PROGRESS: 'MESSAGE_IN_PROGRESS',
	/** A clientMessageId was resent with a different text. */
	CLIENT_MESSAGE_ID_REUSED: 'CLIENT_MESSAGE_ID_REUSED',
	CLARIFICATION_NOT_FOUND: 'CLARIFICATION_NOT_FOUND',
	/** Answered already, by another tap or in words in the chat. */
	CLARIFICATION_ALREADY_ANSWERED: 'CLARIFICATION_ALREADY_ANSWERED',
	/** Its entries are gone, the option has no values (an older question) or breaks entry limits. */
	CLARIFICATION_NOT_APPLICABLE: 'CLARIFICATION_NOT_APPLICABLE',
	/** An entry the message changes was deleted or restored meanwhile (another tab); resend it. */
	ENTRY_CHANGED: 'ENTRY_CHANGED',
	/** The edit sheet: no active entry with this id for this user (another user's is "not found" too). */
	ENTRY_NOT_FOUND: 'ENTRY_NOT_FOUND',
} as const

export type ErrorCode = (typeof ErrorCodes)[keyof typeof ErrorCodes]
