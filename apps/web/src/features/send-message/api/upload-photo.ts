import {
	createDataResponseSchema,
	UPLOAD_PHOTO_MIME_TYPE,
	type UploadPhotoResponse,
	uploadPhotoResponseSchema,
} from '@kus/shared'

import { httpClient } from '@/shared/api'

const responseSchema = createDataResponseSchema(uploadPhotoResponseSchema)

/** The photo and its thumbnail are ~1.4 MB of base64: a slow mobile network needs more than the default 15 s. */
const UPLOAD_TIMEOUT_MS = 60_000

export interface UploadPhotoParams {
	base64: string
	thumbBase64: string
	width: number
	height: number
}

interface UploadPhotoOptions {
	/** 0..1 while the body is on its way to the API. */
	onUploadProgress?: (ratio: number) => void
}

const toRatio = (loaded: number, total: number | undefined): number =>
	total ? Math.min(1, Math.max(0, loaded / total)) : 0

/** Step 1 of sending a photo: the file goes to storage ahead of the message that uses it. */
export const uploadPhoto = async (
	{ base64, thumbBase64, width, height }: UploadPhotoParams,
	{ onUploadProgress }: UploadPhotoOptions = {},
): Promise<UploadPhotoResponse> => {
	const response = await httpClient.post<unknown>(
		'/photos',
		{
			photo: { mimeType: UPLOAD_PHOTO_MIME_TYPE, data: base64 },
			thumb: { mimeType: UPLOAD_PHOTO_MIME_TYPE, data: thumbBase64 },
			width,
			height,
		},
		{
			timeout: UPLOAD_TIMEOUT_MS,
			onUploadProgress: onUploadProgress
				? (event) => {
						onUploadProgress(toRatio(event.loaded, event.total))
					}
				: undefined,
		},
	)
	return responseSchema.parse(response.data).data
}
