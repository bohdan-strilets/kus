import { describe, expect, it } from 'vitest'

import { COMPRESSION_ATTEMPTS, getTargetSize, PHOTO_MAX_SIDE_PX } from './compress-image.helpers'
import { EXIF_GPS_JPEG_BASE64 } from './fixtures/exif-gps.fixture'
import { hasJpegExif } from './fixtures/jpeg-exif'

const SOI = [0xff, 0xd8]
const EXIF_SEGMENT = [0xff, 0xe1, 0x00, 0x08, 0x45, 0x78, 0x69, 0x66, 0x00, 0x00]
const JFIF_SEGMENT = [0xff, 0xe0, 0x00, 0x06, 0x4a, 0x46, 0x49, 0x46]
const SCAN = [0xff, 0xda, 0x00, 0x02, 0x00]

describe('getTargetSize', () => {
	it('keeps the proportions while fitting the long side', () => {
		expect(getTargetSize(4032, 3024)).toEqual({ width: PHOTO_MAX_SIDE_PX, height: 1176 })
		expect(getTargetSize(3024, 4032)).toEqual({ width: 1176, height: PHOTO_MAX_SIDE_PX })
		expect(getTargetSize(4000, 2000, 1280)).toEqual({ width: 1280, height: 640 })
	})

	it('never enlarges a small photo', () => {
		expect(getTargetSize(800, 600)).toEqual({ width: 800, height: 600 })
	})
})

describe('COMPRESSION_ATTEMPTS', () => {
	it('goes from the best picture to the lightest', () => {
		expect(COMPRESSION_ATTEMPTS.map((attempt) => attempt.quality)).toEqual([0.8, 0.7, 0.6, 0.7])
		expect(COMPRESSION_ATTEMPTS.at(-1)?.maxSide).toBe(1280)
	})
})

describe('hasJpegExif', () => {
	it('finds the Exif block', () => {
		const jpeg = Uint8Array.from([...SOI, ...JFIF_SEGMENT, ...EXIF_SEGMENT, ...SCAN])
		expect(hasJpegExif(jpeg)).toBe(true)
	})

	it('is false without it, and stops at the scan', () => {
		expect(hasJpegExif(Uint8Array.from([...SOI, ...JFIF_SEGMENT, ...SCAN]))).toBe(false)
		expect(hasJpegExif(Uint8Array.from([...SOI, ...SCAN, ...EXIF_SEGMENT]))).toBe(false)
	})

	it('is false for a file that is not a JPEG', () => {
		expect(hasJpegExif(Uint8Array.from([0x89, 0x50, 0x4e, 0x47]))).toBe(false)
		expect(hasJpegExif(new Uint8Array())).toBe(false)
	})
})

describe('hasJpegExif on a camera-like JPEG', () => {
	const fixture = Uint8Array.from(atob(EXIF_GPS_JPEG_BASE64), (char) => char.charCodeAt(0))

	it('sees the Exif block with the GPS tags that a camera writes', () => {
		expect(hasJpegExif(fixture)).toBe(true)
		expect(new TextDecoder('latin1').decode(fixture)).toContain('KUSIK-GPS-SENTINEL')
	})
})
