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

const MARKER_PREFIX = 0xff
const SOI = 0xd8
const SOS = 0xda
const APP1 = 0xe1
const EXIF_ID = [0x45, 0x78, 0x69, 0x66, 0x00]
const SEGMENT_HEADER_BYTES = 4
const EXIF_ID_OFFSET = 4

/** True when the JPEG carries an Exif block (APP1) ahead of the scan: the camera's metadata. */
export const hasJpegExif = (bytes: Uint8Array): boolean => {
	if (bytes[0] !== MARKER_PREFIX || bytes[1] !== SOI) return false
	let offset = 2
	while (offset + SEGMENT_HEADER_BYTES <= bytes.length) {
		if (bytes[offset] !== MARKER_PREFIX) return false
		const marker = bytes[offset + 1]
		if (marker === SOS) return false
		if (marker === APP1) {
			return EXIF_ID.every((byte, index) => bytes[offset + EXIF_ID_OFFSET + index] === byte)
		}
		const length = ((bytes[offset + 2] ?? 0) << 8) | (bytes[offset + 3] ?? 0)
		offset += 2 + length
	}
	return false
}
