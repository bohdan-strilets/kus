import { HttpException, HttpStatus } from '@nestjs/common'

import type { ErrorCode } from './error-codes'

export type ErrorDetails = Record<string, unknown>

interface AppExceptionOptions {
	status: HttpStatus
	errorCode: ErrorCode
	details?: ErrorDetails
}

/** Base class for every error the API returns on purpose. Subclass it per domain error. */
export class AppException extends HttpException {
	readonly errorCode: ErrorCode
	readonly details: ErrorDetails

	constructor({ status, errorCode, details = {} }: AppExceptionOptions) {
		super(errorCode, status)
		this.errorCode = errorCode
		this.details = details
	}
}
