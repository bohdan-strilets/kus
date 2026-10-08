import type { ChatMessage } from '@kus/shared'

import { isLostTurn } from '@/entities/message'
import { type OutboxItem, type SendError, STORED_FAILURE } from '@/features/send-message'
import { getLocalDateString } from '@/shared/lib'

import type { FeedItem, RetryParams, UserItemState } from '../model/feed.types'

/** A gap this long between messages shows the time again. */
const TIME_GAP_MS = 60 * 60 * 1000

export interface BuildFeedParams {
	/** Every loaded page, newest first — as the API sends them. */
	pages: readonly (readonly ChatMessage[])[]
	outbox: Readonly<Record<string, OutboxItem>>
	timeZone: string
	today: string
	yesterday: string
	now: Date
}

interface UserEntry {
	key: string
	text: string
	createdAt: string
	state: UserItemState
	error: SendError | null
	retry: RetryParams | null
}

type Entry = { kind: 'user'; user: UserEntry } | { kind: 'kusik'; message: ChatMessage }

const getServerUserState = (
	message: ChatMessage,
	now: Date,
): { state: UserItemState; error: SendError | null } => {
	if (message.status === 'FAILED') return { state: 'failed', error: STORED_FAILURE }
	if (message.status !== 'PENDING' && message.status !== 'STREAMING') {
		return { state: 'sent', error: null }
	}
	return isLostTurn(message, now)
		? { state: 'failed', error: STORED_FAILURE }
		: { state: 'sending', error: null }
}

const fromOutbox = (item: OutboxItem): UserEntry => ({
	key: item.clientMessageId,
	text: item.text,
	createdAt: item.createdAt,
	state: item.status,
	error: item.error,
	retry: { clientMessageId: item.clientMessageId, text: item.text },
})

const toEntry = (message: ChatMessage, params: BuildFeedParams): Entry => {
	if (message.role === 'ASSISTANT') return { kind: 'kusik', message }
	const text = message.content ?? ''
	const retry =
		message.clientMessageId === null ? null : { clientMessageId: message.clientMessageId, text }
	// the client's own state of a resend wins over the copy the server had before it
	const outboxItem =
		message.clientMessageId === null ? undefined : params.outbox[message.clientMessageId]
	if (outboxItem && message.status !== 'COMPLETED') {
		return {
			kind: 'user',
			user: { ...fromOutbox(outboxItem), key: message.id, createdAt: message.createdAt },
		}
	}
	return {
		kind: 'user',
		user: {
			key: message.id,
			text,
			createdAt: message.createdAt,
			retry,
			...getServerUserState(message, params.now),
		},
	}
}

/** Server messages oldest first, then what is still only on this device. */
const getEntries = (params: BuildFeedParams): Entry[] => {
	const messages = params.pages.flat().toReversed()
	const knownIds = new Set(messages.flatMap((message) => message.clientMessageId ?? []))
	const local = Object.values(params.outbox)
		.filter((item) => !knownIds.has(item.clientMessageId))
		.toSorted((a, b) => a.createdAt.localeCompare(b.createdAt))
		.map((item): Entry => ({ kind: 'user', user: fromOutbox(item) }))
	return [...messages.map((message) => toEntry(message, params)), ...local]
}

const getCreatedAt = (entry: Entry): string =>
	entry.kind === 'user' ? entry.user.createdAt : entry.message.createdAt

const getDayLabel = (localDate: string, { today, yesterday }: BuildFeedParams) => {
	if (localDate === today) return 'today'
	if (localDate === yesterday) return 'yesterday'
	return 'date'
}

/**
 * The chat as the user reads it, oldest first: day pills, times, bubbles, «Не надіслано» with
 * Kusik's «ой», the typing dots. Today always has its pill and the greeting; the day before
 * today ends with its recap.
 */
export const buildFeed = (params: BuildFeedParams): FeedItem[] => {
	const items: FeedItem[] = []
	// mutated by openDay, so an object: TS would narrow a plain `let` to its initial value
	const cursor: { day: string | null; previousAt: number | null; hasUserMessage: boolean } = {
		day: null,
		previousAt: null,
		hasUserMessage: false,
	}

	const openDay = (localDate: string): void => {
		if (cursor.day === params.yesterday && localDate === params.today) {
			items.push({ kind: 'recap', key: `recap-${params.yesterday}`, localDate: params.yesterday })
		}
		cursor.day = localDate
		cursor.hasUserMessage = false
		items.push({
			kind: 'day',
			key: `day-${localDate}`,
			localDate,
			label: getDayLabel(localDate, params),
		})
		if (localDate === params.today) items.push({ kind: 'greeting', key: 'greeting' })
	}

	for (const entry of getEntries(params)) {
		const createdAt = getCreatedAt(entry)
		const at = Date.parse(createdAt)
		const localDate = getLocalDateString(new Date(at), params.timeZone)
		if (localDate !== cursor.day) openDay(localDate)

		if (entry.kind === 'kusik') {
			items.push({ kind: 'kusik', key: entry.message.id, message: entry.message })
		} else {
			const isGap = cursor.previousAt !== null && at - cursor.previousAt >= TIME_GAP_MS
			if (!cursor.hasUserMessage || isGap) {
				items.push({ kind: 'time', key: `time-${entry.user.key}`, at: createdAt })
			}
			cursor.hasUserMessage = true
			const { user } = entry
			items.push({ kind: 'user', key: user.key, text: user.text, state: user.state })
			if (user.state === 'failed' && user.error) {
				items.push({
					kind: 'failure',
					key: `failure-${user.key}`,
					error: user.error,
					retry: user.error.canRetry ? user.retry : null,
				})
			}
		}
		cursor.previousAt = at
	}

	if (cursor.day !== params.today) openDay(params.today)
	if (items.some((item) => item.kind === 'user' && item.state === 'sending')) {
		items.push({ kind: 'typing', key: 'typing' })
	}
	return items
}
