import { PHOTO_AND_PHOTO_IDS_EXCLUSIVE, TEXT_OR_PHOTO_REQUIRED } from '@kus/shared'
import { describe, expect, it } from 'vitest'

import { createJpeg, JPEG_SENTINEL, toBase64 } from '../../../../test/fixtures/jpeg'
import { DUPLICATE_PHOTO_IDS, SendMessageDto } from './send-message.dto'

const CLIENT_MESSAGE_ID = '0192a000-0000-7000-8000-000000000010'
const FILE_A = '0192a000-0000-7000-8000-0000000000a1'
const FILE_B = '0192a000-0000-7000-8000-0000000000b2'

const photo = (jpeg: Buffer = createJpeg()) => ({ mimeType: 'image/jpeg', data: toBase64(jpeg) })

const parse = (body: Record<string, unknown>) =>
	SendMessageDto.schema.safeParse({ clientMessageId: CLIENT_MESSAGE_ID, ...body })

const getIssues = (body: Record<string, unknown>): { path: string; message: string }[] => {
	const result = parse(body)
	if (result.success) return []
	return result.error.issues.map((issue) => ({
		path: issue.path.join('.'),
		message: issue.message,
	}))
}

describe('SendMessageDto schema', () => {
	it('passes photoIds through and leaves photo empty', () => {
		const result = parse({ photoIds: [FILE_A] })

		expect(result.success).toBe(true)
		if (!result.success) return
		expect(result.data.photoIds).toEqual([FILE_A])
		expect(result.data.photo).toBeUndefined()
	})

	it('takes the text together with photoIds', () => {
		const result = parse({ text: ' 150 г ', photoIds: [FILE_A] })

		expect(result.success).toBe(true)
		if (!result.success) return
		expect(result.data).toMatchObject({ text: '150 г', photoIds: [FILE_A] })
	})

	it('rejects the same id twice with DUPLICATE_PHOTO_IDS on photoIds', () => {
		expect(getIssues({ photoIds: [FILE_A, FILE_A] })).toEqual([
			{ path: 'photoIds', message: DUPLICATE_PHOTO_IDS },
		])
	})

	it('accepts distinct ids', () => {
		expect(parse({ photoIds: [FILE_A, FILE_B] }).success).toBe(true)
	})

	it('rejects photo and photoIds together', () => {
		const issues = getIssues({ photo: photo(), photoIds: [FILE_A] })

		expect(issues).toEqual([{ path: 'photoIds', message: PHOTO_AND_PHOTO_IDS_EXCLUSIVE }])
	})

	it.each([
		['an empty list', []],
		['an id that is not a uuid', ['not-a-uuid']],
		[
			'seven ids',
			Array.from({ length: 7 }, (_, index) => `0192a000-0000-7000-8000-00000000000${index}`),
		],
	])('rejects photoIds with %s', (_name, photoIds) => {
		expect(parse({ photoIds }).success).toBe(false)
	})

	it('still needs a text or a photo', () => {
		expect(getIssues({})).toEqual([{ path: '', message: TEXT_OR_PHOTO_REQUIRED }])
	})

	it('turns an inline photo into a checked payload without metadata', () => {
		const result = parse({ photo: photo(createJpeg({ hasSentinel: true })) })

		expect(result.success).toBe(true)
		if (!result.success) return
		expect(result.data.photoIds).toBeUndefined()
		expect(result.data.photo).toMatchObject({ width: 640, height: 480, mimeType: 'image/jpeg' })
		expect(result.data.photo?.bytes.includes(JPEG_SENTINEL)).toBe(false)
	})

	it('reports a broken inline photo by its code on photo, without the data', () => {
		const issues = getIssues({ photo: photo(createJpeg({ width: 3000, height: 480 })) })

		expect(issues).toEqual([{ path: 'photo', message: 'PHOTO_INVALID' }])
	})
})
