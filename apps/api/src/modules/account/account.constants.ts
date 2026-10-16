import { minutes } from '@nestjs/throttler'

/** Per IP: restoring is a single tap; more is a script. */
export const RESTORE_ACCOUNT_THROTTLE = { default: { limit: 10, ttl: minutes(1) } }

/** Expired users read per page: the cron never holds a long query, users are deleted one by one. */
export const PURGE_BATCH_SIZE = 50

export const USER_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
