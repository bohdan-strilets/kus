import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { compressImage } from '../lib/compress-image'
import { PhotoError } from '../lib/compress-image.helpers'
import { usePhotoDraftStore } from './photo-draft-store'

vi.mock('../lib/compress-image', () => ({ compressImage: vi.fn() }))

const OWNER_ID = '0199b3a4-0000-7000-8000-00000000000a'
const file = new File(['x'], 'plate.jpg', { type: 'image/jpeg' })
const compressed = { blob: new Blob(['jpeg']), base64: 'AAAA', width: 800, height: 600 }

describe('photo draft store', () => {
	let urlCounter = 0
	const create = vi.spyOn(URL, 'createObjectURL').mockImplementation(() => {
		urlCounter += 1
		return `blob:http://localhost/${urlCounter}`
	})
	const revoke = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined)

	beforeEach(() => {
		usePhotoDraftStore.getState().clear()
		usePhotoDraftStore.setState({ ownerId: OWNER_ID })
		vi.mocked(compressImage).mockReset()
		urlCounter = 0
		create.mockClear()
		revoke.mockClear()
	})

	afterEach(() => {
		usePhotoDraftStore.getState().clear()
	})

	it('is processing while the picture is prepared, then ready with a preview', async () => {
		let finish: (value: typeof compressed) => void = () => undefined
		vi.mocked(compressImage).mockReturnValueOnce(
			new Promise((resolve) => {
				finish = resolve
			}),
		)

		const picking = usePhotoDraftStore.getState().pick(file)
		expect(usePhotoDraftStore.getState()).toMatchObject({ status: 'processing', photo: null })

		finish(compressed)
		await picking
		expect(usePhotoDraftStore.getState()).toMatchObject({
			status: 'ready',
			errorKey: null,
			photo: { base64: 'AAAA', width: 800, height: 600, previewUrl: 'blob:http://localhost/1' },
		})
	})

	it('maps a photo that can not be used to its message', async () => {
		vi.mocked(compressImage).mockRejectedValueOnce(new PhotoError('tooLarge'))
		await usePhotoDraftStore.getState().pick(file)
		expect(usePhotoDraftStore.getState()).toMatchObject({
			status: 'error',
			errorKey: 'chat.photoTooLarge',
		})

		vi.mocked(compressImage).mockRejectedValueOnce(new Error('decode'))
		await usePhotoDraftStore.getState().pick(file)
		expect(usePhotoDraftStore.getState().errorKey).toBe('chat.photoUnsupported')
	})

	it('ignores the answer of a pick that was superseded by a newer one', async () => {
		let finishFirst: (value: typeof compressed) => void = () => undefined
		vi.mocked(compressImage)
			.mockReturnValueOnce(
				new Promise((resolve) => {
					finishFirst = resolve
				}),
			)
			.mockResolvedValueOnce({ ...compressed, base64: 'BBBB' })

		const first = usePhotoDraftStore.getState().pick(file)
		await usePhotoDraftStore.getState().pick(file)
		finishFirst(compressed)
		await first

		expect(usePhotoDraftStore.getState().photo?.base64).toBe('BBBB')
		expect(create).toHaveBeenCalledTimes(1)
	})

	it('revokes the preview on clear and on a change of owner', async () => {
		vi.mocked(compressImage).mockResolvedValue(compressed)
		await usePhotoDraftStore.getState().pick(file)
		usePhotoDraftStore.getState().clear()
		expect(revoke).toHaveBeenCalledWith('blob:http://localhost/1')
		expect(usePhotoDraftStore.getState()).toMatchObject({ status: 'idle', photo: null })

		await usePhotoDraftStore.getState().pick(file)
		usePhotoDraftStore.getState().claim(null)
		expect(revoke).toHaveBeenCalledWith('blob:http://localhost/2')
		expect(usePhotoDraftStore.getState().ownerId).toBeNull()
	})
})
