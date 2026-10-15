import { HttpStatus, Logger } from '@nestjs/common'
import { afterEach, beforeEach, describe, expect, it, vi, type Mocked } from 'vitest'

import { ErrorCodes } from '../../common/exceptions'
import { StorageUnavailableException } from './storage.exceptions'
import { StorageService } from './storage.service'
import type { StorageAdapter } from './storage.types'

const SECRET_KEY = 'dev/users/secret-user/photos/secret-file'
const SECRET_MESSAGE = 'bucket kus-secret-bucket at https://account.r2.example denied'

const createAdapter = (): Mocked<StorageAdapter> => ({
	putObject: vi.fn<StorageAdapter['putObject']>().mockResolvedValue(undefined),
	getObject: vi.fn<StorageAdapter['getObject']>().mockResolvedValue(null),
	deleteObject: vi.fn<StorageAdapter['deleteObject']>().mockResolvedValue(undefined),
	deleteByPrefix: vi.fn<StorageAdapter['deleteByPrefix']>().mockResolvedValue(undefined),
})

describe('StorageService', () => {
	const errorSpy = vi.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined)
	let adapter: ReturnType<typeof createAdapter>
	let service: StorageService

	beforeEach(() => {
		errorSpy.mockClear()
		adapter = createAdapter()
		service = new StorageService(adapter)
	})

	afterEach(() => {
		errorSpy.mockClear()
	})

	it('delegates every operation to the adapter', async () => {
		const input = { key: SECRET_KEY, body: Buffer.from('x'), contentType: 'image/jpeg' }

		await service.putObject(input)
		await service.getObject(SECRET_KEY)
		await service.deleteObject(SECRET_KEY)
		await service.deleteByPrefix('dev/users/u1/')

		expect(adapter.putObject).toHaveBeenCalledWith(input)
		expect(adapter.getObject).toHaveBeenCalledWith(SECRET_KEY)
		expect(adapter.deleteObject).toHaveBeenCalledWith(SECRET_KEY)
		expect(adapter.deleteByPrefix).toHaveBeenCalledWith('dev/users/u1/')
	})

	it('passes a missing object through as null', async () => {
		await expect(service.getObject(SECRET_KEY)).resolves.toBeNull()
		expect(errorSpy).not.toHaveBeenCalled()
	})

	it('returns the stored object', async () => {
		const stored = { body: Buffer.from('x'), contentType: 'image/png' }
		adapter.getObject.mockResolvedValue(stored)

		await expect(service.getObject(SECRET_KEY)).resolves.toBe(stored)
	})

	it.each([
		[
			'putObject',
			() =>
				service.putObject({ key: SECRET_KEY, body: Buffer.from('x'), contentType: 'image/jpeg' }),
		],
		['getObject', () => service.getObject(SECRET_KEY)],
		['deleteObject', () => service.deleteObject(SECRET_KEY)],
		['deleteByPrefix', () => service.deleteByPrefix(SECRET_KEY)],
	])('%s: an adapter failure becomes STORAGE_UNAVAILABLE', async (name, call) => {
		adapter[name as keyof StorageAdapter].mockRejectedValue(new Error(SECRET_MESSAGE))

		const error: unknown = await call().catch((caught: unknown) => caught)

		expect(error).toBeInstanceOf(StorageUnavailableException)
		const exception = error as StorageUnavailableException
		expect(exception.getStatus()).toBe(HttpStatus.SERVICE_UNAVAILABLE)
		expect(exception.errorCode).toBe(ErrorCodes.STORAGE_UNAVAILABLE)
	})

	it('logs neither the key nor the error message', async () => {
		adapter.getObject.mockRejectedValue(new Error(SECRET_MESSAGE))

		await service.getObject(SECRET_KEY).catch(() => undefined)

		expect(errorSpy).toHaveBeenCalledTimes(1)
		const logged = JSON.stringify(errorSpy.mock.calls)
		expect(logged).not.toContain('secret')
		expect(logged).not.toContain('r2.example')
	})

	it('handles a non-Error rejection', async () => {
		adapter.deleteObject.mockRejectedValue('boom secret')

		await expect(service.deleteObject(SECRET_KEY)).rejects.toBeInstanceOf(
			StorageUnavailableException,
		)
		expect(JSON.stringify(errorSpy.mock.calls)).not.toContain('secret')
	})
})
