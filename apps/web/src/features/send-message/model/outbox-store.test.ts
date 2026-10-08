import { beforeEach, describe, expect, it, vi } from 'vitest'

// tests run in node: an in-memory localStorage, in place before the store reads it on import
vi.hoisted(() => {
	const data = new Map<string, string>()
	const storage: Pick<Storage, 'getItem' | 'setItem' | 'removeItem' | 'clear'> = {
		getItem: (key) => data.get(key) ?? null,
		setItem: (key, value) => {
			data.set(key, value)
		},
		removeItem: (key) => {
			data.delete(key)
		},
		clear: () => {
			data.clear()
		},
	}
	vi.stubGlobal('localStorage', storage)
})

import { RESTORED_FAILURE } from '../lib/get-send-error'
import { OUTBOX_STORAGE_KEY, restoreOutbox, useOutboxStore } from './outbox-store'

const FAILED_ID = '0199b3a4-0000-7000-8000-0000000000aa'
const SENDING_ID = '0199b3a4-0000-7000-8000-0000000000bb'
const CREATED_AT = '2026-10-08T10:00:00.000Z'
const OWNER_ID = '0199b3a4-0000-7000-8000-00000000000a'

const readStored = (): unknown => JSON.parse(localStorage.getItem(OUTBOX_STORAGE_KEY) ?? 'null')

describe('outbox persistence', () => {
	beforeEach(() => {
		localStorage.clear()
		useOutboxStore.setState({ ownerId: OWNER_ID, items: {} })
	})

	it('stores only failed drafts, and only what the user typed', () => {
		const { markSending, markFailed } = useOutboxStore.getState()
		markSending({ clientMessageId: FAILED_ID, text: 'тарілка супу', createdAt: CREATED_AT })
		markSending({ clientMessageId: SENDING_ID, text: 'банан', createdAt: CREATED_AT })
		markFailed(FAILED_ID, { messageKey: 'chat.networkError', canRetry: true })

		expect(readStored()).toMatchObject({
			state: {
				ownerId: OWNER_ID,
				items: [{ clientMessageId: FAILED_ID, text: 'тарілка супу', createdAt: CREATED_AT }],
			},
		})
		expect(JSON.stringify(readStored())).not.toContain('networkError')
	})

	it('forgets a draft once it went through', () => {
		const { markSending, markFailed, remove } = useOutboxStore.getState()
		markSending({ clientMessageId: FAILED_ID, text: 'тарілка супу', createdAt: CREATED_AT })
		markFailed(FAILED_ID, { messageKey: 'chat.networkError', canRetry: true })

		remove(FAILED_ID)

		expect(readStored()).toMatchObject({ state: { items: [] } })
	})

	it('brings «Не надіслано» back after a reload', async () => {
		localStorage.setItem(
			OUTBOX_STORAGE_KEY,
			JSON.stringify({
				state: {
					ownerId: OWNER_ID,
					items: [{ clientMessageId: FAILED_ID, text: 'тарілка супу', createdAt: CREATED_AT }],
				},
				version: 2,
			}),
		)

		await useOutboxStore.persist.rehydrate()

		expect(useOutboxStore.getState().items[FAILED_ID]).toEqual({
			clientMessageId: FAILED_ID,
			text: 'тарілка супу',
			createdAt: CREATED_AT,
			status: 'failed',
			error: RESTORED_FAILURE,
		})
	})

	it('drops whatever in storage does not parse', () => {
		expect(restoreOutbox(null)).toEqual({ ownerId: null, items: {} })
		expect(restoreOutbox({ ownerId: OWNER_ID, items: 'x' }).items).toEqual({})
		expect(restoreOutbox({ items: [] }).ownerId).toBeNull()
		const { items } = restoreOutbox({
			ownerId: OWNER_ID,
			items: [
				{ clientMessageId: 'nope', text: '' },
				{ clientMessageId: FAILED_ID, text: 'a', createdAt: CREATED_AT },
			],
		})
		expect(Object.keys(items)).toEqual([FAILED_ID])
	})
})
