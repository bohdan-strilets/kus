import { uploadPhoto } from '../api/upload-photo'
import { type OutboxPhoto, useOutboxStore } from './outbox-store'
import { usePhotoSessionStore } from './photo-session-store'

/**
 * Step 1 of sending a photo: the file goes to storage and its id is written into the outbox item
 * at once, so a failed step 2 (or a reload) never uploads the same photo again.
 */
export const uploadOutboxPhoto = async (
	clientMessageId: string,
	photo: OutboxPhoto,
): Promise<string> => {
	const session = usePhotoSessionStore.getState()
	session.setUploadProgress(clientMessageId, 0)
	try {
		const { id } = await uploadPhoto(
			{
				base64: photo.base64,
				thumbBase64: photo.thumbBase64,
				width: photo.width,
				height: photo.height,
			},
			{
				onUploadProgress: (ratio) => {
					session.setUploadProgress(clientMessageId, ratio)
				},
			},
		)
		useOutboxStore.getState().setPhotoId(clientMessageId, id)
		return id
	} finally {
		// the message itself carries no heavy body: from here the feed shows «думає», not «надсилаю»
		session.clearUploadProgress(clientMessageId)
	}
}
