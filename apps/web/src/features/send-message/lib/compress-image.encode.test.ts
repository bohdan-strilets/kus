// @vitest-environment jsdom
import { PHOTO_TARGET_SIDE_PX, PHOTO_THUMB_MAX_BYTES, PHOTO_THUMB_SIDE_PX } from '@kus/shared'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { usePhotoDraftStore } from '../model/photo-draft-store'
import { compressImage } from './compress-image'
import { PHOTO_TARGET_BYTES, PhotoError } from './compress-image.helpers'
import { EXIF_GPS_JPEG_BASE64 } from './fixtures/exif-gps.fixture'
import { hasJpegExif } from './fixtures/jpeg-exif'

const PHOTO_FALLBACK_SIDE_PX = 1280
const THUMB_FALLBACK_SIDE_PX = 576
/** SOI + JFIF + SOS: a JPEG header with no Exif, as a canvas writes it. */
const CLEAN_JPEG_HEAD = [0xff, 0xd8, 0xff, 0xe0, 0x00, 0x06, 0x4a, 0x46, 0x49, 0x46, 0xff, 0xda]
const SENTINEL = 'KUSIK-GPS-SENTINEL'

interface ToBlobCall {
	width: number
	height: number
	quality: number
}

interface FakeImageSetup {
	naturalWidth: number
	naturalHeight: number
	isDecodable: boolean
}

let image: FakeImageSetup
let toBlobCalls: ToBlobCall[]
/** Bytes the canvas "produces" for one attempt; the long side and quality decide, like a real JPEG. */
let sizeFor: (call: ToBlobCall) => number

const longSide = (call: ToBlobCall): number => Math.max(call.width, call.height)

const decodeBase64 = (base64: string): Uint8Array<ArrayBuffer> =>
	Uint8Array.from(atob(base64), (char) => char.charCodeAt(0))

const readBytes = (blob: Blob): Promise<Uint8Array> =>
	new Promise((resolve) => {
		const reader = new FileReader()
		reader.onload = () => {
			resolve(new Uint8Array(reader.result as ArrayBuffer))
		}
		reader.readAsArrayBuffer(blob)
	})

class FakeImage {
	src = ''
	get naturalWidth(): number {
		return image.naturalWidth
	}
	get naturalHeight(): number {
		return image.naturalHeight
	}
	decode = (): Promise<void> =>
		image.isDecodable ? Promise.resolve() : Promise.reject(new Error('EncodingError'))
}

let drawnSize = { width: 0, height: 0 }

const fakeContext = {
	drawImage: (_image: unknown, _x: number, _y: number, width: number, height: number) => {
		drawnSize = { width, height }
	},
}

const fakeToBlob = (callback: BlobCallback, _type?: string, quality?: unknown): void => {
	const call = { ...drawnSize, quality: Number(quality) }
	toBlobCalls.push(call)
	const bytes = new Uint8Array(Math.max(sizeFor(call), CLEAN_JPEG_HEAD.length))
	bytes.set(CLEAN_JPEG_HEAD)
	callback(new Blob([bytes], { type: 'image/jpeg' }))
}

const pickFile = (): File =>
	new File([new Uint8Array([1, 2, 3])], 'plate.jpg', { type: 'image/jpeg' })

