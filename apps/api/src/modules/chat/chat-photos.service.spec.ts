import { HttpStatus } from '@nestjs/common'
import type { ConfigService } from '@nestjs/config'
import { beforeEach, describe, expect, it, vi, type Mocked } from 'vitest'

import { AppException, ErrorCodes } from '../../common/exceptions'
import { PhotoPayload } from '../../common/photo'
import type { Env } from '../../config'
import { PhotoNotFoundException } from '../photos/photos.exceptions'
import type { MessageStoredFile } from '../photos/photos.repository'
import type { PhotosService } from '../photos/photos.service'
import { ChatPhotosService } from './chat-photos.service'

const USER_ID = '0192a000-0000-7000-8000-000000000001'
const FILE_A = '0192a000-0000-7000-8000-0000000000a1'
const FILE_B = '0192a000-0000-7000-8000-0000000000b2'
const ENV_ABOVE_SUPPORTED = 6

const storedFile = (id: string): MessageStoredFile => ({
	id,
	storageKey: `test/users/${USER_ID}/photos/${id}`,
	width: 1200,
	height: 900,
	sizeBytes: 100,
	mimeType: 'image/jpeg',
})

const createService = (
	photosService: Mocked<Pick<PhotosService, 'getOwnedForMessage' | 'readFullBytes'>>,
	photosPerMessageMax: number,
): ChatPhotosService => {
	const config = {
		get: (key: string) => (key === 'PHOTOS_PER_MESSAGE_MAX' ? photosPerMessageMax : undefined),
	} as unknown as ConfigService<Env, true>
	return new ChatPhotosService(photosService as unknown as PhotosService, config)
}

const catchAppError = async (action: () => unknown): Promise<AppException> => {
	const error: unknown = await Promise.resolve()
		.then(action)
		.then(
			() => null,
			(caught: unknown) => caught,
		)
	expect(error).toBeInstanceOf(AppException)
	return error as AppException
}

describe('ChatPhotosService', () => {
	let photosService: Mocked<Pick<PhotosService, 'getOwnedForMessage' | 'readFullBytes'>>
	const payload = new PhotoPayload('image/jpeg', Buffer.from('bytes'), 1200, 900)

	beforeEach(() => {
		photosService = {
			getOwnedForMessage: vi.fn().mockResolvedValue([storedFile(FILE_A)]),
			readFullBytes: vi.fn().mockResolvedValue(payload),
		}
	})

	describe('assertCount', () => {
		it.each([
			['the env allows 6', ENV_ABOVE_SUPPORTED],
			['the env allows 1', 1],
		])('takes one photo when %s', (_name, max) => {
			expect(() => {
				createService(photosService, max).assertCount([FILE_A])
			}).not.toThrow()
		})

		it('refuses a second photo with fields.photoIds=TOO_MANY while the model reads one image, whatever the env allows', async () => {
			const error = await catchAppError(() => {
				createService(photosService, ENV_ABOVE_SUPPORTED).assertCount([FILE_A, FILE_B])
			})

			expect(error.getStatus()).toBe(HttpStatus.UNPROCESSABLE_ENTITY)
			expect(error.errorCode).toBe(ErrorCodes.VALIDATION_ERROR)
			expect(error.details).toEqual({ fields: { photoIds: 'TOO_MANY' } })
		})

		it('refuses a second photo when the env allows only 1', async () => {
			const error = await catchAppError(() => {
				createService(photosService, 1).assertCount([FILE_A, FILE_B])
			})

			expect(error.details).toEqual({ fields: { photoIds: 'TOO_MANY' } })
		})

		it('does not look anything up', async () => {
			await catchAppError(() => {
				createService(photosService, 1).assertCount([FILE_A, FILE_B])
			})

			expect(photosService.getOwnedForMessage).not.toHaveBeenCalled()
		})
	})

	describe('load', () => {
		it('returns the owned files and the bytes of the first one', async () => {
			const files = [storedFile(FILE_A)]
			photosService.getOwnedForMessage.mockResolvedValue(files)

			const stored = await createService(photosService, 1).load(USER_ID, [FILE_A])

			expect(photosService.getOwnedForMessage).toHaveBeenCalledWith(USER_ID, [FILE_A])
			expect(photosService.readFullBytes).toHaveBeenCalledWith(files[0])
			expect(stored.files).toBe(files)
			expect(stored.payload).toBe(payload)
		})

		it('does not read any bytes for a photo that is not the caller own', async () => {
			photosService.getOwnedForMessage.mockRejectedValue(new PhotoNotFoundException())

			const error = await catchAppError(() =>
				createService(photosService, 1).load(USER_ID, [FILE_A]),
			)

			expect(error.getStatus()).toBe(HttpStatus.NOT_FOUND)
			expect(error.errorCode).toBe(ErrorCodes.PHOTO_NOT_FOUND)
			expect(photosService.readFullBytes).not.toHaveBeenCalled()
		})

		it('passes a failed byte read (404 or 503) through unchanged', async () => {
			photosService.readFullBytes.mockRejectedValue(new PhotoNotFoundException())

			const error = await catchAppError(() =>
				createService(photosService, 1).load(USER_ID, [FILE_A]),
			)

			expect(error.errorCode).toBe(ErrorCodes.PHOTO_NOT_FOUND)
		})

		it('refuses an empty list instead of sending a message without an image', async () => {
			photosService.getOwnedForMessage.mockResolvedValue([])

			const error = await catchAppError(() => createService(photosService, 1).load(USER_ID, []))

			expect(error.details).toEqual({ fields: { photoIds: 'TOO_MANY' } })
			expect(photosService.readFullBytes).not.toHaveBeenCalled()
		})
	})
})
