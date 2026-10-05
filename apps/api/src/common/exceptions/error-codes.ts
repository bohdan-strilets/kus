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
} as const

export type ErrorCode = (typeof ErrorCodes)[keyof typeof ErrorCodes]
