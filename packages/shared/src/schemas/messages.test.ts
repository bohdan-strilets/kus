import { describe, expect, it } from 'vitest'

import {
	chatMessageSchema,
	foodEntryResponseSchema,
	PHOTO_MAX_BASE64_LENGTH,
	PHOTO_AND_PHOTO_IDS_EXCLUSIVE,
	PHOTO_MAX_BYTES,
	sendMessageRequestSchema,
	TEXT_OR_PHOTO_REQUIRED,
} from './messages.js'
import { PHOTOS_PER_MESSAGE_LIMIT } from './photo-limits.js'
import { getStatsPeriodForDays, STATS_CARD_MIN_LOGGED_DAYS } from './stats-card.js'

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
		meals: [
			{ type: 'LUNCH', eatenAt: '2026-10-17T11:00:00.000Z', kcal: 800, hasUndetailed: false },
		],
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

describe('chatMessageSchema 0.7.0 fields', () => {
	const base = {
		id: clientMessageId,
		role: 'ASSISTANT',
		content: 'Ось тиждень',
		status: 'COMPLETED',
		clientMessageId: null,
		replyToId: clientMessageId,
		createdAt: '2026-10-19T10:00:00.000Z',
		photo: null,
		meals: [],
		clarifications: [],
		measurements: [],
		achievements: [],
	}
	const macros = { kcal: 1800, protein: 120, fat: 60, carbs: 200 }
	const oldDayCard = {
		version: 1,
		localDate: '2026-10-17',
		kind: 'past',
		asOf: null,
		totals: macros,
		goal: macros,
		remainingKcal: 0,
		meals: [],
	}
	const statsCard = {
		version: 1,
		period: 'week',
		from: '2026-10-12',
		to: '2026-10-18',
		loggedDays: 6,
		daysInNorm: 4,
		avgKcal: 1850.5,
		avgProteinG: 110,
		goalKcal: 2000,
		weightChangeKg: -0.4,
	}
	const fullStatsCard = {
		...statsCard,
		proteinGoalG: 120,
		weightStartKg: 82.4,
		weightEndKg: 82,
		days: [{ date: '2026-10-17', kcal: 1900, verdict: 'on_goal' }],
	}

	it('reads a day card stored before verdict and isClosing existed', () => {
		const card = chatMessageSchema.parse({ ...base, dayCard: oldDayCard }).dayCard
		expect(card?.verdict).toBeUndefined()
		expect(card?.isClosing).toBeUndefined()
	})

	it('takes the verdict and isClosing, and rejects an unknown verdict', () => {
		const closed = { ...oldDayCard, verdict: 'far_under', isClosing: true }
		expect(chatMessageSchema.parse({ ...base, dayCard: closed }).dayCard).toEqual(closed)
		expect(
			chatMessageSchema.safeParse({ ...base, dayCard: { ...oldDayCard, verdict: 'great' } })
				.success,
		).toBe(false)
	})

	it('takes null, no field at all (reads as null), and a snapshot', () => {
		expect(chatMessageSchema.parse(base).statsCard).toBeNull()
		expect(chatMessageSchema.parse({ ...base, statsCard: null }).statsCard).toBeNull()
		expect(chatMessageSchema.parse({ ...base, statsCard: fullStatsCard }).statsCard).toEqual(
			fullStatsCard,
		)
		expect(
			chatMessageSchema.parse({
				...base,
				statsCard: { ...statsCard, avgKcal: null, avgProteinG: null, weightChangeKg: null },
			}).statsCard?.avgKcal,
		).toBeNull()
	})

	it('reads a stats card stored without the new fields with their defaults', () => {
		expect(chatMessageSchema.parse({ ...base, statsCard }).statsCard).toEqual({
			...statsCard,
			proteinGoalG: null,
			weightStartKg: null,
			weightEndKg: null,
			days: [],
		})
	})

	it('reads an old entry and day card meal without copiedFromDate, isUndetailed, canRemember and hasUndetailed', () => {
		const entry = {
			id: clientMessageId,
			name: 'Гречка',
			grams: 100,
			quantity: null,
			kcal: 120,
			protein: 4,
			fat: 1,
			carbs: 23,
			fiber: null,
			category: 'porridge',
			source: 'LABEL',
			confidence: 0.9,
			assumption: null,
			isEdited: false,
		}
		const parsed = foodEntryResponseSchema.parse(entry)
		expect(parsed.copiedFromDate).toBeNull()
		expect(parsed.isUndetailed).toBe(false)
		expect(parsed.canRemember).toBe(false)
		expect(
			foodEntryResponseSchema.parse({ ...entry, copiedFromDate: '2026-10-17', isUndetailed: true }),
		).toMatchObject({ copiedFromDate: '2026-10-17', isUndetailed: true })
		expect(foodEntryResponseSchema.safeParse({ ...entry, copiedFromDate: '17.10' }).success).toBe(
			false,
		)
		const card = chatMessageSchema.parse({
			...base,
			dayCard: { ...oldDayCard, meals: [{ type: 'LUNCH', eatenAt: null, kcal: 1 }] },
		}).dayCard
		expect(card?.meals[0]?.hasUndetailed).toBe(false)
	})

	it('exports the minimum of logged days a stats card needs', () => {
		expect(STATS_CARD_MIN_LOGGED_DAYS).toBe(3)
	})

	it('reads a statsCard with periodDays, and one stored without it', () => {
		const withDays = chatMessageSchema.parse({
			...base,
			statsCard: { ...statsCard, periodDays: 15 },
		})
		expect(withDays.statsCard?.periodDays).toBe(15)
		expect(chatMessageSchema.parse({ ...base, statsCard }).statsCard?.periodDays).toBeUndefined()
	})

	it('keeps week|month for older clients: 7 and 30 as they are, other lengths the nearer', () => {
		expect([2, 7, 18, 19, 30, 92].map(getStatsPeriodForDays)).toEqual([
			'week',
			'week',
			'week',
			'month',
			'month',
			'month',
		])
	})

	it('reads a statsCard of another period, version or a periodDays out of bounds as no card, keeping the message', () => {
		for (const bad of [
			{ period: 'year' },
			{ version: 2 },
			{ to: '19.10.2026' },
			{ periodDays: 1 },
			{ periodDays: 93 },
		]) {
			const parsed = chatMessageSchema.safeParse({ ...base, statsCard: { ...statsCard, ...bad } })
			expect(parsed.success).toBe(true)
			expect(parsed.data?.statsCard).toBeNull()
			expect(parsed.data?.content).toBe(base.content)
		}
	})
})

describe('chatMessageSchema memory fields', () => {
	const base = {
		id: clientMessageId,
		role: 'ASSISTANT',
		content: 'Запам’ятав.',
		status: 'COMPLETED',
		clientMessageId: null,
		replyToId: clientMessageId,
		createdAt: '2026-10-30T10:00:00.000Z',
		photo: null,
		meals: [],
		clarifications: [],
		measurements: [],
		achievements: [],
	}

	it('defaults savedFoods and factProposal for a payload of an older server', () => {
		const parsed = chatMessageSchema.parse(base)

		expect(parsed.savedFoods).toEqual([])
		expect(parsed.factProposal).toBeNull()
	})

	it('reads the saved foods and the proposal', () => {
		const factProposal = { id: clientMessageId, text: 'Не їсть рибу', status: 'PROPOSED' }
		const savedFoods = [{ id: clientMessageId, name: 'Кабаноси' }]

		expect(chatMessageSchema.parse({ ...base, savedFoods, factProposal })).toMatchObject({
			savedFoods,
			factProposal,
		})
	})
})
