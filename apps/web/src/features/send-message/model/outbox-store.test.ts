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
import { OUTBOX_STORAGE_KEY, PREVIEWS_MAX, restoreOutbox, useOutboxStore } from './outbox-store'

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
		useOutboxStore.setState({ ownerId: OWNER_ID, items: {}, previews: {} })
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

	it('forgets a removed photo message but keeps its picture for the bubble', () => {
		const { markSending, markFailed, remove } = useOutboxStore.getState()
		markSending({ clientMessageId: FAILED_ID, text: '', photo, createdAt: CREATED_AT })
		markFailed(FAILED_ID, { messageKey: 'chat.networkError', canRetry: true })

		remove(FAILED_ID)

		expect(readStored()).toMatchObject({ state: { items: [] } })
		expect(useOutboxStore.getState().items).toEqual({})
		expect(useOutboxStore.getState().previews).toEqual({ [FAILED_ID]: photo.previewUrl })
		expect(JSON.stringify(readStored())).not.toContain(photo.previewUrl)
	})

	it('keeps the last PREVIEWS_MAX pictures and revokes the older ones', () => {
		const revoke = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined)
		const { markSending, remove } = useOutboxStore.getState()
		const ids = Array.from(
			{ length: PREVIEWS_MAX + 2 },
			(_, index) => `0199b3a4-0000-7000-8000-${String(index + 1).padStart(12, '0')}`,
		)
		for (const id of ids) {
			markSending({
				clientMessageId: id,
				text: '',
				photo: { ...photo, previewUrl: `blob:http://localhost/${id}` },
				createdAt: CREATED_AT,
			})
			remove(id)
		}

		const kept = Object.keys(useOutboxStore.getState().previews)
		expect(kept).toHaveLength(PREVIEWS_MAX)
		expect(kept).toEqual(ids.slice(2))
		expect(revoke.mock.calls.map(([url]) => url)).toEqual([
			`blob:http://localhost/${ids[0]}`,
			`blob:http://localhost/${ids[1]}`,
		])
		revoke.mockRestore()
	})

	it('drops the kept pictures together with their owner', () => {
		const revoke = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined)
		const { markSending, remove, claim } = useOutboxStore.getState()
		markSending({ clientMessageId: FAILED_ID, text: '', photo, createdAt: CREATED_AT })
		remove(FAILED_ID)

		claim('0199b3a4-0000-7000-8000-00000000000b')

		expect(useOutboxStore.getState().previews).toEqual({})
		expect(revoke).toHaveBeenCalledWith(photo.previewUrl)
		revoke.mockRestore()
	})

	it('keeps the upload progress of a sending message only', () => {
		const { markSending, setUploadProgress, markFailed } = useOutboxStore.getState()
		markSending({ clientMessageId: FAILED_ID, text: '', photo, createdAt: CREATED_AT })
		setUploadProgress(FAILED_ID, 0.4)
		expect(useOutboxStore.getState().items[FAILED_ID]?.uploadProgress).toBe(0.4)

		markFailed(FAILED_ID, { messageKey: 'chat.networkError', canRetry: true })
		setUploadProgress(FAILED_ID, 0.9)

		expect(useOutboxStore.getState().items[FAILED_ID]?.uploadProgress).toBeUndefined()
	})
})
