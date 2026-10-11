import { describe, expect, it } from 'vitest'

import {
	chatMessageSchema,
	PHOTO_MAX_BASE64_LENGTH,
	PHOTO_MAX_BYTES,
	sendMessageRequestSchema,
	TEXT_OR_PHOTO_REQUIRED,
} from './messages.js'

const clientMessageId = '0198f0d2-6b1c-7c3e-9a4b-1a2b3c4d5e6f'
const photo = { mimeType: 'image/jpeg', data: 'AAAA' }

describe('sendMessageRequestSchema', () => {
	it('accepts a text, a photo, or both', () => {
		expect(sendMessageRequestSchema.parse({ clientMessageId, text: 'борщ' }).text).toBe('борщ')
		expect(sendMessageRequestSchema.parse({ clientMessageId, photo }).photo).toEqual(photo)
		expect(sendMessageRequestSchema.parse({ clientMessageId, text: '150 г', photo })).toEqual({
			clientMessageId,
			text: '150 г',
			photo,
		})
	})

	it('needs a text or a photo', () => {
		for (const body of [{ clientMessageId }, { clientMessageId, text: '   ' }]) {
			const result = sendMessageRequestSchema.safeParse(body)
			expect(result.success).toBe(false)
			if (result.success) continue
			expect(result.error.issues.map((issue) => issue.message)).toEqual([TEXT_OR_PHOTO_REQUIRED])
		}
	})

	it('treats a blank text next to a photo as no text', () => {
		const parsed = sendMessageRequestSchema.parse({ clientMessageId, text: '  ', photo })
		expect(parsed.text).toBeUndefined()
	})

	it('trims the text and keeps the length limit', () => {
		expect(sendMessageRequestSchema.parse({ clientMessageId, text: '  а  ' }).text).toBe('а')
		expect(
			sendMessageRequestSchema.safeParse({ clientMessageId, text: 'а'.repeat(2001) }).success,
		).toBe(false)
	})

	it('rejects a photo that is not base64, of an unknown type, or too long', () => {
		const rejected = [
			{ ...photo, data: 'not base64!' },
			{ ...photo, mimeType: 'image/gif' },
			{ ...photo, data: 'A'.repeat(PHOTO_MAX_BASE64_LENGTH + 4) },
		]
		for (const bad of rejected) {
			expect(sendMessageRequestSchema.safeParse({ clientMessageId, photo: bad }).success).toBe(
				false,
			)
		}
	})

	it('lets the base64 limit hold a photo of the byte limit', () => {
		expect(PHOTO_MAX_BASE64_LENGTH).toBeGreaterThanOrEqual(Math.ceil((PHOTO_MAX_BYTES * 4) / 3))
	})
})

describe('chatMessageSchema photo', () => {
	const base = {
		id: clientMessageId,
		role: 'USER',
		content: null,
		status: 'COMPLETED',
		clientMessageId,
		replyToId: null,
		createdAt: '2026-10-11T10:00:00.000Z',
		meals: [],
		clarifications: [],
	}

	it('is null or a status', () => {
		expect(chatMessageSchema.parse({ ...base, photo: null }).photo).toBeNull()
		expect(chatMessageSchema.parse({ ...base, photo: { status: 'FAILED' } }).photo).toEqual({
			status: 'FAILED',
		})
		expect(chatMessageSchema.safeParse({ ...base, photo: { status: 'LOST' } }).success).toBe(false)
	})
})
