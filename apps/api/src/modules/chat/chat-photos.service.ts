import { Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'

import type { PhotoPayload } from '../../common/photo'
import type { Env } from '../../config'
import type { MessageStoredFile } from '../photos/photos.repository'
import { PhotosService } from '../photos/photos.service'
import { SUPPORTED_PHOTOS_PER_MESSAGE } from './chat.constants'
import { TooManyPhotosException } from './chat.exceptions'

export interface StoredPhotos {
	files: MessageStoredFile[]
	/** The image the model gets: the bytes are read before the message exists. */
	payload: PhotoPayload
}

/** Stored photos of a message: how many are allowed, whose they are, and their bytes for the model. */
@Injectable()
export class ChatPhotosService {
	private readonly maxPhotos: number

	constructor(
		private readonly photosService: PhotosService,
		config: ConfigService<Env, true>,
	) {
		this.maxPhotos = Math.min(
			config.get('PHOTOS_PER_MESSAGE_MAX', { infer: true }),
			SUPPORTED_PHOTOS_PER_MESSAGE,
		)
	}

	assertCount(photoIds: string[]): void {
		if (photoIds.length > this.maxPhotos) throw new TooManyPhotosException()
	}

	/** Another user's or a missing id is a 404, an unreadable storage a 503 — and no message is made. */
	async load(userId: string, photoIds: string[]): Promise<StoredPhotos> {
		const files = await this.photosService.getOwnedForMessage(userId, photoIds)
		const [first] = files
		// the DTO allows 1+ ids; the count check above allows only what the model reads
		if (!first) throw new TooManyPhotosException()
		return { files, payload: await this.photosService.readFullBytes(first) }
	}
}
