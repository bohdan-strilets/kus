import { minutes } from '@nestjs/throttler'

/** Per IP: «Мої дані» is edited by hand, a field at a time. */
export const UPDATE_PROFILE_THROTTLE = { default: { limit: 20, ttl: minutes(1) } }
/** The preview runs on every open of goals-recalc and goals-edit-sheet. */
export const PREVIEW_GOALS_THROTTLE = { default: { limit: 30, ttl: minutes(1) } }
export const SAVE_GOALS_THROTTLE = { default: { limit: 10, ttl: minutes(1) } }

/** Weights are shown and stored with one decimal («82,4 кг»). */
export const WEIGHT_DECIMALS = 1
