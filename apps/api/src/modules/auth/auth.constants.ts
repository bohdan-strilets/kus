import { minutes, seconds } from '@nestjs/throttler'

import { API_PREFIX } from '../../app.setup'

const SECONDS_IN_MINUTE = 60
const MS_IN_DAY = 24 * 60 * 60 * 1000

export const ACCESS_TOKEN_TTL_SECONDS = 15 * SECONDS_IN_MINUTE
export const REFRESH_TOKEN_TTL_MS = 30 * MS_IN_DAY
/** 256 bits: an opaque refresh token this long can't be guessed, so SHA-256 is enough to store it. */
export const REFRESH_TOKEN_BYTES = 32
/**
 * A used refresh token replayed this soon is treated as the legitimate client (lost response,
 * PWA + Safari tab sharing the cookie), not as theft — see SessionService.reissueWithinGrace.
 */
export const REFRESH_REUSE_GRACE_MS = seconds(20)

export const ACCESS_COOKIE_NAME = 'kus_access'
export const REFRESH_COOKIE_NAME = 'kus_refresh'
export const ACCESS_COOKIE_PATH = `/${API_PREFIX}`
/** The refresh token is sent only to auth routes, never with regular API calls. */
export const REFRESH_COOKIE_PATH = `/${API_PREFIX}/auth`

export const MAX_FAILED_LOGIN_ATTEMPTS = 5
export const LOGIN_LOCK_DURATION_MS = minutes(15)

export const USER_AGENT_MAX_LENGTH = 255

/** Per IP; login and register are the brute-force targets. */
export const STRICT_AUTH_THROTTLE = { default: { limit: 5, ttl: minutes(1) } }
export const REFRESH_THROTTLE = { default: { limit: 30, ttl: minutes(1) } }
