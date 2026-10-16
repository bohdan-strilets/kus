export const STORAGE_ADAPTER = Symbol('STORAGE_ADAPTER')

/** PUT and GET carry whole photos (up to ~1.4 MB), so they get room for a slow link. */
export const STORAGE_TRANSFER_TIMEOUT_MS = 20_000

/** DELETE and LIST carry no body: a hanging one must not hold a database transaction for long. */
export const STORAGE_DELETE_TIMEOUT_MS = 10_000
export const STORAGE_LIST_TIMEOUT_MS = 10_000

/** aws4fetch retries (on top of the first attempt); its backoff is a few hundred ms at most, ignored below. */
export const STORAGE_RETRIES = 2

/** Worst case of one DELETE or LIST: every attempt runs out its timeout. */
export const STORAGE_WORST_REQUEST_MS = (STORAGE_RETRIES + 1) * STORAGE_DELETE_TIMEOUT_MS

/** Slack on top of the storage calls for the database work inside a transaction. */
const TRANSACTION_MARGIN_MS = 10_000

/**
 * Removing one photo (DELETE /photos and the orphan cron share removeUnattached) runs two
 * sequential deleteObject calls (full + thumbnail) in one transaction:
 * 2 x 30 s worst case + 10 s margin = 70 s.
 */
export const PHOTO_REMOVE_TRANSACTION_TIMEOUT_MS =
	2 * STORAGE_WORST_REQUEST_MS + TRANSACTION_MARGIN_MS
