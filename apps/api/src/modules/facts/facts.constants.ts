/** Daily at 03:15: after the AI cleanup (03:00), before the photos (03:30). */
export const FACTS_CLEANUP_CRON = '0 15 3 * * *'

/** A deleted fact can be restored from the undo toast for this long, then it goes for good. */
export const DELETED_FACT_RETENTION_DAYS = 30

/** A proposal nobody answered and a rejected one are only needed by the chat plaque for a week. */
export const UNANSWERED_FACT_RETENTION_DAYS = 7
