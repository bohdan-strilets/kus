import { uploadPhotoRequestSchema } from '@kus/shared'
import { createZodDto } from 'nestjs-zod'
import { z } from 'zod'

import { PhotoPayload, readPhoto } from '../../../common/photo'
import { PHOTO_FULL_LIMITS, PHOTO_THUMB_LIMITS } from '../photos.constants'

export interface UploadPhotoBody {
	photo: PhotoPayload
	thumb: PhotoPayload
}

/**
 * The shared contract plus the photo step: both images are decoded and checked right here, so past
 * the validation pipe only PhotoPayloads travel. The `width`/`height` of the body are dropped on
 * purpose: the real sizes come from the bytes.
 */
const uploadPhotoBodySchema = uploadPhotoRequestSchema.transform(
	({ photo, thumb }, ctx): UploadPhotoBody => {
		const fullResult = readPhoto(photo, PHOTO_FULL_LIMITS)
		const thumbResult = readPhoto(thumb, PHOTO_THUMB_LIMITS)
		// the code lands in details.fields.<photo|thumb>; the value is deliberately not attached
		if (!fullResult.isValid) {
			ctx.issues.push({
				code: 'custom',
				message: fullResult.code,
				input: undefined,
				path: ['photo'],
			})
		}
		if (!thumbResult.isValid) {
			ctx.issues.push({
				code: 'custom',
				message: thumbResult.code,
				input: undefined,
				path: ['thumb'],
			})
		}
		if (!fullResult.isValid || !thumbResult.isValid) return z.NEVER
		return { photo: fullResult.payload, thumb: thumbResult.payload }
	},
)

export class UploadPhotoDto extends createZodDto(uploadPhotoBodySchema) {}
