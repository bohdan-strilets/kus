import { minutes } from '@nestjs/throttler'

/** Per IP; the daily AI limit per user is separate (AiUsageService). */
export const SEND_MESSAGE_THROTTLE = { default: { limit: 20, ttl: minutes(1) } }

/** A PENDING message older than this was lost (crash, deploy) and may be processed again. */
export const STALE_PENDING_MS = minutes(2)

/** The AI reads one image per message until B1 (several images in one request); then raise this. */
export const SUPPORTED_PHOTOS_PER_MESSAGE = 1

/** Yesterday's entries read for «як вчора»: the model sees the first EARLIER_YESTERDAY_MAX_ENTRIES. */
export const EARLIER_YESTERDAY_FETCH_ENTRIES = 50

/** Newest entries of the last month scanned for the food a message names; the name match narrows them. */
export const EARLIER_RECENT_SCAN_MAX_ENTRIES = 400

/** Kusik's reply when a proposed program is exactly the active one (no card). */
export const PROGRAM_UNCHANGED_REPLY = 'Це вже так у програмі.'

/** Kusik's message with a card recounted against the current program («Перерахувати»). */
export const PROGRAM_REBASED_REPLY = 'Перерахував від поточної програми.'

/** Kusik's reply, no card: the program changed in the editor after the model read it. */
export const PROGRAM_BASE_CHANGED_REPLY =
	'Програму щойно змінено в редакторі — напиши ще раз, що змінити.'
