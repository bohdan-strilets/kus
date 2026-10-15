import {
	type AiImageMimeType,
	PHOTO_MAX_BYTES,
	PHOTO_MAX_SIDE_PX,
	PHOTO_MIN_SIDE_PX,
} from '@kus/shared'
import { imageSize } from 'image-size'

import { PHOTO_FIELD_CODES, type PhotoFieldCode } from './photo.constants'

const JPEG_SIGNATURE = [0xff, 0xd8, 0xff]
const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]
const RIFF = 'RIFF'
const WEBP = 'WEBP'
const RIFF_END = 4
const WEBP_START = 8
const WEBP_END = 12

const startsWith = (bytes: Buffer, signature: number[]): boolean =>
	signature.every((byte, index) => bytes[index] === byte)

/** The type by the first bytes, never by what the client claims. */
const detectMimeType = (bytes: Buffer): AiImageMimeType | null => {
	if (startsWith(bytes, JPEG_SIGNATURE)) return 'image/jpeg'
	if (startsWith(bytes, PNG_SIGNATURE)) return 'image/png'
	const isWebp =
		bytes.toString('latin1', 0, RIFF_END) === RIFF &&
		bytes.toString('latin1', WEBP_START, WEBP_END) === WEBP
	return isWebp ? 'image/webp' : null
}

export type PhotoCheck =
	{ isValid: true; width: number; height: number } | { isValid: false; code: PhotoFieldCode }

const fail = (code: PhotoFieldCode): PhotoCheck => ({ isValid: false, code })

const readSize = (bytes: Buffer): { width: number; height: number } | null => {
	try {
		const { width, height } = imageSize(bytes)
		return Number.isInteger(width) && Number.isInteger(height) ? { width, height } : null
	} catch {
		// image-size throws on a truncated or broken header; the reason isn't useful to the client
		return null
	}
}

export interface PhotoLimits {
	maxBytes: number
	minSidePx: number
	maxSidePx: number
}

/** The limits of a photo that goes to the model (POST /messages); an upload passes its own. */
export const DEFAULT_PHOTO_LIMITS: PhotoLimits = {
	maxBytes: PHOTO_MAX_BYTES,
	minSidePx: PHOTO_MIN_SIDE_PX,
	maxSidePx: PHOTO_MAX_SIDE_PX,
}

/** Size, real type (the first bytes must match the declared one) and dimensions of a photo. */
export const validatePhoto = ({
	bytes,
	mimeType,
	limits = DEFAULT_PHOTO_LIMITS,
}: {
	bytes: Buffer
	mimeType: AiImageMimeType
	limits?: PhotoLimits
}): PhotoCheck => {
	if (bytes.length > limits.maxBytes) return fail(PHOTO_FIELD_CODES.tooLarge)
	if (detectMimeType(bytes) !== mimeType) return fail(PHOTO_FIELD_CODES.unsupported)
	const size = readSize(bytes)
	const isSideInRange = (side: number): boolean =>
		side >= limits.minSidePx && side <= limits.maxSidePx
	if (!size || !isSideInRange(size.width) || !isSideInRange(size.height)) {
		return fail(PHOTO_FIELD_CODES.invalid)
	}
	return { isValid: true, ...size }
}
