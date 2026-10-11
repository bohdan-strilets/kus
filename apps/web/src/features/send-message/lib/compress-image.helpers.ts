/** The photo that leaves the phone is this big at most: the model downscales anything bigger. */
export const PHOTO_MAX_SIDE_PX = 1568
const PHOTO_FALLBACK_SIDE_PX = 1280
/** The API takes 1.4 MB (PHOTO_MAX_BYTES); aim lower so a slow network has less to carry. */
export const PHOTO_TARGET_BYTES = 1_000_000

export interface CompressionAttempt {
	maxSide: number
	quality: number
}

/** From the best picture to the lightest; the first one that fits PHOTO_TARGET_BYTES is sent. */
export const COMPRESSION_ATTEMPTS: readonly CompressionAttempt[] = [
	{ maxSide: PHOTO_MAX_SIDE_PX, quality: 0.8 },
	{ maxSide: PHOTO_MAX_SIDE_PX, quality: 0.7 },
	{ maxSide: PHOTO_MAX_SIDE_PX, quality: 0.6 },
	{ maxSide: PHOTO_FALLBACK_SIDE_PX, quality: 0.7 },
]

export type PhotoErrorKind = 'unsupported' | 'tooLarge'

export class PhotoError extends Error {
	readonly kind: PhotoErrorKind

	constructor(kind: PhotoErrorKind) {
		super(`photo: ${kind}`)
		this.name = 'PhotoError'
		this.kind = kind
	}
}

/** Fits the longer side into maxSide, keeping the proportions; never enlarges. */
export const getTargetSize = (
	width: number,
	height: number,
	maxSide: number = PHOTO_MAX_SIDE_PX,
): { width: number; height: number } => {
	const scale = Math.min(1, maxSide / Math.max(width, height))
	return {
		width: Math.max(1, Math.round(width * scale)),
		height: Math.max(1, Math.round(height * scale)),
	}
}
