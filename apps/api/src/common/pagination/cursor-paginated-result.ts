import type { CursorMeta } from '@kus/shared'

/**
 * Return this from a controller for endless lists (the chat feed): ResponseEnvelopeInterceptor
 * turns it into `{ data: items, meta: { limit, nextCursor } }`.
 */
export class CursorPaginatedResult<T> {
	constructor(
		readonly items: T[],
		readonly meta: CursorMeta,
	) {}
}
