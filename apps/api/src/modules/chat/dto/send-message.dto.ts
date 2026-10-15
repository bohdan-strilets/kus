import { sendMessageRequestSchema } from '@kus/shared'
import { createZodDto } from 'nestjs-zod'
import { z } from 'zod'

import { type PhotoPayload, readPhoto } from '../../../common/photo'

interface SendMessageBody {
	clientMessageId: string
	text: string | undefined
	photo: PhotoPayload | undefined
}

/**
 * The shared contract plus the photo step: base64 is decoded and checked right here, so past the
 * validation pipe only a PhotoPayload (which prints as `[image 1.2 MB]`) travels.
 */
const sendMessageBodySchema = sendMessageRequestSchema.transform(
	({ photo, ...request }, ctx): SendMessageBody => {
		if (!photo) return { ...request, photo: undefined }
		const result = readPhoto(photo)
		if (!result.isValid) {
			// the code lands in details.fields.photo; the value is deliberately not attached
			ctx.issues.push({ code: 'custom', message: result.code, input: undefined, path: ['photo'] })
			return z.NEVER
		}
		return { ...request, photo: result.payload }
	},
)

export class SendMessageDto extends createZodDto(sendMessageBodySchema) {}
