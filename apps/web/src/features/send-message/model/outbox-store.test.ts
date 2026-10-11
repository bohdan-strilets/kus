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

import { PHOTO_LOST_FAILURE, RESTORED_FAILURE } from '../lib/get-send-error'
import { HIDDEN_MAX, OUTBOX_STORAGE_KEY, restoreOutbox, useOutboxStore } from './outbox-store'

const FAILED_ID = '0199b3a4-0000-7000-8000-0000000000aa'
const SENDING_ID = '0199b3a4-0000-7000-8000-0000000000bb'
const CREATED_AT = '2026-10-08T10:00:00.000Z'
const OWNER_ID = '0199b3a4-0000-7000-8000-00000000000a'
const OTHER_OWNER_ID = '0199b3a4-0000-7000-8000-00000000000b'

const readStored = (): unknown => JSON.parse(localStorage.getItem(OUTBOX_STORAGE_KEY) ?? 'null')

const serverId = (index: number): string =>
	`0199b3a4-0000-7000-8000-${String(index + 1).padStart(12, '0')}`

describe('outbox persistence', () => {
	beforeEach(() => {
		localStorage.clear()
		useOutboxStore.setState({ ownerId: OWNER_ID, items: {}, hiddenIds: [] })
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
		const { markSending, markFailed, complete } = useOutboxStore.getState()
		markSending({ clientMessageId: FAILED_ID, text: 'тарілка супу', createdAt: CREATED_AT })
		markFailed(FAILED_ID, { messageKey: 'chat.networkError', canRetry: true })

		expect(complete(FAILED_ID)).toBeNull()

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
		expect(restoreOutbox(null)).toEqual({ ownerId: null, items: {}, hiddenIds: [] })
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

describe('outbox photos', () => {
	const photo = {
		previewUrl: 'blob:http://localhost/preview',
		base64: 'AAAA',
		mimeType: 'image/jpeg',
		width: 800,
		height: 600,
	} as const

	beforeEach(() => {
		localStorage.clear()
		useOutboxStore.setState({ ownerId: OWNER_ID, items: {}, hiddenIds: [] })
	})

	it('does not store a photo that is still sending', () => {
		useOutboxStore.getState().markSending({
			clientMessageId: SENDING_ID,
			text: '',
			photo,
			createdAt: CREATED_AT,
		})

		expect(readStored()).toMatchObject({ state: { items: [] } })
	})

	it('stores a failed photo message as a light record, without the picture', () => {
		const { markSending, markFailed } = useOutboxStore.getState()
		markSending({ clientMessageId: FAILED_ID, text: 'обід', photo, createdAt: CREATED_AT })
		markFailed(FAILED_ID, { messageKey: 'chat.networkError', canRetry: true })

		expect(readStored()).toMatchObject({
			state: {
				items: [
					{ clientMessageId: FAILED_ID, text: 'обід', createdAt: CREATED_AT, photoLost: true },
				],
			},
		})
		const stored = JSON.stringify(readStored())
		expect(stored).not.toContain('AAAA')
		expect(stored).not.toContain('blob:')
	})

	it('brings a photo message back as «фото не надіслано», not retriable', async () => {
		localStorage.setItem(
			OUTBOX_STORAGE_KEY,
			JSON.stringify({
				state: {
					ownerId: OWNER_ID,
					items: [{ clientMessageId: FAILED_ID, text: '', createdAt: CREATED_AT, photoLost: true }],
				},
				version: 2,
			}),
		)

		await useOutboxStore.persist.rehydrate()

		expect(useOutboxStore.getState().items[FAILED_ID]).toEqual({
			clientMessageId: FAILED_ID,
			text: '',
			createdAt: CREATED_AT,
			photoLost: true,
			status: 'failed',
			error: PHOTO_LOST_FAILURE,
		})
	})

	it('drops an empty text that is not the leftover of a photo', () => {
		const { items } = restoreOutbox({
			ownerId: OWNER_ID,
			items: [{ clientMessageId: FAILED_ID, text: '', createdAt: CREATED_AT }],
		})
		expect(items).toEqual({})
	})

	it('hands the picture over when the message went through, without revoking it', () => {
		const revoke = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined)
		const { markSending, complete } = useOutboxStore.getState()
		markSending({ clientMessageId: SENDING_ID, text: '', photo, createdAt: CREATED_AT })

		expect(complete(SENDING_ID)).toBe(photo.previewUrl)

		expect(useOutboxStore.getState().items).toEqual({})
		expect(revoke).not.toHaveBeenCalled()
		revoke.mockRestore()
	})

	it('revokes the picture of a dismissed or final failure', () => {
		const revoke = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined)
		const { markSending, markFailed, remove } = useOutboxStore.getState()
		markSending({ clientMessageId: FAILED_ID, text: '', photo, createdAt: CREATED_AT })
		markFailed(FAILED_ID, { messageKey: 'chat.photoTooLarge', canRetry: false })

		remove(FAILED_ID)

		expect(useOutboxStore.getState().items).toEqual({})
		expect(revoke).toHaveBeenCalledWith(photo.previewUrl)
		revoke.mockRestore()
	})
})

describe('hidden server messages', () => {
	beforeEach(() => {
		localStorage.clear()
		useOutboxStore.setState({ ownerId: OWNER_ID, items: {}, hiddenIds: [] })
	})

	it('remembers a hidden message across a reload', async () => {
		useOutboxStore.getState().hide(serverId(0))

		expect(readStored()).toMatchObject({ state: { hiddenIds: [serverId(0)] } })

		await useOutboxStore.persist.rehydrate()
		expect(useOutboxStore.getState().hiddenIds).toEqual([serverId(0)])
	})

	it('keeps the newest HIDDEN_MAX ids, each once', () => {
		const { hide } = useOutboxStore.getState()
		for (let index = 0; index < HIDDEN_MAX + 3; index += 1) hide(serverId(index))
		hide(serverId(5))

		const { hiddenIds } = useOutboxStore.getState()
		expect(hiddenIds).toHaveLength(HIDDEN_MAX)
		expect(hiddenIds.at(-1)).toBe(serverId(5))
		expect(hiddenIds).not.toContain(serverId(0))
		expect(new Set(hiddenIds).size).toBe(HIDDEN_MAX)
	})

	it('forgets them with their owner', () => {
		useOutboxStore.getState().hide(serverId(0))
		useOutboxStore.getState().claim(OTHER_OWNER_ID)

		expect(useOutboxStore.getState().hiddenIds).toEqual([])
	})
})
