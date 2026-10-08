import { minutes } from '@nestjs/throttler'

/** Per IP: a person sets a goal a few times at most; more is a script. */
export const SET_GOAL_THROTTLE = { default: { limit: 10, ttl: minutes(1) } }
