import { z } from 'zod'

/** Every successful API response is wrapped in `{ data }` (CLAUDE.md §5). */
export const createDataResponseSchema = <T extends z.ZodType>(dataSchema: T) =>
	z.object({ data: dataSchema })

export const paginationMetaSchema = z.object({
	total: z.number().int().nonnegative(),
	page: z.number().int().positive(),
	limit: z.number().int().positive(),
	totalPages: z.number().int().nonnegative(),
})

export type PaginationMeta = z.infer<typeof paginationMetaSchema>

/** List endpoints: `{ data: [...], meta: { total, page, limit, totalPages } }`. */
export const createPaginatedResponseSchema = <T extends z.ZodType>(itemSchema: T) =>
	z.object({ data: z.array(itemSchema), meta: paginationMetaSchema })

/**
 * Endless, append-only lists (the chat feed): `total`/`page` make no sense there, so the meta
 * carries an opaque cursor for the next (older) page instead; `null` = no more items.
 */
export const cursorMetaSchema = z.object({
	limit: z.number().int().positive(),
	nextCursor: z.string().nullable(),
})

export type CursorMeta = z.infer<typeof cursorMetaSchema>

export const createCursorPaginatedResponseSchema = <T extends z.ZodType>(itemSchema: T) =>
	z.object({ data: z.array(itemSchema), meta: cursorMetaSchema })

export const apiErrorResponseSchema = z.object({
	statusCode: z.number().int(),
	errorCode: z.string(),
	details: z.record(z.string(), z.unknown()),
})

export type ApiErrorResponse = z.infer<typeof apiErrorResponseSchema>
