import { minutes } from '@nestjs/throttler'
import { PHOTO_THUMB_MAX_BYTES, PHOTO_THUMB_SIDE_PX } from '@kus/shared'

import { DEFAULT_PHOTO_LIMITS, type PhotoLimits } from '../../common/photo'

/** Per IP; the daily upload limit per user is separate (PHOTO_DAILY_UPLOAD_LIMIT). */
export const PHOTO_UPLOAD_THROTTLE = { default: { limit: 30, ttl: minutes(1) } }

/** A feed shows up to 6 thumbnails per message, so reads get far more room than the global 100/min. */
export const PHOTO_READ_THROTTLE = { default: { limit: 600, ttl: minutes(1) } }

/** An uploaded full photo is held to the same limits as one sent straight to the model. */
export const PHOTO_FULL_LIMITS: PhotoLimits = DEFAULT_PHOTO_LIMITS

// a thumbnail of a very wide photo is only a few pixels high, so there is no lower bound but 1
const THUMB_MIN_SIDE_PX = 1

export const PHOTO_THUMB_LIMITS: PhotoLimits = {
	maxBytes: PHOTO_THUMB_MAX_BYTES,
	minSidePx: THUMB_MIN_SIDE_PX,
	maxSidePx: PHOTO_THUMB_SIDE_PX,
}

/** A stored photo never changes under its id, so a browser may keep it for good. */
export const PHOTO_CACHE_CONTROL = 'private, max-age=31536000, immutable'
