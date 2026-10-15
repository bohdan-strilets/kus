import { describe, expect, it } from 'vitest'

import { PHOTO_MAX_BASE64_LENGTH, PHOTO_MAX_BYTES, PHOTO_MAX_SIDE_PX } from './messages.js'
import {
	PHOTO_TARGET_SIDE_PX,
	PHOTO_THUMB_MAX_BASE64_LENGTH,
	PHOTO_THUMB_MAX_BYTES,
	PHOTO_THUMB_SIDE_PX,
	PHOTOS_PER_MESSAGE_LIMIT,
} from './photo-limits.js'
import { uploadPhotoRequestSchema, uploadPhotoResponseSchema } from './photos.js'

const image = { mimeType: 'image/jpeg', data: 'AAAA' }
const request = { photo: image, thumb: image, width: 1568, height: 1176 }
const id = '0198f0d2-6b1c-7c3e-9a4b-1a2b3c4d5e6f'

describe('photo limits', () => {
	it('keeps the agreed values', () => {
		expect(PHOTO_TARGET_SIDE_PX).toBe(1568)
		expect(PHOTO_THUMB_SIDE_PX).toBe(768)
		expect(PHOTO_THUMB_MAX_BYTES).toBe(150_000)
		expect(PHOTOS_PER_MESSAGE_LIMIT).toBe(6)
	})

	it('keeps the client target under the server ceiling', () => {
		expect(PHOTO_TARGET_SIDE_PX).toBeLessThan(PHOTO_MAX_SIDE_PX)
		expect(PHOTO_THUMB_SIDE_PX).toBeLessThan(PHOTO_TARGET_SIDE_PX)
	})

	it('lets the thumb base64 limit hold the byte limit', () => {
		expect(PHOTO_THUMB_MAX_BASE64_LENGTH).toBeGreaterThanOrEqual(
			Math.ceil((PHOTO_THUMB_MAX_BYTES * 4) / 3),
		)
	})
})

describe('uploadPhotoRequestSchema', () => {
	it('accepts a photo with a thumb and sizes', () => {
		expect(uploadPhotoRequestSchema.parse(request)).toEqual(request)
	})

	it('rejects data that is not base64 or not a JPEG', () => {
		const rejected = [
			{ ...request, photo: { ...image, data: 'not base64!' } },
			{ ...request, thumb: { ...image, data: 'not base64!' } },
			{ ...request, photo: { ...image, mimeType: 'image/png' } },
			{ ...request, thumb: { ...image, mimeType: 'image/webp' } },
		]
		for (const bad of rejected) {
			expect(uploadPhotoRequestSchema.safeParse(bad).success).toBe(false)
		}
	})

	it('rejects a photo or a thumb over its limit', () => {
		const tooBigPhoto = { ...image, data: 'A'.repeat(PHOTO_MAX_BASE64_LENGTH + 4) }
		const tooBigThumb = { ...image, data: 'A'.repeat(PHOTO_THUMB_MAX_BASE64_LENGTH + 4) }
		expect(uploadPhotoRequestSchema.safeParse({ ...request, photo: tooBigPhoto }).success).toBe(
			false,
		)
		expect(uploadPhotoRequestSchema.safeParse({ ...request, thumb: tooBigThumb }).success).toBe(
			false,
		)
		expect(
			uploadPhotoRequestSchema.safeParse({
				...request,
				thumb: { ...image, data: 'A'.repeat(PHOTO_THUMB_MAX_BASE64_LENGTH) },
			}).success,
		).toBe(true)
		expect(PHOTO_THUMB_MAX_BASE64_LENGTH).toBeLessThan(PHOTO_MAX_BASE64_LENGTH)
		expect(PHOTO_MAX_BYTES).toBeGreaterThan(PHOTO_THUMB_MAX_BYTES)
	})

	it('rejects missing parts and sizes out of range', () => {
		const { thumb: _thumb, ...withoutThumb } = request
		const rejected = [withoutThumb, { ...request, width: 10 }, { ...request, height: 9999 }]
		for (const bad of rejected) {
			expect(uploadPhotoRequestSchema.safeParse(bad).success).toBe(false)
		}
	})
})

describe('uploadPhotoResponseSchema', () => {
	it('accepts an id with sizes', () => {
		const response = { id, width: 1568, height: 1176 }
		expect(uploadPhotoResponseSchema.parse(response)).toEqual(response)
	})

	it('rejects a non-uuid id and missing sizes', () => {
		expect(uploadPhotoResponseSchema.safeParse({ id: 'x', width: 1, height: 1 }).success).toBe(
			false,
		)
		expect(uploadPhotoResponseSchema.safeParse({ id }).success).toBe(false)
	})
})