describe('compressImage', () => {
	let revokeObjectURL: ReturnType<typeof vi.fn<typeof URL.revokeObjectURL>>
	let createObjectURL: ReturnType<typeof vi.fn<typeof URL.createObjectURL>>

	beforeEach(() => {
		image = { naturalWidth: 4032, naturalHeight: 3024, isDecodable: true }
		toBlobCalls = []
		sizeFor = () => 50_000
		revokeObjectURL = vi.fn<typeof URL.revokeObjectURL>()
		createObjectURL = vi.fn<typeof URL.createObjectURL>(() => 'blob:http://localhost/source')
		URL.createObjectURL = createObjectURL
		URL.revokeObjectURL = revokeObjectURL
		vi.stubGlobal('Image', FakeImage)
		vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(
			fakeContext as unknown as CanvasRenderingContext2D,
		)
		vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation(fakeToBlob)
	})

	afterEach(() => {
		vi.restoreAllMocks()
		vi.unstubAllGlobals()
		usePhotoDraftStore.getState().clear()
	})

	it('returns the full photo at 1568 px and a thumbnail at 768 px, both within their limits', async () => {
		sizeFor = (call) => (longSide(call) === PHOTO_TARGET_SIDE_PX ? 600_000 : 90_000)

		const result = await compressImage(pickFile())

		expect(toBlobCalls).toEqual([
			{ width: 1568, height: 1176, quality: 0.8 },
			{ width: 768, height: 576, quality: 0.8 },
		])
		// the size sent to POST /photos is the full photo's, not the thumbnail's
		expect(result).toMatchObject({ width: 1568, height: 1176 })
		expect(result.blob.size).toBeLessThanOrEqual(PHOTO_TARGET_BYTES)
		expect(decodeBase64(result.base64).length).toBeLessThanOrEqual(PHOTO_TARGET_BYTES)
		expect(decodeBase64(result.thumbBase64).length).toBeLessThanOrEqual(PHOTO_THUMB_MAX_BYTES)
	})

	it('steps the thumbnail quality down at 768 px before it shrinks the picture', async () => {
		sizeFor = (call) => {
			if (longSide(call) === PHOTO_TARGET_SIDE_PX) return 400_000
			return { 0.8: 200_000, 0.7: 160_000, 0.6: 140_000 }[call.quality] ?? 1
		}

		const result = await compressImage(pickFile())

		expect(toBlobCalls.slice(1)).toEqual([
			{ width: 768, height: 576, quality: 0.8 },
			{ width: 768, height: 576, quality: 0.7 },
			{ width: 768, height: 576, quality: 0.6 },
		])
		expect(decodeBase64(result.thumbBase64)).toHaveLength(140_000)
	})

	it('falls back to 576 px at quality 0.6 when no 768 px attempt fits', async () => {
		sizeFor = (call) => {
			if (longSide(call) === PHOTO_TARGET_SIDE_PX) return 400_000
			return longSide(call) === THUMB_FALLBACK_SIDE_PX ? 100_000 : 200_000
		}

		const result = await compressImage(pickFile())

		expect(toBlobCalls.at(-1)).toEqual({ width: 576, height: 432, quality: 0.6 })
		expect(decodeBase64(result.thumbBase64)).toHaveLength(100_000)
	})

	it('accepts a thumbnail of exactly 150 000 bytes and refuses one byte more', async () => {
		sizeFor = (call) => (longSide(call) === PHOTO_TARGET_SIDE_PX ? 400_000 : PHOTO_THUMB_MAX_BYTES)
		await expect(compressImage(pickFile())).resolves.toBeDefined()

		toBlobCalls = []
		sizeFor = (call) =>
			longSide(call) === PHOTO_TARGET_SIDE_PX ? 400_000 : PHOTO_THUMB_MAX_BYTES + 1
		await expect(compressImage(pickFile())).rejects.toMatchObject({ kind: 'tooLarge' })
	})

	it('throws «tooLarge» when no thumbnail attempt fits, after trying every rung', async () => {
		sizeFor = (call) => (longSide(call) === PHOTO_TARGET_SIDE_PX ? 400_000 : 900_000)

		await expect(compressImage(pickFile())).rejects.toBeInstanceOf(PhotoError)

		// 1 full + 4 thumbnail rungs
		expect(toBlobCalls).toHaveLength(5)
	})

	it('throws «tooLarge» when even the lightest full photo is over 1 MB, without a thumbnail', async () => {
		sizeFor = () => PHOTO_TARGET_BYTES + 1

		await expect(compressImage(pickFile())).rejects.toMatchObject({ kind: 'tooLarge' })

		expect(toBlobCalls).toHaveLength(4)
		expect(toBlobCalls.at(-1)).toMatchObject({ quality: 0.7 })
		expect(longSide(toBlobCalls.at(-1) as ToBlobCall)).toBe(PHOTO_FALLBACK_SIDE_PX)
	})

	it('reports the size of the canvas the full photo was drawn on when it had to shrink', async () => {
		sizeFor = (call) => {
			if (longSide(call) <= PHOTO_THUMB_SIDE_PX) return 90_000
			return longSide(call) === PHOTO_FALLBACK_SIDE_PX ? 800_000 : 1_200_000
		}

		const result = await compressImage(pickFile())

		expect(result).toMatchObject({ width: 1280, height: 960 })
	})

	it('never enlarges a small photo', async () => {
		image = { naturalWidth: 640, naturalHeight: 480, isDecodable: true }

		const result = await compressImage(pickFile())

		expect(result).toMatchObject({ width: 640, height: 480 })
		expect(toBlobCalls[1]).toMatchObject({ width: 640, height: 480 })
	})

	it('leaves no Exif or GPS in either the photo or the thumbnail', async () => {
		const source = decodeBase64(EXIF_GPS_JPEG_BASE64)
		expect(hasJpegExif(source)).toBe(true)

		const result = await compressImage(new File([source], 'camera.jpg', { type: 'image/jpeg' }))

		const full = decodeBase64(result.base64)
		const thumb = decodeBase64(result.thumbBase64)
		for (const bytes of [full, thumb, await readBytes(result.blob)]) {
			expect(hasJpegExif(bytes)).toBe(false)
			expect(new TextDecoder('latin1').decode(bytes)).not.toContain(SENTINEL)
		}
	})

	it.each([
		['the browser can not decode the file', { isDecodable: false, naturalWidth: 100 }],
		['the picture decodes to nothing (width 0)', { isDecodable: true, naturalWidth: 0 }],
		['the picture decodes to nothing (height 0)', { isDecodable: true, naturalHeight: 0 }],
	])('throws «unsupported» when %s, and frees the source URL', async (_name, change) => {
		image = { ...image, ...change }

		await expect(compressImage(pickFile())).rejects.toMatchObject({ kind: 'unsupported' })

		expect(toBlobCalls).toHaveLength(0)
		expect(revokeObjectURL).toHaveBeenCalledWith('blob:http://localhost/source')
	})

	it('ends the picked photo as an error with a message, not as an endless «processing»', async () => {
		image = { ...image, isDecodable: false }

		await usePhotoDraftStore.getState().pick(pickFile())

		expect(usePhotoDraftStore.getState()).toMatchObject({
			status: 'error',
			photo: null,
			errorKey: 'chat.photoUnsupported',
		})
		// the preview URL of the picture is not created for a photo that failed
		expect(createObjectURL).toHaveBeenCalledTimes(1)
	})

	it('ends a photo that is too heavy as «tooLarge» in the draft', async () => {
		sizeFor = (call) => (longSide(call) === PHOTO_TARGET_SIDE_PX ? 400_000 : 900_000)

		await usePhotoDraftStore.getState().pick(pickFile())

		expect(usePhotoDraftStore.getState()).toMatchObject({
			status: 'error',
			errorKey: 'chat.photoTooLarge',
		})
	})

	it('keeps the thumbnail in the draft photo, so the send can upload it', async () => {
		sizeFor = (call) => (longSide(call) === PHOTO_TARGET_SIDE_PX ? 60_000 : 40_000)
		await usePhotoDraftStore.getState().pick(pickFile())

		const { photo } = usePhotoDraftStore.getState()
		expect(photo?.thumbBase64).toBeTruthy()
		expect(photo?.base64).toBeTruthy()
		expect(photo?.thumbBase64).not.toBe(photo?.base64)
	})
})
