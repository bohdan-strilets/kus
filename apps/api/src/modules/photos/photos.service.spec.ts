import { inspect } from 'node:util'

import { HttpStatus, Logger } from '@nestjs/common'
import type { ConfigService } from '@nestjs/config'
import { afterAll, afterEach, beforeEach, describe, expect, it, vi, type Mocked } from 'vitest'

import { AppException, type ErrorCode, ErrorCodes } from '../../common/exceptions'
import { PhotoPayload } from '../../common/photo'
import type { PrismaService } from '../../prisma'
import type { Env } from '../../config'
import type { AiUsageService } from '../ai/ai-usage.service'
import { MemoryStorageAdapter } from '../storage/memory.adapter'
import { StorageService } from '../storage/storage.service'
import type { UsersService } from '../users/users.service'
import type { MessageStoredFile, OwnedStoredFile, PhotosRepository } from './photos.repository'
import { PhotosService, REMOVE_ATTACHED, REMOVE_DONE, REMOVE_NOT_FOUND } from './photos.service'

const USER_ID = '0192a000-0000-7000-8000-000000000001'
const OTHER_USER_ID = '0192a000-0000-7000-8000-000000000002'
const FILE_ID = '0192a000-0000-7000-8000-0000000000aa'
const TX = { isTransaction: true }
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
		Pick<
			PhotosRepository,
			| 'create'
			| 'countCreatedSince'
			| 'findOwned'
			| 'findManyOwned'
			| 'deleteUnattached'
			| 'lockOwned'
		>
	>
	/** Rows of the fake DB: a transaction keeps its changes only if the callback resolves. */
	let rows: Set<string>
	let transactionOptions: unknown[]
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
			findManyOwned: vi.fn().mockResolvedValue([]),
			lockOwned: vi.fn().mockResolvedValue(true),
		}
		rows = new Set([FILE_ID])
		transactionOptions = []
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
		const prisma = {
			$transaction: async (run: (tx: unknown) => Promise<unknown>, options?: unknown) => {
				transactionOptions.push(options)
				const before = new Set(rows)
				try {
					return await run(TX)
				} catch (error) {
					// a failed callback rolls the transaction back
					rows = before
					throw error
				}
			},
		}
		service = new PhotosService(
			prisma as unknown as PrismaService,
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

	describe('getOwnedForMessage', () => {
		const FILE_A = '0192a000-0000-7000-8000-0000000000a1'
		const FILE_B = '0192a000-0000-7000-8000-0000000000b2'
		const FILE_C = '0192a000-0000-7000-8000-0000000000c3'

		const messageFile = (id: string): MessageStoredFile => ({
			id,
			storageKey: `${USER_KEY_PREFIX}${id}`,
			width: 1200,
			height: 900,
			sizeBytes: FULL_BYTES.length,
			mimeType: 'image/jpeg',
		})

		const catchAppError = async (promise: Promise<unknown>): Promise<AppException> => {
			const error: unknown = await promise.then(
				() => null,
				(caught: unknown) => caught,
			)
			expect(error).toBeInstanceOf(AppException)
			return error as AppException
		}

		it('returns the files in the order of the ids, not the order the database answered in', async () => {
			repository.findManyOwned.mockResolvedValue([
				messageFile(FILE_C),
				messageFile(FILE_A),
				messageFile(FILE_B),
			])

			const files = await service.getOwnedForMessage(USER_ID, [FILE_B, FILE_C, FILE_A])

			expect(files.map((file) => file.id)).toEqual([FILE_B, FILE_C, FILE_A])
		})

		it('asks only for the files of this user', async () => {
			repository.findManyOwned.mockResolvedValue([messageFile(FILE_A)])

			await service.getOwnedForMessage(USER_ID, [FILE_A])

			expect(repository.findManyOwned).toHaveBeenCalledWith({ ids: [FILE_A], userId: USER_ID })
		})

		it('answers a missing id with PHOTO_NOT_FOUND even when the other ids exist', async () => {
			repository.findManyOwned.mockResolvedValue([messageFile(FILE_A)])

			await expectAppError(service.getOwnedForMessage(USER_ID, [FILE_A, FILE_B]), {
				status: HttpStatus.NOT_FOUND,
				errorCode: ErrorCodes.PHOTO_NOT_FOUND,
			})
		})

		it("answers another user's file exactly like an id that does not exist", async () => {
			// the repository filters by owner: for OTHER_USER_ID the file of USER_ID is simply not there
			repository.findManyOwned.mockResolvedValue([])

			const foreign = await catchAppError(service.getOwnedForMessage(OTHER_USER_ID, [FILE_A]))
			const absent = await catchAppError(service.getOwnedForMessage(USER_ID, [FILE_B]))

			expect(foreign.getStatus()).toBe(HttpStatus.NOT_FOUND)
			expect(foreign.getStatus()).toBe(absent.getStatus())
			expect(foreign.errorCode).toBe(absent.errorCode)
			expect(foreign.details).toEqual(absent.details)
			expect(repository.findManyOwned).toHaveBeenCalledWith({
				ids: [FILE_A],
				userId: OTHER_USER_ID,
			})
		})
	})

	describe('readFullBytes', () => {
		const file: MessageStoredFile = {
			id: FILE_ID,
			storageKey: `${USER_KEY_PREFIX}${FILE_ID}`,
			width: 1200,
			height: 900,
			sizeBytes: FULL_BYTES.length,
			mimeType: 'image/jpeg',
		}

		it('reads the full object and describes it with the stored size', async () => {
			await adapter.putObject({ key: file.storageKey, body: FULL_BYTES, contentType: 'image/jpeg' })

			const payload = await service.readFullBytes(file)

			expect(payload).toBeInstanceOf(PhotoPayload)
			expect(payload.bytes.equals(FULL_BYTES)).toBe(true)
			expect(payload).toMatchObject({ mimeType: 'image/jpeg', width: 1200, height: 900 })
		})

		it('is PHOTO_NOT_FOUND when the object is gone', async () => {
			await expectAppError(service.readFullBytes(file), {
				status: HttpStatus.NOT_FOUND,
				errorCode: ErrorCodes.PHOTO_NOT_FOUND,
			})
		})

		it('is STORAGE_UNAVAILABLE when the storage fails, without the failure text', async () => {
			vi.spyOn(adapter, 'getObject').mockRejectedValue(new Error('bucket kus-secret down'))

			const error: unknown = await service.readFullBytes(file).then(
				() => null,
				(caught: unknown) => caught,
			)

			expect(error).toBeInstanceOf(AppException)
			expect((error as AppException).getStatus()).toBe(HttpStatus.SERVICE_UNAVAILABLE)
			expect((error as AppException).errorCode).toBe(ErrorCodes.STORAGE_UNAVAILABLE)
			expect(JSON.stringify((error as AppException).getResponse())).not.toContain('kus-secret')
		})

		it('hides the bytes from toString, JSON and inspect', async () => {
			const secret = Buffer.from('PIXELS-THAT-MUST-NOT-LEAK')
			await adapter.putObject({ key: file.storageKey, body: secret, contentType: 'image/jpeg' })

			const payload = await service.readFullBytes(file)

			for (const printed of [
				String(payload),
				JSON.stringify({ payload }),
				inspect(payload),
				inspect({ nested: { payload } }, { depth: 6 }),
			]) {
				expect(printed).toContain('[image')
				expect(printed).not.toContain('PIXELS')
				expect(printed).not.toContain(secret.toString('base64'))
			}
		})
	})

	describe('remove', () => {
		const file = ownedFile()
		const putBoth = async (): Promise<void> => {
			await adapter.putObject({ key: file.storageKey, body: FULL_BYTES, contentType: 'image/jpeg' })
			await adapter.putObject({ key: file.thumbKey, body: THUMB_BYTES, contentType: 'image/jpeg' })
		}

		/** The repository on the fake rows: deleting changes them, the transaction decides if it stays. */
		const wireRows = (): void => {
			repository.findOwned.mockResolvedValue(file)
			repository.lockOwned.mockImplementation(() => Promise.resolve(rows.has(FILE_ID)))
			repository.deleteUnattached.mockImplementation(() => Promise.resolve(rows.delete(FILE_ID)))
		}

		it('locks the row, deletes it, then both objects, all inside one transaction', async () => {
			wireRows()
			await putBoth()
			const order: string[] = []
			repository.lockOwned.mockImplementation(() => {
				order.push('lock')
				return Promise.resolve(true)
			})
			repository.deleteUnattached.mockImplementation(() => {
				order.push('row')
				return Promise.resolve(rows.delete(FILE_ID))
			})
			const originalDelete = adapter.deleteObject
			vi.spyOn(adapter, 'deleteObject').mockImplementation((key) => {
				order.push(`object:${key}`)
				return originalDelete(key)
			})

			await service.remove(USER_ID, FILE_ID)

			expect(order).toEqual(['lock', 'row', `object:${file.storageKey}`, `object:${file.thumbKey}`])
			expect(transactionOptions).toHaveLength(1)
			expect(repository.lockOwned).toHaveBeenCalledWith({ id: FILE_ID, userId: USER_ID }, TX)
			expect(repository.deleteUnattached).toHaveBeenCalledWith({ id: FILE_ID, userId: USER_ID }, TX)
			expect(rows.has(FILE_ID)).toBe(false)
			expect(await countStored([file.storageKey, file.thumbKey])).toBe(0)
		})

		it('gives the transaction a timeout above the 5 s default, for two object deletes', async () => {
			wireRows()

			await service.remove(USER_ID, FILE_ID)

			const [options] = transactionOptions as [{ timeout: number }]
			expect(options.timeout).toBeGreaterThan(5000)
		})

		it('answers PHOTO_IN_USE and touches no object when a message has taken the file', async () => {
			wireRows()
			await putBoth()
			repository.deleteUnattached.mockResolvedValue(false)
			const del = vi.spyOn(adapter, 'deleteObject')

			await expectAppError(service.remove(USER_ID, FILE_ID), {
				status: HttpStatus.CONFLICT,
				errorCode: ErrorCodes.PHOTO_IN_USE,
			})

			expect(del).not.toHaveBeenCalled()
			expect(await countStored([file.storageKey, file.thumbKey])).toBe(2)
			expect(rows.has(FILE_ID)).toBe(true)
		})

		it('answers PHOTO_NOT_FOUND when the lock finds no row (a parallel delete finished first)', async () => {
			wireRows()
			await putBoth()
			repository.lockOwned.mockResolvedValue(false)
			const del = vi.spyOn(adapter, 'deleteObject')

			await expectAppError(service.remove(USER_ID, FILE_ID), {
				status: HttpStatus.NOT_FOUND,
				errorCode: ErrorCodes.PHOTO_NOT_FOUND,
			})

			expect(repository.deleteUnattached).not.toHaveBeenCalled()
			expect(del).not.toHaveBeenCalled()
		})

		it('is not found for another user: no transaction, no lock, no object deleted', async () => {
			const del = vi.spyOn(adapter, 'deleteObject')

			await expectAppError(service.remove(OTHER_USER_ID, FILE_ID), {
				status: HttpStatus.NOT_FOUND,
				errorCode: ErrorCodes.PHOTO_NOT_FOUND,
			})

			expect(repository.findOwned).toHaveBeenCalledWith({ id: FILE_ID, userId: OTHER_USER_ID })
			expect(transactionOptions).toHaveLength(0)
			expect(repository.lockOwned).not.toHaveBeenCalled()
			expect(repository.deleteUnattached).not.toHaveBeenCalled()
			expect(del).not.toHaveBeenCalled()
		})

		it('rolls the row back and answers 503 when the first object delete fails', async () => {
			wireRows()
			await putBoth()
			vi.spyOn(adapter, 'deleteObject').mockRejectedValue(new Error('storage down'))

			await expectAppError(service.remove(USER_ID, FILE_ID), {
				status: HttpStatus.SERVICE_UNAVAILABLE,
				errorCode: ErrorCodes.STORAGE_UNAVAILABLE,
			})

			expect(rows.has(FILE_ID)).toBe(true)
		})

		it('rolls the row back and answers 503 when only the thumbnail delete fails, and a retry finishes', async () => {
			wireRows()
			await putBoth()
			const originalDelete = adapter.deleteObject
			const del = vi.spyOn(adapter, 'deleteObject')
			del.mockImplementationOnce(originalDelete)
			del.mockRejectedValueOnce(new Error('storage down'))

			await expectAppError(service.remove(USER_ID, FILE_ID), {
				status: HttpStatus.SERVICE_UNAVAILABLE,
				errorCode: ErrorCodes.STORAGE_UNAVAILABLE,
			})

			expect(rows.has(FILE_ID)).toBe(true)
			await expect(service.remove(USER_ID, FILE_ID)).resolves.toBeUndefined()
			expect(rows.has(FILE_ID)).toBe(false)
			expect(await countStored([file.storageKey, file.thumbKey])).toBe(0)
		})

		it('deletes the objects under the keys of the owned file', async () => {
			wireRows()
			const del = vi.spyOn(adapter, 'deleteObject')

			await service.remove(USER_ID, FILE_ID)

			expect(del.mock.calls.map(([key]) => key)).toEqual([file.storageKey, file.thumbKey])
		})
	})

	describe('removeUnattached', () => {
		const file = ownedFile()
		const putBoth = async (): Promise<void> => {
			await adapter.putObject({ key: file.storageKey, body: FULL_BYTES, contentType: 'image/jpeg' })
			await adapter.putObject({ key: file.thumbKey, body: THUMB_BYTES, contentType: 'image/jpeg' })
		}
		const wireRows = (): void => {
			repository.findOwned.mockResolvedValue(file)
			repository.lockOwned.mockImplementation(() => Promise.resolve(rows.has(FILE_ID)))
			repository.deleteUnattached.mockImplementation(() => Promise.resolve(rows.delete(FILE_ID)))
		}

		it('returns removed, deletes row and both objects, in the order lock, row, full, thumb', async () => {
			wireRows()
			await putBoth()
			const order: string[] = []
			repository.lockOwned.mockImplementation(() => {
				order.push('lock')
				return Promise.resolve(true)
			})
			repository.deleteUnattached.mockImplementation(() => {
				order.push('row')
				return Promise.resolve(rows.delete(FILE_ID))
			})
			const originalDelete = adapter.deleteObject
			vi.spyOn(adapter, 'deleteObject').mockImplementation((key) => {
				order.push(`object:${key}`)
				return originalDelete(key)
			})

			const result = await service.removeUnattached(USER_ID, FILE_ID)

			expect(result).toBe(REMOVE_DONE)
			expect(order).toEqual(['lock', 'row', `object:${file.storageKey}`, `object:${file.thumbKey}`])
			expect(rows.has(FILE_ID)).toBe(false)
			expect(await countStored([file.storageKey, file.thumbKey])).toBe(0)
		})

		it('returns attached without throwing, and touches no object, when a message holds the file', async () => {
			wireRows()
			await putBoth()
			// the owned row is locked, but the guarded delete finds a binding
			repository.deleteUnattached.mockResolvedValue(false)
			const del = vi.spyOn(adapter, 'deleteObject')

			const result = await service.removeUnattached(USER_ID, FILE_ID)

			expect(result).toBe(REMOVE_ATTACHED)
			expect(del).not.toHaveBeenCalled()
			expect(rows.has(FILE_ID)).toBe(true)
			expect(await countStored([file.storageKey, file.thumbKey])).toBe(2)
		})

		it('returns notFound for another user or a missing file: no transaction, no object touched', async () => {
			const del = vi.spyOn(adapter, 'deleteObject')

			const result = await service.removeUnattached(OTHER_USER_ID, FILE_ID)

			expect(result).toBe(REMOVE_NOT_FOUND)
			expect(repository.findOwned).toHaveBeenCalledWith({ id: FILE_ID, userId: OTHER_USER_ID })
			expect(transactionOptions).toHaveLength(0)
			expect(repository.lockOwned).not.toHaveBeenCalled()
			expect(repository.deleteUnattached).not.toHaveBeenCalled()
			expect(del).not.toHaveBeenCalled()
		})

		it('returns notFound when the lock finds no row (a parallel delete finished first)', async () => {
			wireRows()
			await putBoth()
			repository.lockOwned.mockResolvedValue(false)
			const del = vi.spyOn(adapter, 'deleteObject')

			const result = await service.removeUnattached(USER_ID, FILE_ID)

			expect(result).toBe(REMOVE_NOT_FOUND)
			expect(repository.deleteUnattached).not.toHaveBeenCalled()
			expect(del).not.toHaveBeenCalled()
		})

		it('throws the storage failure and rolls the row back; a retry returns removed', async () => {
			wireRows()
			await putBoth()
			const original = adapter.deleteObject
			const del = vi.spyOn(adapter, 'deleteObject')
			del.mockImplementationOnce(original)
			del.mockRejectedValueOnce(new Error('storage down'))

			await expect(service.removeUnattached(USER_ID, FILE_ID)).rejects.toBeInstanceOf(AppException)
			expect(rows.has(FILE_ID)).toBe(true)

			await expect(service.removeUnattached(USER_ID, FILE_ID)).resolves.toBe(REMOVE_DONE)
			expect(rows.has(FILE_ID)).toBe(false)
		})

		it('rolls the row back when the first object delete fails', async () => {
			wireRows()
			await putBoth()
			vi.spyOn(adapter, 'deleteObject').mockRejectedValue(new Error('storage down'))

			await expect(service.removeUnattached(USER_ID, FILE_ID)).rejects.toBeInstanceOf(AppException)

			expect(rows.has(FILE_ID)).toBe(true)
			expect(await countStored([file.storageKey, file.thumbKey])).toBe(2)
		})

		it('logs the deletion with ids only, and only when something was deleted', async () => {
			wireRows()
			// a fresh spy: afterEach's restoreAllMocks detaches the shared ones
			const log = vi.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined)

			await service.removeUnattached(USER_ID, FILE_ID)
			expect(log.mock.calls.map(([message]) => String(message))).toEqual([
				`Photo deleted user=${USER_ID} file=${FILE_ID}`,
			])

			log.mockClear()
			repository.deleteUnattached.mockResolvedValue(false)
			await service.removeUnattached(USER_ID, FILE_ID)
			expect(log).not.toHaveBeenCalled()
		})

		it('remove() is a thin wrapper: removed resolves, the two other outcomes become 404 and 409', async () => {
			wireRows()
			await expect(service.remove(USER_ID, FILE_ID)).resolves.toBeUndefined()

			repository.lockOwned.mockResolvedValue(false)
			await expectAppError(service.remove(USER_ID, FILE_ID), {
				status: HttpStatus.NOT_FOUND,
				errorCode: ErrorCodes.PHOTO_NOT_FOUND,
			})

			repository.lockOwned.mockResolvedValue(true)
			repository.deleteUnattached.mockResolvedValue(false)
			await expectAppError(service.remove(USER_ID, FILE_ID), {
				status: HttpStatus.CONFLICT,
				errorCode: ErrorCodes.PHOTO_IN_USE,
			})
		})
	})
})
