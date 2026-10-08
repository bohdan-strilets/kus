import type { Request } from 'express'

// Requests that carried the right proxy secret. A WeakSet: nothing to clean up, nothing leaks
// into the request object other middleware sees.
const fromProxy = new WeakSet<Request>()

export const markFromProxy = (request: Request): void => {
	fromProxy.add(request)
}

/** Only these came through Vercel, so only their client IP header is Vercel's own. */
export const isFromProxy = (request: Request): boolean => fromProxy.has(request)
