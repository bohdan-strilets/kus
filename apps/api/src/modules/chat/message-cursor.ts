import { z } from 'zod'

/**
 * Position in the feed. The feed is ordered by id: uuid v7 is time-ordered, unique and exact,
 * while created_at is set by the DB with microseconds that a JS Date (ms) would cut off.
 */
export interface MessageCursor {
	id: string
}

const cursorPayloadSchema = z.object({ i: z.uuid() })

/** Opaque to the client: base64url of `{ i: id }`. */
export const encodeMessageCursor = ({ id }: MessageCursor): string =>
	Buffer.from(JSON.stringify({ i: id })).toString('base64url')

export const decodeMessageCursor = (cursor: string): MessageCursor | null => {
	try {
		const json: unknown = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8'))
		const result = cursorPayloadSchema.safeParse(json)
		return result.success ? { id: result.data.i } : null
	} catch {
		// not base64 JSON — the caller answers 422 INVALID_CURSOR
		return null
	}
}
