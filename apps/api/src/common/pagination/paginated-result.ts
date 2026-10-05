import type { PaginationMeta } from '@kus/shared'

/**
 * Return this from a controller for list endpoints: ResponseEnvelopeInterceptor
 * turns it into `{ data: items, meta }` instead of wrapping it in `{ data }` again.
 */
export class PaginatedResult<T> {
	constructor(
		readonly items: T[],
		readonly meta: PaginationMeta,
	) {}
}

interface PaginateOptions<T> {
	items: T[]
	total: number
	page: number
	limit: number
}

/** Builds the result with totalPages computed on the backend (CLAUDE.md §5: numbers come from the API). */
export const paginate = <T>({
	items,
	total,
	page,
	limit,
}: PaginateOptions<T>): PaginatedResult<T> =>
	// limit >= 1 is expected from the query DTO; the guard keeps totalPages from becoming NaN/Infinity
	new PaginatedResult(items, {
		total,
		page,
		limit,
		totalPages: limit > 0 ? Math.ceil(total / limit) : 0,
	})
