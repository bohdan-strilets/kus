import { imageSize } from 'image-size'
import { describe, expect, it } from 'vitest'

import { createJpeg, JPEG_SENTINEL } from '../../../test/fixtures/jpeg'
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

	it('cuts everything after the end marker', () => {
		const jpeg = createJpeg()
		const tail = Buffer.concat([
			Buffer.from([0xff, 0xe1, 0x00, 0x0a]),
			Buffer.from(`Exif\0\0${JPEG_SENTINEL}`, 'latin1'),
			Buffer.from([0x01, 0x02, 0x03]),
		])

		const stripped = stripJpegMetadata(Buffer.concat([jpeg, tail]), 'image/jpeg')

		expect(stripped).toEqual(jpeg)
		expect(stripped?.includes(JPEG_SENTINEL)).toBe(false)
	})

	it('keeps stuffed bytes, restart markers and a second scan, and still cuts the tail', () => {
		const jpeg = createJpeg()
		const sosHeader = Buffer.from([0xff, 0xda, 0x00, 0x08, 0x01, 0x01, 0x00, 0x00, 0x3f, 0x00])
		const firstScan = Buffer.from([
			0x12, 0xff, 0x00, 0x34, 0xff, 0xd0, 0x56, 0xff, 0xff, 0xd7, 0x78,
		])
		const dht = Buffer.from([0xff, 0xc4, 0x00, 0x04, 0xaa, 0xbb])
		const secondScan = Buffer.from([0x9a, 0xff, 0x00, 0xbc])
		const body = Buffer.concat([
			jpeg.subarray(0, -2),
			sosHeader,
			firstScan,
			dht,
			sosHeader,
			secondScan,
			Buffer.from([0xff, 0xd9]),
		])

		const stripped = stripJpegMetadata(
			Buffer.concat([body, Buffer.from('hidden tail', 'latin1')]),
			'image/jpeg',
		)

		expect(stripped).toEqual(body)
	})

	it('reports scan data that never reaches a marker as null', () => {
		const jpeg = createJpeg()
		const sosHeader = Buffer.from([0xff, 0xda, 0x00, 0x08, 0x01, 0x01, 0x00, 0x00, 0x3f, 0x00])
		const truncated = Buffer.concat([jpeg.subarray(0, -2), sosHeader, Buffer.from([0x12, 0x34])])
		expect(stripJpegMetadata(truncated, 'image/jpeg')).toBeNull()
	})

	it('reports a broken structure as null', () => {
		const jpeg = createJpeg({ hasSentinel: true })
		expect(stripJpegMetadata(jpeg.subarray(0, 12), 'image/jpeg')).toBeNull()
		expect(stripJpegMetadata(Buffer.from([0x00, 0x01]), 'image/jpeg')).toBeNull()
	})
})
