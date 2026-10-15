import { randomUUID } from 'node:crypto'
import { Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { type PhotoVariant, UPLOAD_PHOTO_MIME_TYPE, type UploadPhotoResponse } from '@kus/shared'

import { PhotoPayload } from '../../common/photo'
import { addDays, getLocalDate, getZonedMoment } from '../../common/time'
import type { Env } from '../../config'
import { PrismaService } from '../../prisma'
import { AiUsageService } from '../ai/ai-usage.service'
import { DailyPhotoLimitReachedException } from '../ai/ai.exceptions'
import { buildStorageKey } from '../storage/storage-key'
import { StorageService } from '../storage/storage.service'
import { UsersService } from '../users/users.service'
import type { UploadPhotoBody } from './dto'
import { PhotoInUseException, PhotoNotFoundException } from './photos.exceptions'
import { type MessageStoredFile, PhotosRepository } from './photos.repository'

const PHOTO_CONTENT_TYPE = 'image/jpeg'
const START_OF_DAY_HOUR = 0
// two object deletes inside the transaction: far above the 5 s default, below a hanging request
const REMOVE_TRANSACTION_TIMEOUT_MS = 15_000

export interface PhotoFile {
	body: Buffer
	contentType: string
}

/** Uploaded message photos in object storage: the bytes live there, the row only describes them. */
@Injectable()
export class PhotosService {
	private readonly logger = new Logger(PhotosService.name)
	private readonly keyPrefix: string
	private readonly dailyUploadLimit: number

	constructor(
		private readonly prisma: PrismaService,
		private readonly photosRepository: PhotosRepository,
		private readonly storage: StorageService,
		private readonly aiUsage: AiUsageService,
		private readonly usersService: UsersService,
		config: ConfigService<Env, true>,
	) {
		this.keyPrefix = config.get('STORAGE_KEY_PREFIX', { infer: true })
		this.dailyUploadLimit = config.get('PHOTO_DAILY_UPLOAD_LIMIT', { infer: true })
	}

	async upload(userId: string, { photo, thumb }: UploadPhotoBody): Promise<UploadPhotoResponse> {
		await this.assertUploadAllowed(userId)

		const id = randomUUID()
		const keyParts = { prefix: this.keyPrefix, userId, kind: 'photos', fileId: id } as const
		const storageKey = buildStorageKey(keyParts)
		const thumbKey = buildStorageKey({ ...keyParts, variant: 'thumb' })
		try {
			await this.storage.putObject({
				key: storageKey,
				body: photo.bytes,
				contentType: PHOTO_CONTENT_TYPE,
			})
			await this.storage.putObject({
				key: thumbKey,
				body: thumb.bytes,
				contentType: PHOTO_CONTENT_TYPE,
			})
			await this.photosRepository.create({
				id,
				userId,
				storageKey,
				thumbKey,
				width: photo.width,
				height: photo.height,
				sizeBytes: photo.sizeBytes,
				thumbSizeBytes: thumb.sizeBytes,
			})
		} catch (error) {
			// without a row nothing would ever delete these objects
			await this.removeObjectsQuietly([storageKey, thumbKey])
			throw error
		}
		this.logger.log(`Photo uploaded user=${userId} file=${id}`)
		return { id, width: photo.width, height: photo.height }
	}

	async getFile(userId: string, id: string, variant: PhotoVariant): Promise<PhotoFile> {
		const file = await this.photosRepository.findOwned({ id, userId })
		if (!file) throw new PhotoNotFoundException()
		const stored = await this.storage.getObject(
			variant === 'thumb' ? file.thumbKey : file.storageKey,
		)
		if (!stored) {
			this.logger.warn(`Photo row without an object user=${userId} file=${id}`)
			throw new PhotoNotFoundException()
		}
		return { body: stored.body, contentType: file.mimeType }
	}

	/**
	 * The user's photos for a message, in the order of `ids`. Another user's id and a missing one
	 * are the same 404. Whether a message already uses a file is decided by the binding itself.
	 */
	async getOwnedForMessage(userId: string, ids: string[]): Promise<MessageStoredFile[]> {
		const files = await this.photosRepository.findManyOwned({ ids, userId })
		const byId = new Map(files.map((file) => [file.id, file]))
		return ids.map((id) => {
			const file = byId.get(id)
			if (!file) throw new PhotoNotFoundException()
			return file
		})
	}

	/** The full photo for the model; the bytes never leave a PhotoPayload (it prints as `[image …]`). */
	async readFullBytes({ id, storageKey, width, height }: MessageStoredFile): Promise<PhotoPayload> {
		const stored = await this.storage.getObject(storageKey)
		if (!stored) {
			this.logger.warn(`Photo row without an object file=${id}`)
			throw new PhotoNotFoundException()
		}
		return new PhotoPayload(UPLOAD_PHOTO_MIME_TYPE, stored.body, width, height)
	}

	/**
	 * Only a photo no message uses. One transaction: the row is locked (a message binding it waits
	 * or fails on the foreign key, so an attached photo never loses its bytes), deleted, and then
	 * its objects. A storage failure rolls the row back, so a retry works.
	 */
	async remove(userId: string, id: string): Promise<void> {
		const file = await this.photosRepository.findOwned({ id, userId })
		if (!file) throw new PhotoNotFoundException()

		await this.prisma.$transaction(
			async (tx) => {
				// a parallel delete finished first: its commit makes the row vanish for us
				if (!(await this.photosRepository.lockOwned({ id, userId }, tx))) {
					throw new PhotoNotFoundException()
				}
				// the row is ours and locked, so a miss means a message uses it
				if (!(await this.photosRepository.deleteUnattached({ id, userId }, tx))) {
					throw new PhotoInUseException()
				}
				await this.storage.deleteObject(file.storageKey)
				await this.storage.deleteObject(file.thumbKey)
			},
			{ timeout: REMOVE_TRANSACTION_TIMEOUT_MS },
		)
		this.logger.log(`Photo deleted user=${userId} file=${id}`)
	}

	/** Two limits, one answer: the daily uploads and the photos the AI would still take. */
	private async assertUploadAllowed(userId: string): Promise<void> {
		const { timezone } = await this.usersService.getMe(userId)
		const localDate = getLocalDate(new Date(), timezone)
		const resetsAt = getZonedMoment(addDays(localDate, 1), START_OF_DAY_HOUR, timezone)

		if (await this.aiUsage.isPhotoLimitReached({ userId, localDate })) {
			throw new DailyPhotoLimitReachedException(this.aiUsage.getDailyPhotoLimit(), resetsAt)
		}
		const uploadedToday = await this.photosRepository.countCreatedSince({
			userId,
			since: getZonedMoment(localDate, START_OF_DAY_HOUR, timezone),
		})
		if (uploadedToday >= this.dailyUploadLimit) {
			throw new DailyPhotoLimitReachedException(this.dailyUploadLimit, resetsAt)
		}
	}

	private async removeObjectsQuietly(keys: string[]): Promise<void> {
		const results = await Promise.allSettled(keys.map((key) => this.storage.deleteObject(key)))
		const failed = results.filter((result) => result.status === 'rejected').length
		if (failed > 0) this.logger.warn(`Could not clean up ${failed} object(s) of a failed upload`)
	}
}
