import { minutes } from '@nestjs/throttler'

/** Per IP: restoring is a single tap; more is a script. */
export const RESTORE_ACCOUNT_THROTTLE = { default: { limit: 10, ttl: minutes(1) } }
