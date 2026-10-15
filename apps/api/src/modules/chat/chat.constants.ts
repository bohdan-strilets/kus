import { minutes } from '@nestjs/throttler'

/** Per IP; the daily AI limit per user is separate (AiUsageService). */
export const SEND_MESSAGE_THROTTLE = { default: { limit: 20, ttl: minutes(1) } }

/** A PENDING message older than this was lost (crash, deploy) and may be processed again. */
export const STALE_PENDING_MS = minutes(2)

/** The AI reads one image per message until B1 (several images in one request); then raise this. */
export const SUPPORTED_PHOTOS_PER_MESSAGE = 1
