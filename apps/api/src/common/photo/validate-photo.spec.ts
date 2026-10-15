import { describe, expect, it } from 'vitest'

import { createJpeg } from '../../../test/fixtures/jpeg'
import { readPhoto } from './read-photo'
import { validatePhoto } from './validate-photo'

describe('validatePhoto', () => {
	it('accepts a JPEG and reads its size', () => {
		expect(
			validatePhoto({ bytes: createJpeg({ width: 640, height: 480 }), mimeType: 'image/jpeg' }),
		).toEqual({ isValid: true, width: 640, height: 480 })
	})

	it('refuses bytes that do not match the declared type', () => {
		const jpeg = createJpeg()
		expect(validatePhoto({ bytes: jpeg, mimeType: 'image/png' })).toEqual({
			isValid: false,
			code: 'UNSUPPORTED_IMAGE',
		})
		expect(validatePhoto({ bytes: Buffer.from('GIF89a......'), mimeType: 'image/jpeg' })).toEqual({
			isValid: false,
			code: 'UNSUPPORTED_IMAGE',
		})
	})

	it('refuses a photo above the byte limit before looking inside', () => {
		const huge = Buffer.concat([createJpeg(), Buffer.alloc(1_400_000)])
		expect(validatePhoto({ bytes: huge, mimeType: 'image/jpeg' })).toEqual({
			isValid: false,
			code: 'PHOTO_TOO_LARGE',
		})
	})

	it('refuses sides outside 64..2576 and unreadable headers', () => {
		for (const size of [
			{ width: 2577, height: 480 },
			{ width: 640, height: 63 },
		]) {
			expect(validatePhoto({ bytes: createJpeg(size), mimeType: 'image/jpeg' })).toEqual({
				isValid: false,
				code: 'PHOTO_INVALID',
			})
		}
		expect(validatePhoto({ bytes: createJpeg().subarray(0, 8), mimeType: 'image/jpeg' })).toEqual({
			isValid: false,
			code: 'PHOTO_INVALID',
		})
	})
})

describe('readPhoto', () => {
	it('returns a payload without the metadata of the upload', () => {
		const jpeg = createJpeg({ hasSentinel: true })
		const result = readPhoto({ mimeType: 'image/jpeg', data: jpeg.toString('base64') })
		expect(result.isValid).toBe(true)
		if (!result.isValid) return
		expect(result.payload.bytes.length).toBeLessThan(jpeg.length)
		expect(result.payload.width).toBe(640)
	})
})
