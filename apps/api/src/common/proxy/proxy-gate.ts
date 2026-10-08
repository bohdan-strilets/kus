import { createHash, timingSafeEqual } from 'node:crypto'

import { HttpStatus } from '@nestjs/common'
import type { ApiErrorResponse } from '@kus/shared'
import type { NextFunction, Request, Response } from 'express'

import { ErrorCodes } from '../exceptions'
import { PROXY_SECRET_HEADER } from './proxy.constants'
import { markFromProxy } from './proxy-requests'

// equal-length digests: timingSafeEqual needs them, and the length of the secret doesn't leak
const digest = (value: string): Buffer => createHash('sha256').update(value).digest()

const NOT_FOUND_BODY: ApiErrorResponse = {
	statusCode: HttpStatus.NOT_FOUND,
	errorCode: ErrorCodes.NOT_FOUND,
	details: {},
}

interface ProxyGateOptions {
	secret: string
	/** Full paths open without the secret: Railway's healthcheck calls the service directly. */
	exemptPaths: readonly string[]
}

/**
 * In production the API is reachable only through the Vercel rewrite, which adds the shared
 * secret: a direct call to the Railway domain can't forge the client IP the throttler trusts, and
 * gets the same 404 as an unknown route. It doesn't hide that an API runs there (the healthcheck
 * is open). Runs before the throttler, body parsing and CORS.
 */
export const createProxyGate = ({ secret, exemptPaths }: ProxyGateOptions) => {
	const expected = digest(secret)

	return (request: Request, response: Response, next: NextFunction): void => {
		if (exemptPaths.includes(request.path)) {
			next()
			return
		}
		const received = request.header(PROXY_SECRET_HEADER)
		if (received !== undefined && timingSafeEqual(digest(received), expected)) {
			markFromProxy(request)
			next()
			return
		}
		response.status(HttpStatus.NOT_FOUND).json(NOT_FOUND_BODY)
	}
}
