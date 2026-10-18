import { describe, expect, it } from 'vitest'

import {
	chatMessageSchema,
	PHOTO_MAX_BASE64_LENGTH,
	PHOTO_AND_PHOTO_IDS_EXCLUSIVE,
	PHOTO_MAX_BYTES,
	sendMessageRequestSchema,
	TEXT_OR_PHOTO_REQUIRED,
} from './messages.js'
import { PHOTOS_PER_MESSAGE_LIMIT } from './photo-limits.js'

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

describe('sendMessageRequestSchema photoIds', () => {
	const ids = Array.from({ length: PHOTOS_PER_MESSAGE_LIMIT }, (_, index) =>
		clientMessageId.replace(/.$/, String(index)),
	)

	it('accepts photoIds without a text', () => {
		const parsed = sendMessageRequestSchema.parse({ clientMessageId, photoIds: ids })
		expect(parsed.photoIds).toEqual(ids)
		expect(parsed.text).toBeUndefined()
	})

	it('rejects more than the limit, an empty list and non-uuid ids', () => {
		const rejected = [[...ids, clientMessageId], [], ['not-a-uuid']]
		for (const photoIds of rejected) {
			expect(sendMessageRequestSchema.safeParse({ clientMessageId, photoIds }).success).toBe(false)
		}
	})

	it('rejects photo and photoIds together', () => {
		const result = sendMessageRequestSchema.safeParse({ clientMessageId, photo, photoIds: ids })
		expect(result.success).toBe(false)
		if (result.success) return
		expect(result.error.issues.map((issue) => issue.message)).toEqual([
			PHOTO_AND_PHOTO_IDS_EXCLUSIVE,
		])
	})

	it('still asks for a text or photos when photoIds is absent', () => {
		expect(sendMessageRequestSchema.safeParse({ clientMessageId }).success).toBe(false)
	})
})

describe('chatMessageSchema photos', () => {
	const base = {
		id: clientMessageId,
		role: 'USER',
		content: null,
		status: 'COMPLETED',
		clientMessageId,
		replyToId: null,
		createdAt: '2026-10-11T10:00:00.000Z',
		photo: null,
		meals: [],
		clarifications: [],
		measurements: [],
		achievements: [],
	}
	const item = {
		fileId: clientMessageId,
		width: 1568,
		height: 1176,
		status: 'PROCESSED',
		position: 0,
	}

	it('is optional, so a payload without it still parses', () => {
		expect(chatMessageSchema.parse(base).photos).toBeUndefined()
	})

	it('takes items with a file id or null', () => {
		const photos = [item, { ...item, fileId: null, position: 1 }]
		expect(chatMessageSchema.parse({ ...base, photos }).photos).toEqual(photos)
	})

	it('rejects a bad file id, status or position', () => {
		for (const bad of [{ fileId: 'x' }, { status: 'LOST' }, { position: -1 }]) {
			expect(chatMessageSchema.safeParse({ ...base, photos: [{ ...item, ...bad }] }).success).toBe(
				false,
			)
		}
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
		measurements: [],
		achievements: [],
	}

	it('is null or a status', () => {
		expect(chatMessageSchema.parse({ ...base, photo: null }).photo).toBeNull()
		expect(chatMessageSchema.parse({ ...base, photo: { status: 'FAILED' } }).photo).toEqual({
			status: 'FAILED',
		})
		expect(chatMessageSchema.safeParse({ ...base, photo: { status: 'LOST' } }).success).toBe(false)
	})
})

describe('chatMessageSchema dayCard', () => {
	const base = {
		id: clientMessageId,
		role: 'ASSISTANT',
		content: 'Ось день',
		status: 'COMPLETED',
		clientMessageId: null,
		replyToId: clientMessageId,
		createdAt: '2026-10-18T10:00:00.000Z',
		photo: null,
		meals: [],
		clarifications: [],
		measurements: [],
		achievements: [],
	}
	const macros = { kcal: 1800, protein: 120, fat: 60, carbs: 200 }
	const dayCard = {
		version: 1,
		localDate: '2026-10-17',
		kind: 'past',
		asOf: null,
		totals: macros,
		goal: { ...macros, kcal: 2000 },
		remainingKcal: 200,
		meals: [{ type: 'LUNCH', eatenAt: '2026-10-17T11:00:00.000Z', kcal: 800 }],
	}

	it('defaults to null when the payload has no such field', () => {
		expect(chatMessageSchema.parse(base).dayCard).toBeNull()
	})

	it('takes null and a full snapshot', () => {
		expect(chatMessageSchema.parse({ ...base, dayCard: null }).dayCard).toBeNull()
		expect(chatMessageSchema.parse({ ...base, dayCard }).dayCard).toEqual(dayCard)
	})

	it('takes a day without a goal', () => {
		const noGoal = { ...dayCard, goal: null, remainingKcal: null }
		expect(chatMessageSchema.parse({ ...base, dayCard: noGoal }).dayCard).toEqual(noGoal)
	})

	it('rejects an unknown version, kind, meal type and a bad date', () => {
		const rejected = [
			{ version: 2 },
			{ kind: 'yesterday' },
			{ localDate: '17.10.2026' },
			{ asOf: '2026-10-18' },
			{ meals: [{ type: 'BRUNCH', eatenAt: null, kcal: 1 }] },
		]
		for (const bad of rejected) {
			expect(
				chatMessageSchema.safeParse({ ...base, dayCard: { ...dayCard, ...bad } }).success,
			).toBe(false)
		}
	})
})
