import { minutes } from '@nestjs/throttler'

import { STORAGE_WORST_REQUEST_MS } from '../storage/storage.constants'

/** Per IP: restoring is a single tap; more is a script. */
export const RESTORE_ACCOUNT_THROTTLE = { default: { limit: 10, ttl: minutes(1) } }

/** Expired users read per page: the cron never holds a long query, users are deleted one by one. */
export const PURGE_BATCH_SIZE = 50

/** Storage failures in a row after which a purge run stops: the storage is down, the rest waits for the next run. */
export const PURGE_MAX_CONSECUTIVE_STORAGE_FAILURES = 5

/**
 * One user's purge transaction holds a connection (and the row lock) while storage deletes.
 * deleteByPrefix removes objects in batches of 10 parallel DELETEs, so at ~100 ms per request
 * that is ~100 objects/s: 60 s fit about 6000 objects, i.e. ~3000 photos (full + thumbnail).
 * A user with more than that times out, is skipped as a database failure and finishes on a later
 * run: deleteByPrefix is idempotent and the objects already removed stay removed.
 * 60 s is above the worst single storage request (STORAGE_WORST_REQUEST_MS = 30 s), so one hanging
 * call never outlives the transaction alone.
 */
export const PURGE_TRANSACTION_TIMEOUT_MS = 2 * STORAGE_WORST_REQUEST_MS

export const USER_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
