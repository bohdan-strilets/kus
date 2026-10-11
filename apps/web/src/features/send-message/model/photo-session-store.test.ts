import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { PREVIEWS_MAX, usePhotoSessionStore } from './photo-session-store'

const OWNER_ID = '0199b3a4-0000-7000-8000-00000000000a'
const id = (index: number): string =>
	`0199b3a4-0000-7000-8000-${String(index + 1).padStart(12, '0')}`
const url = (index: number): string => `blob:http://localhost/${index}`

describe('photo session store', () => {
	const revoke = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined)

	beforeEach(() => {
		usePhotoSessionStore.setState({ ownerId: OWNER_ID, uploadProgress: {}, previews: {} })
	})

	afterEach(() => {
		revoke.mockClear()
	})

	it('tracks the upload of a message and forgets it when the request is over', () => {
		const { setUploadProgress, clearUploadProgress } = usePhotoSessionStore.getState()
		setUploadProgress(id(0), 0.4)
		expect(usePhotoSessionStore.getState().uploadProgress).toEqual({ [id(0)]: 0.4 })

		clearUploadProgress(id(0))
		expect(usePhotoSessionStore.getState().uploadProgress).toEqual({})
	})

	it('keeps the last PREVIEWS_MAX pictures and revokes the older ones', () => {
		const { keepPreview } = usePhotoSessionStore.getState()
		for (let index = 0; index < PREVIEWS_MAX + 2; index += 1) keepPreview(id(index), url(index))

		const kept = Object.keys(usePhotoSessionStore.getState().previews)
		expect(kept).toHaveLength(PREVIEWS_MAX)
		expect(kept[0]).toBe(id(2))
		expect(revoke.mock.calls.map(([revoked]) => revoked)).toEqual([url(0), url(1)])
	})

	it('drops the pictures together with their owner', () => {
		const { keepPreview, claim } = usePhotoSessionStore.getState()
		keepPreview(id(0), url(0))

		claim(null)

		expect(usePhotoSessionStore.getState().previews).toEqual({})
		expect(revoke).toHaveBeenCalledWith(url(0))
	})

	it('keeps everything for the same owner', () => {
		const { keepPreview, claim } = usePhotoSessionStore.getState()
		keepPreview(id(0), url(0))

		claim(OWNER_ID)

		expect(usePhotoSessionStore.getState().previews).toEqual({ [id(0)]: url(0) })
		expect(revoke).not.toHaveBeenCalled()
	})
})
