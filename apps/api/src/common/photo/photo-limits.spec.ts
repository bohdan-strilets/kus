import { PHOTO_MAX_BYTES, PHOTO_THUMB_MAX_BYTES, PHOTO_THUMB_SIDE_PX } from '@kus/shared'
import { describe, expect, it } from 'vitest'

import { createJpeg, JPEG_SENTINEL } from '../../../test/fixtures/jpeg'
import { PHOTO_FULL_LIMITS, PHOTO_THUMB_LIMITS } from '../../modules/photos/photos.constants'
import { readPhoto } from './read-photo'
import { validatePhoto } from './validate-photo'

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
const APP1_MARKER = 0xe1
const MARKER_PREFIX = 0xff

const createPng = (): Buffer => {
	const ihdr = Buffer.alloc(25)
	ihdr.writeUInt32BE(13, 0)
	ihdr.write('IHDR', 4, 'latin1')
	ihdr.writeUInt32BE(640, 8)
	ihdr.writeUInt32BE(480, 12)
	ihdr[16] = 8
	ihdr[17] = 2
	return Buffer.concat([PNG_SIGNATURE, ihdr, Buffer.alloc(32)])
}

const createWebp = (): Buffer => {
	const header = Buffer.alloc(30)
	header.write('RIFF', 0, 'latin1')
	header.writeUInt32LE(22, 4)
	header.write('WEBP', 8, 'latin1')
	header.write('VP8X', 12, 'latin1')
	header.writeUInt32LE(10, 16)
	header.writeUIntLE(639, 24, 3)
	header.writeUIntLE(479, 27, 3)
	return header
}

const padTo = (jpeg: Buffer, totalBytes: number): Buffer =>
	Buffer.concat([jpeg, Buffer.alloc(totalBytes - jpeg.length)])

const toInput = (bytes: Buffer) => ({
	mimeType: 'image/jpeg' as const,
	data: bytes.toString('base64'),
})

const hasMarker = (bytes: Buffer, marker: number): boolean =>
	bytes.some((byte, index) => byte === MARKER_PREFIX && bytes[index + 1] === marker)

describe('readPhoto with upload limits', () => {
	it.each([
		['PNG', createPng()],
		['WebP', createWebp()],
	])('refuses %s bytes sent as a JPEG with UNSUPPORTED_IMAGE', (_name, bytes) => {
		expect(readPhoto(toInput(bytes), PHOTO_FULL_LIMITS)).toEqual({
			isValid: false,
			code: 'UNSUPPORTED_IMAGE',
		})
		expect(readPhoto(toInput(bytes), PHOTO_THUMB_LIMITS)).toEqual({
			isValid: false,
			code: 'UNSUPPORTED_IMAGE',
		})
	})

	it('refuses a declared PNG that is really a JPEG', () => {
		const result = validatePhoto({
			bytes: createJpeg(),
			mimeType: 'image/png',
			limits: PHOTO_FULL_LIMITS,
		})

		expect(result).toEqual({ isValid: false, code: 'UNSUPPORTED_IMAGE' })
	})

	it('drops EXIF and comments from a JPEG, keeping the size', () => {
		const jpeg = createJpeg({ hasSentinel: true })
		expect(hasMarker(jpeg, APP1_MARKER)).toBe(true)

		const result = readPhoto(toInput(jpeg), PHOTO_FULL_LIMITS)

		expect(result.isValid).toBe(true)
		if (!result.isValid) return
		expect(hasMarker(result.payload.bytes, APP1_MARKER)).toBe(false)
		expect(result.payload.bytes.includes(JPEG_SENTINEL)).toBe(false)
		expect(result.payload).toMatchObject({ width: 640, height: 480 })
	})

	describe('thumbnail side', () => {
		it('accepts the longer side of exactly the limit', () => {
			const result = readPhoto(
				toInput(createJpeg({ width: PHOTO_THUMB_SIDE_PX, height: 576 })),
				PHOTO_THUMB_LIMITS,
			)

			expect(result.isValid).toBe(true)
		})

		it('refuses the longer side one pixel above the limit', () => {
			const result = readPhoto(
				toInput(createJpeg({ width: PHOTO_THUMB_SIDE_PX + 1, height: 576 })),
				PHOTO_THUMB_LIMITS,
			)

			expect(result).toEqual({ isValid: false, code: 'PHOTO_INVALID' })
		})

		it('accepts a very wide thumbnail only 1 px high, but not a 0 px one', () => {
			expect(
				readPhoto(
					toInput(createJpeg({ width: PHOTO_THUMB_SIDE_PX, height: 1 })),
					PHOTO_THUMB_LIMITS,
				).isValid,
			).toBe(true)
			expect(
				readPhoto(
					toInput(createJpeg({ width: PHOTO_THUMB_SIDE_PX, height: 0 })),
					PHOTO_THUMB_LIMITS,
				),
			).toEqual({ isValid: false, code: 'PHOTO_INVALID' })
		})

		it('does not let the thumbnail floor of 1 px loosen the full photo (min 64)', () => {
			const result = readPhoto(toInput(createJpeg({ width: 2000, height: 1 })), PHOTO_FULL_LIMITS)

			expect(result).toEqual({ isValid: false, code: 'PHOTO_INVALID' })
		})
	})

	describe('byte limits', () => {
		it('takes a full photo of exactly the limit and refuses one byte more', () => {
			const atLimit = padTo(createJpeg(), PHOTO_MAX_BYTES)
			const above = padTo(createJpeg(), PHOTO_MAX_BYTES + 1)

			expect(readPhoto(toInput(atLimit), PHOTO_FULL_LIMITS).isValid).toBe(true)
			expect(readPhoto(toInput(above), PHOTO_FULL_LIMITS)).toEqual({
				isValid: false,
				code: 'PHOTO_TOO_LARGE',
			})
		})

		it('takes a thumbnail of exactly the limit and refuses one byte more', () => {
			const atLimit = padTo(createJpeg({ width: 768, height: 576 }), PHOTO_THUMB_MAX_BYTES)
			const above = padTo(createJpeg({ width: 768, height: 576 }), PHOTO_THUMB_MAX_BYTES + 1)

			expect(readPhoto(toInput(atLimit), PHOTO_THUMB_LIMITS).isValid).toBe(true)
			expect(readPhoto(toInput(above), PHOTO_THUMB_LIMITS)).toEqual({
				isValid: false,
				code: 'PHOTO_TOO_LARGE',
			})
		})

		it('checks the byte limit before the type, so an oversized non-JPEG is TOO_LARGE', () => {
			const heavyPng = Buffer.concat([createPng(), Buffer.alloc(PHOTO_THUMB_MAX_BYTES)])

			expect(readPhoto(toInput(heavyPng), PHOTO_THUMB_LIMITS)).toEqual({
				isValid: false,
				code: 'PHOTO_TOO_LARGE',
			})
		})
	})

	it('falls back to the message limits when none are given', () => {
		const thumbLike = createJpeg({ width: 600, height: 32 })

		expect(readPhoto(toInput(thumbLike))).toEqual({ isValid: false, code: 'PHOTO_INVALID' })
		expect(readPhoto(toInput(thumbLike), PHOTO_THUMB_LIMITS).isValid).toBe(true)
	})
})
