import { minutes } from '@nestjs/throttler'

/** Per IP: a profile is edited by hand, a few times at most. */
export const UPDATE_ME_THROTTLE = { default: { limit: 20, ttl: minutes(1) } }
