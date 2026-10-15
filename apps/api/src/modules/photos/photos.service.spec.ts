import { HttpStatus, Logger } from '@nestjs/common'
import type { ConfigService } from '@nestjs/config'
import { afterAll, afterEach, beforeEach, describe, expect, it, vi, type Mocked } from 'vitest'

import { AppException, type ErrorCode, ErrorCodes } from '../../common/exceptions'
import { PhotoPayload } from '../../common/photo'
import type { Env } from '../../config'
import type { AiUsageService } from '../ai/ai-usage.service'
import { MemoryStorageAdapter } from '../storage/memory.adapter'
import { StorageService } from '../storage/storage.service'
import type { UsersService } from '../users/users.service'
import type { OwnedStoredFile, PhotosRepository } from './photos.repository'
import { PhotosService } from './photos.service'

const USER_ID = '0192a000-0000-7000-8000-000000000001'
const OTHER_USER_ID = '0192a000-0000-7000-8000-000000000002'
const FILE_ID = '0192a000-0000-7000-8000-0000000000aa'
const KEY_PREFIX = 'test'
const UPLOAD_LIMIT = 5
const AI_PHOTO_LIMIT = 3
const FULL_BYTES = Buffer.from('full-photo-bytes')
const THUMB_BYTES = Buffer.from('thumb-bytes')
const USER_KEY_PREFIX = `${KEY_PREFIX}/users/${USER_ID}/photos/`

const createBody = () => ({
	// sizes differ from anything a request could claim: the response must come from the payload
	photo: new PhotoPayload('image/jpeg', FULL_BYTES, 1200, 900),
	thumb: new PhotoPayload('image/jpeg', THUMB_BYTES, 768, 576),
})

const ownedFile = (overrides: Partial<OwnedStoredFile> = {}): OwnedStoredFile => ({
	id: FILE_ID,
	storageKey: `${USER_KEY_PREFIX}${FILE_ID}`,
	thumbKey: `${USER_KEY_PREFIX}${FILE_ID}-thumb`,
	mimeType: 'image/jpeg',
	attachment: null,
	...overrides,
})

interface ExpectedError {
	status: HttpStatus
	errorCode: ErrorCode
	details?: Record<string, unknown>
}

const expectAppError = async (
	promise: Promise<unknown>,
	{ status, errorCode, details }: ExpectedError,
): Promise<void> => {
	const error: unknown = await promise.then(
		() => null,
		(caught: unknown) => caught,
	)
	expect(error).toBeInstanceOf(AppException)
	const appError = error as AppException
	expect(appError.getStatus()).toBe(status)
	expect(appError.errorCode).toBe(errorCode)
	if (details) expect(appError.details).toEqual(details)
}

