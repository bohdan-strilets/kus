import { describe, expect, it } from 'vitest'

import { PURGE_TRANSACTION_TIMEOUT_MS } from '../account/account.constants'
import {
	PHOTO_REMOVE_TRANSACTION_TIMEOUT_MS,
	STORAGE_DELETE_TIMEOUT_MS,
	STORAGE_LIST_TIMEOUT_MS,
	STORAGE_RETRIES,
	STORAGE_TRANSFER_TIMEOUT_MS,
	STORAGE_WORST_REQUEST_MS,
} from './storage.constants'

describe('storage timeouts', () => {
	it('keeps the agreed values', () => {
		expect(STORAGE_TRANSFER_TIMEOUT_MS).toBe(20_000)
		expect(STORAGE_DELETE_TIMEOUT_MS).toBe(10_000)
		expect(STORAGE_LIST_TIMEOUT_MS).toBe(10_000)
		expect(STORAGE_RETRIES).toBe(2)
		expect(STORAGE_WORST_REQUEST_MS).toBe(30_000)
		expect(PHOTO_REMOVE_TRANSACTION_TIMEOUT_MS).toBe(70_000)
	})

	it('keeps DELETE and LIST shorter than a transfer', () => {
		expect(STORAGE_DELETE_TIMEOUT_MS).toBeLessThan(STORAGE_TRANSFER_TIMEOUT_MS)
		expect(STORAGE_LIST_TIMEOUT_MS).toBeLessThan(STORAGE_TRANSFER_TIMEOUT_MS)
	})

	it('holds a photo-removal transaction open for at least two worst-case storage requests', () => {
		expect(PHOTO_REMOVE_TRANSACTION_TIMEOUT_MS).toBeGreaterThanOrEqual(2 * STORAGE_WORST_REQUEST_MS)
	})

	it('holds the purge transaction open longer than one worst-case storage request', () => {
		expect(PURGE_TRANSACTION_TIMEOUT_MS).toBeGreaterThan(STORAGE_WORST_REQUEST_MS)
	})
})
