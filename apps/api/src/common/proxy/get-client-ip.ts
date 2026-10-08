import { Logger } from '@nestjs/common'
import type { Request } from 'express'

import { CLIENT_IP_HEADER } from './proxy.constants'
import { isFromProxy } from './proxy-requests'

const logger = new Logger('ClientIp')
let hasWarnedMissingHeader = false

/**
 * Behind the Vercel rewrite `req.ip` is the proxy's IP, shared by everyone. A request the proxy
 * gate let through came via Vercel, so its client IP header is Vercel's own; anything else — the
 * healthcheck, local runs, tests — may carry a forged one and keeps `req.ip`.
 */
export const getClientIp = (request: Request): string => {
	const fallback = request.ip ?? ''
	if (!isFromProxy(request)) return fallback
	const header = request.header(CLIENT_IP_HEADER)
	if (!header) {
		// every client would share one throttler bucket: say so once (no IP in the log)
		if (!hasWarnedMissingHeader) {
			logger.warn(`${CLIENT_IP_HEADER} is missing behind the proxy; throttling by the proxy IP`)
			hasWarnedMissingHeader = true
		}
		return fallback
	}
	// Vercel overwrites it with one value; if a list ever shows up, the last entry is the one the
	// nearest proxy added — the first may be the client's own
	const last = header.split(',').at(-1)?.trim()
	return last || fallback
}
