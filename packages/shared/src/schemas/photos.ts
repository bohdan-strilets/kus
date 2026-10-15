import { z } from 'zod'

import { PHOTO_MAX_BASE64_LENGTH, PHOTO_MAX_SIDE_PX, PHOTO_MIN_SIDE_PX } from './messages.js'
import { PHOTO_THUMB_MAX_BASE64_LENGTH } from './photo-limits.js'

/** Only JPEG: the client re-encodes every photo through a canvas. */
export const UPLOAD_PHOTO_MIME_TYPE = 'image/jpeg'

const photoDimensionSchema = z.int().min(PHOTO_MIN_SIDE_PX).max(PHOTO_MAX_SIDE_PX)

const createUploadImageSchema = (maxBase64Length: number) =>
	z.object({
		mimeType: z.literal(UPLOAD_PHOTO_MIME_TYPE),
		data: z.base64().max(maxBase64Length),
	})

/** Body of POST /photos: the full photo and its thumbnail, base64 JPEG; `width`/`height` are the full photo's. */
export const uploadPhotoRequestSchema = z.object({
	photo: createUploadImageSchema(PHOTO_MAX_BASE64_LENGTH),
	thumb: createUploadImageSchema(PHOTO_THUMB_MAX_BASE64_LENGTH),
	width: photoDimensionSchema,
	height: photoDimensionSchema,
})

export type UploadPhotoRequest = z.infer<typeof uploadPhotoRequestSchema>

export const PHOTO_VARIANTS = ['thumb', 'full'] as const

/** Path of GET and DELETE /photos/:id. */
export const photoParamsSchema = z.object({ id: z.uuid() })

/** Query of GET /photos/:id: which copy to return, the full photo by default. */
export const photoQuerySchema = z.object({ variant: z.enum(PHOTO_VARIANTS).default('full') })

export type PhotoVariant = (typeof PHOTO_VARIANTS)[number]

/** `data` of POST /photos. */
export const uploadPhotoResponseSchema = z.object({
	id: z.uuid(),
	width: z.int().positive(),
	height: z.int().positive(),
})

export type UploadPhotoResponse = z.infer<typeof uploadPhotoResponseSchema>
