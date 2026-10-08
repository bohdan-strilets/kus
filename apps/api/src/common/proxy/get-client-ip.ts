import type { Request } from 'express'

import { CLIENT_IP_HEADER } from './proxy.constants'

/**
 * Behind the Vercel rewrite `req.ip` is Vercel's egress IP, shared by everyone. With the proxy
 * gate on (`isBehindProxy`), every request that got here came through Vercel, so its client IP
 * header is Vercel's own. Without the gate (local, tests) the header could be forged — ignore it.
 */
export const getClientIp = (request: Request, { isBehindProxy }: { isBehindProxy: boolean }) => {
	const fallback = request.ip ?? ''
	if (!isBehindProxy) return fallback
	const [first] = (request.header(CLIENT_IP_HEADER) ?? '').split(',')
	return first?.trim() || fallback
}
