import type { ChatMessage } from '@kus/shared'
import { describe, expect, it } from 'vitest'

import type { OutboxItem } from '@/features/send-message'

import { buildFeed, type BuildFeedParams } from './build-feed'

const TZ = 'Europe/Warsaw'
const NOW = new Date('2026-10-07T16:20:00Z')

let sequence = 0
const message = (overrides: Partial<ChatMessage> & Pick<ChatMessage, 'createdAt'>): ChatMessage => {
	sequence += 1
	return {
		id: `0199b3a4-0000-7000-8000-${String(sequence).padStart(12, '0')}`,
		role: 'USER',
		content: 'їжа',
		status: 'COMPLETED',
		clientMessageId: `client-${sequence}`,
		replyToId: null,
		meals: [],
		clarifications: [],
		...overrides,
	}
}
const reply = (createdAt: string): ChatMessage =>
	message({ role: 'ASSISTANT', content: 'Записав!', clientMessageId: null, createdAt })

const params = (
	oldestFirst: ChatMessage[],
	outbox: Record<string, OutboxItem> = {},
): BuildFeedParams => ({
	// the API sends newest first
	pages: [oldestFirst.toReversed()],
	outbox,
	timeZone: TZ,
	today: '2026-10-07',
	yesterday: '2026-10-06',
	now: NOW,
})

const kinds = (feed: ReturnType<typeof buildFeed>): string[] =>
	feed.map((item) => (item.kind === 'day' ? `day:${item.label}` : item.kind))

describe('buildFeed', () => {
	it('gives an empty chat the today pill and the greeting', () => {
		expect(kinds(buildFeed(params([])))).toEqual(['day:today', 'greeting'])
	})

	it('groups by the user day, ends yesterday with its recap and greets today', () => {
		const feed = buildFeed(
			params([
				// 22:30 UTC on Oct 4 is already 00:30 on Oct 5 in Warsaw
				message({ createdAt: '2026-10-04T22:30:00Z' }),
				reply('2026-10-04T22:30:05Z'),
				message({ createdAt: '2026-10-06T06:40:00Z' }),
				reply('2026-10-06T06:40:06Z'),
				message({ createdAt: '2026-10-07T06:40:00Z' }),
				reply('2026-10-07T06:40:06Z'),
			]),
		)
		expect(kinds(feed)).toEqual([
			'day:date',
			'time',
			'user',
			'kusik',
			'day:yesterday',
			'time',
			'user',
			'kusik',
			'recap',
			'day:today',
			'greeting',
			'time',
			'user',
			'kusik',
		])
		expect(feed[0]).toMatchObject({ kind: 'day', localDate: '2026-10-05' })
	})

	it('repeats the time only after an hour of silence', () => {
		const feed = buildFeed(
			params([
				message({ createdAt: '2026-10-07T06:40:00Z' }),
				reply('2026-10-07T06:40:05Z'),
				message({ createdAt: '2026-10-07T07:10:00Z' }),
				reply('2026-10-07T07:10:05Z'),
				message({ createdAt: '2026-10-07T11:05:00Z' }),
			]),
		)
		expect(kinds(feed).filter((kind) => kind === 'time')).toHaveLength(2)
		expect(feed.flatMap((item) => (item.kind === 'time' ? [item.at] : []))).toEqual([
			'2026-10-07T06:40:00Z',
			'2026-10-07T11:05:00Z',
		])
	})

	it('shows a message still on its way after the server ones, with the typing dots', () => {
		const sending: OutboxItem = {
			clientMessageId: 'local-1',
			text: 'банан',
			createdAt: '2026-10-07T16:19:59Z',
			status: 'sending',
			error: null,
		}
		const feed = buildFeed(
			params([message({ createdAt: '2026-10-07T06:40:00Z' })], { 'local-1': sending }),
		)
		expect(kinds(feed).slice(-2)).toEqual(['user', 'typing'])
		expect(feed.at(-2)).toMatchObject({ kind: 'user', text: 'банан', state: 'sending' })
	})

	it('puts «ой» with a retry of the same id under a message that failed', () => {
		const failed: OutboxItem = {
			clientMessageId: 'local-1',
			text: 'борщ',
			createdAt: '2026-10-07T16:19:00Z',
			status: 'failed',
			error: { messageKey: 'chat.networkError', canRetry: true },
		}
		const feed = buildFeed(params([], { 'local-1': failed }))
		expect(feed.at(-1)).toEqual({
			kind: 'failure',
			key: 'failure-local-1',
			error: { messageKey: 'chat.networkError', canRetry: true },
			retry: { clientMessageId: 'local-1', text: 'борщ' },
		})
	})

	it('offers no retry when resending cannot help', () => {
		const tooLong: OutboxItem = {
			clientMessageId: 'local-1',
			text: 'цілий тиждень',
			createdAt: '2026-10-07T16:19:00Z',
			status: 'failed',
			error: { messageKey: 'errors.api.MESSAGE_TOO_LONG', canRetry: false },
		}
		expect(buildFeed(params([], { 'local-1': tooLong })).at(-1)).toMatchObject({ retry: null })
	})

	it('lets a FAILED server message be resent, and shows the resend instead of the old copy', () => {
		const failedOnServer = message({
			createdAt: '2026-10-07T12:00:00Z',
			status: 'FAILED',
			clientMessageId: 'client-x',
			content: 'суп',
		})
		const before = buildFeed(params([failedOnServer]))
		expect(before.at(-1)).toMatchObject({
			kind: 'failure',
			retry: { clientMessageId: 'client-x', text: 'суп' },
		})

		const resending: OutboxItem = {
			clientMessageId: 'client-x',
			text: 'суп',
			createdAt: NOW.toISOString(),
			status: 'sending',
			error: null,
		}
		const after = buildFeed(params([failedOnServer], { 'client-x': resending }))
		expect(kinds(after).filter((kind) => kind === 'user')).toHaveLength(1)
		expect(kinds(after).slice(-2)).toEqual(['user', 'typing'])
	})

	it('treats a PENDING turn as running for 2 minutes, then as failed', () => {
		const running = message({ createdAt: '2026-10-07T16:19:00Z', status: 'PENDING' })
		expect(kinds(buildFeed(params([running]))).at(-1)).toBe('typing')
		const lost = message({ createdAt: '2026-10-07T16:00:00Z', status: 'PENDING' })
		expect(kinds(buildFeed(params([lost]))).at(-1)).toBe('failure')
	})
})
