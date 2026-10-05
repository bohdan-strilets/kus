import {
	ArgumentsHost,
	Catch,
	ExceptionFilter,
	HttpException,
	HttpStatus,
	Logger,
} from '@nestjs/common'
import type { ApiErrorResponse } from '@kus/shared'
import type { Response } from 'express'

import { AppException, type ErrorCode, ErrorCodes } from '../exceptions'

const STATUS_ERROR_CODES: Partial<Record<number, ErrorCode>> = {
	[HttpStatus.BAD_REQUEST]: ErrorCodes.BAD_REQUEST,
	[HttpStatus.UNAUTHORIZED]: ErrorCodes.UNAUTHORIZED,
	[HttpStatus.FORBIDDEN]: ErrorCodes.FORBIDDEN,
	[HttpStatus.NOT_FOUND]: ErrorCodes.NOT_FOUND,
	[HttpStatus.CONFLICT]: ErrorCodes.CONFLICT,
	[HttpStatus.UNPROCESSABLE_ENTITY]: ErrorCodes.VALIDATION_ERROR,
	[HttpStatus.TOO_MANY_REQUESTS]: ErrorCodes.TOO_MANY_REQUESTS,
}

/** Turns every thrown error into the API error format from CLAUDE.md §5. */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
	private readonly logger = new Logger(AllExceptionsFilter.name)

	catch(exception: unknown, host: ArgumentsHost): void {
		const response = host.switchToHttp().getResponse<Response>()
		const body = this.toErrorBody(exception)
		response.status(body.statusCode).json(body)
	}

	private toErrorBody(exception: unknown): ApiErrorResponse {
		if (exception instanceof AppException) {
			return {
				statusCode: exception.getStatus(),
				errorCode: exception.errorCode,
				details: exception.details,
			}
		}

		if (exception instanceof HttpException) {
			const statusCode = exception.getStatus()
			return {
				statusCode,
				errorCode: STATUS_ERROR_CODES[statusCode] ?? ErrorCodes.INTERNAL_ERROR,
				details: {},
			}
		}

		// Unexpected error: log the stack, never leak internals to the client
		const stack = exception instanceof Error ? exception.stack : String(exception)
		this.logger.error('Unhandled exception', stack)
		return {
			statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
			errorCode: ErrorCodes.INTERNAL_ERROR,
			details: {},
		}
	}
}
