import { imageSize } from 'image-size'
import { describe, expect, it } from 'vitest'

import { createJpeg, JPEG_SENTINEL } from '../../../../test/fixtures/jpeg'
import { stripJpegMetadata } from './strip-jpeg-metadata'

describe('stripJpegMetadata', () => {
	it('removes APP1 and COM but keeps APP0, the frame header and the end marker', () => {
		const jpeg = createJpeg({ width: 800, height: 600, hasSentinel: true })
		expect(jpeg.includes(JPEG_SENTINEL)).toBe(true)

		const stripped = stripJpegMetadata(jpeg, 'image/jpeg')

		expect(stripped).not.toBeNull()
		expect(stripped?.includes(JPEG_SENTINEL)).toBe(false)
		expect(stripped?.includes(Buffer.from('JFIF'))).toBe(true)
		expect(stripped?.includes(Buffer.from([0xff, 0xc0]))).toBe(true)
		expect(stripped?.subarray(-2)).toEqual(Buffer.from([0xff, 0xd9]))
		expect(stripped && imageSize(stripped)).toMatchObject({ width: 800, height: 600 })
	})

	it('leaves a JPEG without metadata byte for byte the same', () => {
		const jpeg = createJpeg()
		expect(stripJpegMetadata(jpeg, 'image/jpeg')).toEqual(jpeg)
	})

	it('returns PNG and WebP as is', () => {
		const bytes = Buffer.from('not inspected')
		expect(stripJpegMetadata(bytes, 'image/png')).toBe(bytes)
		expect(stripJpegMetadata(bytes, 'image/webp')).toBe(bytes)
	})

	it('reports a broken structure as null', () => {
		const jpeg = createJpeg({ hasSentinel: true })
		expect(stripJpegMetadata(jpeg.subarray(0, 12), 'image/jpeg')).toBeNull()
		expect(stripJpegMetadata(Buffer.from([0x00, 0x01]), 'image/jpeg')).toBeNull()
	})
})
