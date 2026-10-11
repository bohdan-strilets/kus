import type { SendMessagePhoto } from '@kus/shared'

import { PHOTO_FIELD_CODES, type PhotoFieldCode } from './photo.constants'
import { PhotoPayload } from './photo-payload'
import { stripJpegMetadata } from './strip-jpeg-metadata'
import { validatePhoto } from './validate-photo'

export type PhotoReadResult =
	{ isValid: true; payload: PhotoPayload } | { isValid: false; code: PhotoFieldCode }

/**
 * The one place where a request's base64 becomes bytes: decode, check, cut the metadata. The
 * base64 string is not kept anywhere past this call.
 */
export const readPhoto = ({ mimeType, data }: SendMessagePhoto): PhotoReadResult => {
	const bytes = Buffer.from(data, 'base64')
	const check = validatePhoto({ bytes, mimeType })
	if (!check.isValid) return check
	const clean = stripJpegMetadata(bytes, mimeType)
	if (!clean) return { isValid: false, code: PHOTO_FIELD_CODES.invalid }
	return { isValid: true, payload: new PhotoPayload(mimeType, clean, check.width, check.height) }
}