describe('PhotosService', () => {
	const logSpies = [
		vi.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined),
		vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined),
		vi.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined),
	]
	let adapter: MemoryStorageAdapter
	let repository: Mocked<
		Pick<PhotosRepository, 'create' | 'countCreatedSince' | 'findOwned' | 'deleteUnattached'>
	>
	let aiUsage: Mocked<Pick<AiUsageService, 'isPhotoLimitReached' | 'getDailyPhotoLimit'>>
	let users: { getMe: ReturnType<typeof vi.fn> }
	let service: PhotosService

	const setTimezone = (timezone: string): void => {
		users.getMe.mockResolvedValue({ timezone })
	}

	const countStored = async (keys: string[]): Promise<number> => {
		const found = await Promise.all(keys.map((key) => adapter.getObject(key)))
		return found.filter((object) => object !== null).length
	}

	beforeEach(() => {
		adapter = new MemoryStorageAdapter()
		repository = {
			create: vi.fn().mockResolvedValue(undefined),
			countCreatedSince: vi.fn().mockResolvedValue(0),
			findOwned: vi.fn().mockResolvedValue(null),
			deleteUnattached: vi.fn().mockResolvedValue(true),
		}
		aiUsage = {
			isPhotoLimitReached: vi.fn().mockResolvedValue(false),
			getDailyPhotoLimit: vi.fn().mockReturnValue(AI_PHOTO_LIMIT),
		}
		users = { getMe: vi.fn().mockResolvedValue({ timezone: 'UTC' }) }
		const values: Record<string, unknown> = {
			STORAGE_KEY_PREFIX: KEY_PREFIX,
			PHOTO_DAILY_UPLOAD_LIMIT: UPLOAD_LIMIT,
		}
		const config = { get: (key: string) => values[key] } as unknown as ConfigService<Env, true>
		service = new PhotosService(
			repository as unknown as PhotosRepository,
			new StorageService(adapter),
			aiUsage as unknown as AiUsageService,
			users as unknown as UsersService,
			config,
		)
	})

	afterEach(() => {
		vi.useRealTimers()
		vi.restoreAllMocks()
		for (const spy of logSpies) spy.mockImplementation(() => undefined)
	})

	afterAll(() => {
		for (const spy of logSpies) spy.mockRestore()
	})

	describe('upload', () => {
		it('stores both objects under the user prefix, creates the row and answers with the real sizes', async () => {
			const result = await service.upload(USER_ID, createBody())

			expect(result).toMatchObject({ width: 1200, height: 900 })
			const data = repository.create.mock.calls[0]?.[0]
			expect(data).toMatchObject({
				id: result.id,
				userId: USER_ID,
				width: 1200,
				height: 900,
				sizeBytes: FULL_BYTES.length,
				thumbSizeBytes: THUMB_BYTES.length,
			})
			expect(data?.storageKey).toBe(`${USER_KEY_PREFIX}${result.id}`)
			expect(data?.thumbKey).toBe(`${USER_KEY_PREFIX}${result.id}-thumb`)
			const full = await adapter.getObject(data?.storageKey ?? '')
			const thumb = await adapter.getObject(data?.thumbKey ?? '')
			expect(full).toEqual({ body: FULL_BYTES, contentType: 'image/jpeg' })
			expect(thumb).toEqual({ body: THUMB_BYTES, contentType: 'image/jpeg' })
		})

		it('removes the first object and answers 503 when the second put fails', async () => {
			const originalPut = adapter.putObject
			const put = vi.spyOn(adapter, 'putObject')
			put.mockImplementationOnce(originalPut)
			put.mockRejectedValueOnce(new Error('bucket kus-secret down'))

			await expectAppError(service.upload(USER_ID, createBody()), {
				status: HttpStatus.SERVICE_UNAVAILABLE,
				errorCode: ErrorCodes.STORAGE_UNAVAILABLE,
			})

			expect(repository.create).not.toHaveBeenCalled()
			expect(put).toHaveBeenCalledTimes(2)
			const keys = put.mock.calls.map(([input]) => input.key)
			expect(keys.every((key) => key.startsWith(USER_KEY_PREFIX))).toBe(true)
			expect(await countStored(keys)).toBe(0)
		})

		it('removes both objects and rethrows the error when the row cannot be created', async () => {
			const failure = new Error('db down')
			repository.create.mockRejectedValue(failure)
			const put = vi.spyOn(adapter, 'putObject')

			await expect(service.upload(USER_ID, createBody())).rejects.toBe(failure)

			const keys = put.mock.calls.map(([input]) => input.key)
			expect(keys).toHaveLength(2)
			expect(await countStored(keys)).toBe(0)
		})

		it('still rethrows the original error when the cleanup itself fails', async () => {
			const failure = new Error('db down')
			repository.create.mockRejectedValue(failure)
			vi.spyOn(adapter, 'deleteObject').mockRejectedValue(new Error('storage down'))

			await expect(service.upload(USER_ID, createBody())).rejects.toBe(failure)
		})

		it('refuses with the AI limit first, before even counting the uploads', async () => {
			vi.useFakeTimers({ now: new Date('2026-10-15T10:00:00Z') })
			setTimezone('Europe/Warsaw')
			aiUsage.isPhotoLimitReached.mockResolvedValue(true)
			repository.countCreatedSince.mockResolvedValue(UPLOAD_LIMIT)
			const put = vi.spyOn(adapter, 'putObject')

			await expectAppError(service.upload(USER_ID, createBody()), {
				status: HttpStatus.TOO_MANY_REQUESTS,
				errorCode: ErrorCodes.DAILY_PHOTO_LIMIT_REACHED,
				details: { limit: AI_PHOTO_LIMIT, resetsAt: '2026-10-15T22:00:00.000Z' },
			})

			expect(repository.countCreatedSince).not.toHaveBeenCalled()
			expect(repository.create).not.toHaveBeenCalled()
			expect(put).not.toHaveBeenCalled()
		})

		it('asks the AI limit for the user local day', async () => {
			vi.useFakeTimers({ now: new Date('2026-10-15T22:30:00Z') })
			setTimezone('Europe/Warsaw')

			await service.upload(USER_ID, createBody())

			expect(aiUsage.isPhotoLimitReached).toHaveBeenCalledWith({
				userId: USER_ID,
				localDate: new Date('2026-10-16T00:00:00Z'),
			})
		})

		it('refuses at the daily upload limit, with the upload limit in details', async () => {
			vi.useFakeTimers({ now: new Date('2026-10-15T10:00:00Z') })
			setTimezone('Europe/Warsaw')
			repository.countCreatedSince.mockResolvedValue(UPLOAD_LIMIT)
			const put = vi.spyOn(adapter, 'putObject')

			await expectAppError(service.upload(USER_ID, createBody()), {
				status: HttpStatus.TOO_MANY_REQUESTS,
				errorCode: ErrorCodes.DAILY_PHOTO_LIMIT_REACHED,
				details: { limit: UPLOAD_LIMIT, resetsAt: '2026-10-15T22:00:00.000Z' },
			})

			expect(repository.create).not.toHaveBeenCalled()
			expect(put).not.toHaveBeenCalled()
		})

		it('lets the last photo of the day through', async () => {
			repository.countCreatedSince.mockResolvedValue(UPLOAD_LIMIT - 1)

			await expect(service.upload(USER_ID, createBody())).resolves.toMatchObject({ width: 1200 })
		})

		it('counts uploads since the start of the user local day', async () => {
			vi.useFakeTimers({ now: new Date('2026-10-15T10:00:00Z') })
			setTimezone('Europe/Warsaw')

			await service.upload(USER_ID, createBody())

			expect(repository.countCreatedSince).toHaveBeenCalledWith({
				userId: USER_ID,
				since: new Date('2026-10-14T22:00:00Z'),
			})
		})

		it.each([
			['Warsaw, summer time', 'Europe/Warsaw', '2026-10-15T10:00:00Z', '2026-10-15T22:00:00.000Z'],
			[
				'Warsaw, last second before local midnight',
				'Europe/Warsaw',
				'2026-10-15T21:59:59Z',
				'2026-10-15T22:00:00.000Z',
			],
			[
				'Warsaw, exactly local midnight',
				'Europe/Warsaw',
				'2026-10-15T22:00:00Z',
				'2026-10-16T22:00:00.000Z',
			],
			[
				'Warsaw, day before the DST end',
				'Europe/Warsaw',
				'2026-10-24T12:00:00Z',
				'2026-10-24T22:00:00.000Z',
			],
			[
				'Warsaw, the 25-hour day of the DST end',
				'Europe/Warsaw',
				'2026-10-25T08:00:00Z',
				'2026-10-25T23:00:00.000Z',
			],
			[
				'Warsaw, the 23-hour day of the DST start',
				'Europe/Warsaw',
				'2026-03-29T10:00:00Z',
				'2026-03-29T22:00:00.000Z',
			],
			['Warsaw, winter time', 'Europe/Warsaw', '2026-01-15T12:00:00Z', '2026-01-15T23:00:00.000Z'],
			[
				'Los Angeles, still the previous UTC day',
				'America/Los_Angeles',
				'2026-10-15T05:00:00Z',
				'2026-10-15T07:00:00.000Z',
			],
			[
				'Auckland, ahead of UTC',
				'Pacific/Auckland',
				'2026-10-15T10:00:00Z',
				'2026-10-15T11:00:00.000Z',
			],
			['UTC, last second of the day', 'UTC', '2026-10-15T23:59:59Z', '2026-10-16T00:00:00.000Z'],
		])('resetsAt is the next local midnight: %s', async (_name, timezone, now, expected) => {
			vi.useFakeTimers({ now: new Date(now) })
			setTimezone(timezone)
			aiUsage.isPhotoLimitReached.mockResolvedValue(true)

			await expectAppError(service.upload(USER_ID, createBody()), {
				status: HttpStatus.TOO_MANY_REQUESTS,
				errorCode: ErrorCodes.DAILY_PHOTO_LIMIT_REACHED,
				details: { limit: AI_PHOTO_LIMIT, resetsAt: expected },
			})
		})
	})

	describe('getFile', () => {
		it('returns the full photo and the thumbnail from different objects', async () => {
			const file = ownedFile()
			repository.findOwned.mockResolvedValue(file)
			await adapter.putObject({ key: file.storageKey, body: FULL_BYTES, contentType: 'image/jpeg' })
			await adapter.putObject({ key: file.thumbKey, body: THUMB_BYTES, contentType: 'image/jpeg' })

			const full = await service.getFile(USER_ID, FILE_ID, 'full')
			const thumb = await service.getFile(USER_ID, FILE_ID, 'thumb')

			expect(full).toEqual({ body: FULL_BYTES, contentType: 'image/jpeg' })
			expect(thumb).toEqual({ body: THUMB_BYTES, contentType: 'image/jpeg' })
		})

		it('looks the file up by id and owner, so another user gets not-found', async () => {
			await expectAppError(service.getFile(OTHER_USER_ID, FILE_ID, 'full'), {
				status: HttpStatus.NOT_FOUND,
				errorCode: ErrorCodes.PHOTO_NOT_FOUND,
			})

			expect(repository.findOwned).toHaveBeenCalledWith({ id: FILE_ID, userId: OTHER_USER_ID })
		})

		it('is not found when the row exists but its object is gone', async () => {
			repository.findOwned.mockResolvedValue(ownedFile())

			await expectAppError(service.getFile(USER_ID, FILE_ID, 'full'), {
				status: HttpStatus.NOT_FOUND,
				errorCode: ErrorCodes.PHOTO_NOT_FOUND,
			})
		})
	})

	describe('remove', () => {
		it('deletes both objects, then the row', async () => {
			const file = ownedFile()
			repository.findOwned.mockResolvedValue(file)
			await adapter.putObject({ key: file.storageKey, body: FULL_BYTES, contentType: 'image/jpeg' })
			await adapter.putObject({ key: file.thumbKey, body: THUMB_BYTES, contentType: 'image/jpeg' })
			const order: string[] = []
			const originalDelete = adapter.deleteObject
			vi.spyOn(adapter, 'deleteObject').mockImplementation((key) => {
				order.push(`object:${key}`)
				return originalDelete(key)
			})
			repository.deleteUnattached.mockImplementation(() => {
				order.push('row')
				return Promise.resolve(true)
			})

			await service.remove(USER_ID, FILE_ID)

			expect(order).toEqual([`object:${file.storageKey}`, `object:${file.thumbKey}`, 'row'])
			expect(await countStored([file.storageKey, file.thumbKey])).toBe(0)
			expect(repository.deleteUnattached).toHaveBeenCalledWith({ id: FILE_ID, userId: USER_ID })
		})

		it('refuses a photo a message uses and touches nothing', async () => {
			repository.findOwned.mockResolvedValue(ownedFile({ attachment: { id: 'att' } }))
			const del = vi.spyOn(adapter, 'deleteObject')

			await expectAppError(service.remove(USER_ID, FILE_ID), {
				status: HttpStatus.CONFLICT,
				errorCode: ErrorCodes.PHOTO_IN_USE,
			})

			expect(del).not.toHaveBeenCalled()
			expect(repository.deleteUnattached).not.toHaveBeenCalled()
		})

		it('is not found for another user and deletes nothing', async () => {
			const del = vi.spyOn(adapter, 'deleteObject')

			await expectAppError(service.remove(OTHER_USER_ID, FILE_ID), {
				status: HttpStatus.NOT_FOUND,
				errorCode: ErrorCodes.PHOTO_NOT_FOUND,
			})

			expect(repository.findOwned).toHaveBeenCalledWith({ id: FILE_ID, userId: OTHER_USER_ID })
			expect(del).not.toHaveBeenCalled()
			expect(repository.deleteUnattached).not.toHaveBeenCalled()
		})

		it('keeps the row for a retry when the storage fails', async () => {
			repository.findOwned.mockResolvedValue(ownedFile())
			vi.spyOn(adapter, 'deleteObject').mockRejectedValue(new Error('storage down'))

			await expectAppError(service.remove(USER_ID, FILE_ID), {
				status: HttpStatus.SERVICE_UNAVAILABLE,
				errorCode: ErrorCodes.STORAGE_UNAVAILABLE,
			})

			expect(repository.deleteUnattached).not.toHaveBeenCalled()
		})

		it('treats a parallel delete that already finished as done, not as an error', async () => {
			repository.findOwned.mockResolvedValueOnce(ownedFile()).mockResolvedValueOnce(null)
			repository.deleteUnattached.mockResolvedValue(false)

			await expect(service.remove(USER_ID, FILE_ID)).resolves.toBeUndefined()
		})

		it('answers PHOTO_IN_USE when a message took the file between the check and the delete', async () => {
			repository.findOwned.mockResolvedValue(ownedFile())
			repository.deleteUnattached.mockResolvedValue(false)

			await expectAppError(service.remove(USER_ID, FILE_ID), {
				status: HttpStatus.CONFLICT,
				errorCode: ErrorCodes.PHOTO_IN_USE,
			})
		})
	})
})
