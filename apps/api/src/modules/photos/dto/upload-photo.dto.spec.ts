import { PHOTO_MAX_BYTES, PHOTO_THUMB_MAX_BYTES } from '@kus/shared'
import { describe, expect, it } from 'vitest'

import { createJpeg, JPEG_SENTINEL, toBase64 } from '../../../../test/fixtures/jpeg'
import { UploadPhotoDto } from './upload-photo.dto'

const JPEG_MIME = 'image/jpeg'

const padTo = (jpeg: Buffer, totalBytes: number): Buffer =>
	Buffer.concat([jpeg, Buffer.alloc(totalBytes - jpeg.length)])

const toImage = (bytes: Buffer) => ({ mimeType: JPEG_MIME, data: toBase64(bytes) })

const createBody = ({
	photo = createJpeg({ width: 1200, height: 900 }),
	thumb = createJpeg({ width: 768, height: 576 }),
	width = 1200,
	height = 900,
}: { photo?: Buffer; thumb?: Buffer; width?: number; height?: number } = {}) => ({
	photo: toImage(photo),
	thumb: toImage(thumb),
	width,
	height,
})

const parse = (body: unknown) => UploadPhotoDto.schema.safeParse(body)

const getIssues = (body: unknown): { path: string; message: string }[] => {
	const result = parse(body)
	if (result.success) return []
	return result.error.issues.map((issue) => ({
		path: issue.path.join('.'),
		message: issue.message,
	}))
}

describe('UploadPhotoDto schema', () => {
	it('turns a valid body into two checked payloads without metadata', () => {
		const result = parse(
			createBody({ photo: createJpeg({ width: 1200, height: 900, hasSentinel: true }) }),
		)

		expect(result.success).toBe(true)
		if (!result.success) return
		expect(result.data.photo).toMatchObject({ width: 1200, height: 900 })
		expect(result.data.thumb).toMatchObject({ width: 768, height: 576 })
		expect(result.data.photo.bytes.includes(JPEG_SENTINEL)).toBe(false)
		expect(Object.keys(result.data).sort()).toEqual(['photo', 'thumb'])
	})

	it('takes the sizes from the bytes, not from the width and height of the body', () => {
		const result = parse(createBody({ width: 640, height: 480 }))

		expect(result.success).toBe(true)
		if (!result.success) return
		expect(result.data.photo).toMatchObject({ width: 1200, height: 900 })
	})

	it('reports the code of each broken image on its own field, never the data', () => {
		const issues = getIssues(
			createBody({
				photo: createJpeg({ width: 3000, height: 900, hasSentinel: true }),
				thumb: createJpeg({ width: 769, height: 576 }),
			}),
		)

		expect(issues).toEqual([
			{ path: 'photo', message: 'PHOTO_INVALID' },
			{ path: 'thumb', message: 'PHOTO_INVALID' },
		])
	})

	it('applies the thumbnail limits to the thumb and the full limits to the photo', () => {
		const tooSmallForPhoto = createJpeg({ width: 600, height: 32 })

		expect(getIssues(createBody({ photo: tooSmallForPhoto }))).toEqual([
			{ path: 'photo', message: 'PHOTO_INVALID' },
		])
		expect(getIssues(createBody({ thumb: tooSmallForPhoto }))).toEqual([])
	})

	it('refuses a PNG sent as the photo with UNSUPPORTED_IMAGE', () => {
		const png = Buffer.concat([
			Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
			Buffer.alloc(40),
		])

		expect(getIssues(createBody({ photo: png }))).toEqual([
			{ path: 'photo', message: 'UNSUPPORTED_IMAGE' },
		])
	})

	it('refuses a declared PNG at the schema level', () => {
		const body = createBody()

		expect(getIssues({ ...body, photo: { ...body.photo, mimeType: 'image/png' } })).toEqual([
			expect.objectContaining({ path: 'photo.mimeType' }),
		])
	})

	it('takes a photo of the byte limit and refuses one byte more with PHOTO_TOO_LARGE', () => {
		expect(
			parse(createBody({ photo: padTo(createJpeg({ width: 1200, height: 900 }), PHOTO_MAX_BYTES) }))
				.success,
		).toBe(true)

		expect(
			getIssues(
				createBody({ photo: padTo(createJpeg({ width: 1200, height: 900 }), PHOTO_MAX_BYTES + 1) }),
			),
		).toEqual([{ path: 'photo', message: 'PHOTO_TOO_LARGE' }])
	})

	it('refuses two bytes more already in the schema, on photo.data', () => {
		const issues = getIssues(
			createBody({ photo: padTo(createJpeg({ width: 1200, height: 900 }), PHOTO_MAX_BYTES + 2) }),
		)

		expect(issues.map((issue) => issue.path)).toEqual(['photo.data'])
	})

	it('takes a thumbnail of the byte limit and refuses one byte more', () => {
		const thumb = createJpeg({ width: 768, height: 576 })

		expect(parse(createBody({ thumb: padTo(thumb, PHOTO_THUMB_MAX_BYTES) })).success).toBe(true)
		const issues = getIssues(createBody({ thumb: padTo(thumb, PHOTO_THUMB_MAX_BYTES + 1) }))
		expect(issues).toHaveLength(1)
		expect(issues[0]?.path.startsWith('thumb')).toBe(true)
	})

	it.each([
		['a missing thumb', { photo: toImage(createJpeg()), width: 640, height: 480 }],
		['a missing photo', { thumb: toImage(createJpeg()), width: 640, height: 480 }],
		['a non-object body', 'text'],
		['null', null],
		['a body without the sizes', { photo: toImage(createJpeg()), thumb: toImage(createJpeg()) }],
	])('refuses %s', (_name, body) => {
		expect(parse(body).success).toBe(false)
	})
})
