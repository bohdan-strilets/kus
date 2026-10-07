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

import { Prisma } from '../../generated/prisma/client'
import { AppException, type ErrorCode, ErrorCodes } from '../exceptions'

const STATUS_ERROR_CODES: Partial<Record<number, ErrorCode>> = {
	[HttpStatus.BAD_REQUEST]: ErrorCodes.BAD_REQUEST,
	[HttpStatus.UNAUTHORIZED]: ErrorCodes.UNAUTHORIZED,
	[HttpStatus.FORBIDDEN]: ErrorCodes.FORBIDDEN,
	[HttpStatus.NOT_FOUND]: ErrorCodes.NOT_FOUND,
	[HttpStatus.CONFLICT]: ErrorCodes.CONFLICT,
	[HttpStatus.PAYLOAD_TOO_LARGE]: ErrorCodes.PAYLOAD_TOO_LARGE,
	[HttpStatus.UNPROCESSABLE_ENTITY]: ErrorCodes.VALIDATION_ERROR,
	[HttpStatus.TOO_MANY_REQUESTS]: ErrorCodes.TOO_MANY_REQUESTS,
}

const PRISMA_ERROR_PREFIX = 'PrismaClient'
const CLIENT_ERROR_MIN = 400
const SERVER_ERROR_MIN = 500

const isClientErrorStatus = (status: number): boolean =>
	status >= CLIENT_ERROR_MIN && status < SERVER_ERROR_MIN

/**
 * Express middleware (body-parser) throws http-errors objects, not HttpException: they carry
 * the status in `status` (413 for an oversized body, 400 for bad JSON) and `expose: true`.
 * `expose` is required on purpose: upstream SDK errors (axios, openai) also have a numeric
 * `status`, and an OpenRouter 401/429 is our failure, not the client's.
 */
const getStatus = (exception: unknown): number => {
	if (exception instanceof HttpException) return exception.getStatus()
	if (typeof exception !== 'object' || exception === null) return HttpStatus.INTERNAL_SERVER_ERROR
	if (!('status' in exception) || !('expose' in exception) || exception.expose !== true) {
		return HttpStatus.INTERNAL_SERVER_ERROR
	}
	const { status } = exception
	return typeof status === 'number' && isClientErrorStatus(status)
		? status
		: HttpStatus.INTERNAL_SERVER_ERROR
}

const getErrorCode = (statusCode: number): ErrorCode => {
	if (!isClientErrorStatus(statusCode)) return ErrorCodes.INTERNAL_ERROR
	return STATUS_ERROR_CODES[statusCode] ?? ErrorCodes.CLIENT_ERROR
}

/**
 * Prisma error messages quote the query arguments — message text, food names (CLAUDE.md §10.1),
 * so for them only the class and the error code are logged.
 */
const getSafeTrace = (exception: unknown): string => {
	if (exception instanceof Prisma.PrismaClientKnownRequestError) {
		return `${exception.name} ${exception.code}`
	}
	if (exception instanceof Error && exception.name.startsWith(PRISMA_ERROR_PREFIX)) {
		return exception.name
	}
	return exception instanceof Error ? (exception.stack ?? exception.name) : String(exception)
}

/** Turns every thrown error into the API error format from CLAUDE.md §5. */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
	private readonly logger = new Logger(AllExceptionsFilter.name)

	catch(exception: unknown, host: ArgumentsHost): void {
		const response = host.switchToHttp().getResponse<Response>()
		const body = this.toErrorBody(exception)

		// 4xx are expected client mistakes; only server failures are worth a log
		if (body.statusCode >= SERVER_ERROR_MIN) this.logServerFailure(exception, body.errorCode)

		response.status(body.statusCode).json(body)
	}

	/**
	 * A 5xx AppException is thrown on purpose (AI_UNAVAILABLE: the model failed, details are already
	 * in AiRun) — a warning without a stack. Anything else is a bug: an error with a safe trace.
	 */
	private logServerFailure(exception: unknown, errorCode: string): void {
		if (exception instanceof AppException) {
			this.logger.warn(`Request failed (${errorCode})`)
			return
		}
		this.logger.error(`Request failed (${errorCode})`, getSafeTrace(exception))
	}

	private toErrorBody(exception: unknown): ApiErrorResponse {
		if (exception instanceof AppException) {
			return {
				statusCode: exception.getStatus(),
				errorCode: exception.errorCode,
				details: exception.details,
			}
		}

		// never leak internals (messages, stacks) to the client
		const statusCode = getStatus(exception)
		return { statusCode, errorCode: getErrorCode(statusCode), details: {} }
	}
}
