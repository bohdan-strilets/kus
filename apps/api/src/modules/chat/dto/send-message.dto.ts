import { sendMessageRequestSchema } from '@kus/shared'
import { createZodDto } from 'nestjs-zod'
import { z } from 'zod'

import { type PhotoPayload, readPhoto } from '../../../common/photo'

export const DUPLICATE_PHOTO_IDS = 'DUPLICATE_PHOTO_IDS'

interface SendMessageBody {
	clientMessageId: string
	text: string | undefined
	photo: PhotoPayload | undefined
	photoIds: string[] | undefined
}

/**
 * The shared contract plus the photo step: base64 is decoded and checked right here, so past the
 * validation pipe only a PhotoPayload (which prints as `[image 1.2 MB]`) travels. Stored photos
 * arrive as ids: one id twice would be one file bound to two attachment rows.
 */
const sendMessageBodySchema = sendMessageRequestSchema.transform(
	({ photo, photoIds, ...request }, ctx): SendMessageBody => {
		if (photoIds && new Set(photoIds).size !== photoIds.length) {
			ctx.issues.push({
				code: 'custom',
				message: DUPLICATE_PHOTO_IDS,
				input: undefined,
				path: ['photoIds'],
			})
			return z.NEVER
		}
		if (!photo) return { ...request, photo: undefined, photoIds }
		const result = readPhoto(photo)
		if (!result.isValid) {
			// the code lands in details.fields.photo; the value is deliberately not attached
			ctx.issues.push({ code: 'custom', message: result.code, input: undefined, path: ['photo'] })
			return z.NEVER
		}
		return { ...request, photo: result.payload, photoIds }
	},
)

export class SendMessageDto extends createZodDto(sendMessageBodySchema) {}
