import { minutes } from '@nestjs/throttler'

/** PUT of the live mode: a snapshot after every set, retried on a weak connection. */
export const LIVE_SNAPSHOT_THROTTLE = { default: { limit: 120, ttl: minutes(1) } }

/** Start, finish and the form: a few taps per workout. */
export const LIVE_ACTION_THROTTLE = { default: { limit: 10, ttl: minutes(1) } }

/** A form's start may be this far ahead of the server's clock (a phone a bit fast), no more. */
export const FORM_FUTURE_TOLERANCE_MIN = 5
