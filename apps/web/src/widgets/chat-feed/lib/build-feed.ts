import type { ChatMessage } from '@kus/shared'

import { isLostTurn } from '@/entities/message'
import {
	type OutboxItem,
	PHOTO_LOST_FAILURE,
	type SendError,
	STORED_FAILURE,
} from '@/features/send-message'
import { getLocalDateString } from '@/shared/lib'

import type {
	FeedDismiss,
	FeedItem,
	FeedPhoto,
	FeedPhotoStatus,
	RetryParams,
	UserItemState,
} from '../model/feed.types'

/** A gap this long between messages shows the time again. */
const TIME_GAP_MS = 60 * 60 * 1000

export interface BuildFeedParams {
	/** Every loaded page, newest first — as the API sends them. */
	pages: readonly (readonly ChatMessage[])[]
	outbox: Readonly<Record<string, OutboxItem>>
	/** Pictures sent in this session, by clientMessageId (the server never has them). */
	previews?: Readonly<Record<string, string>>
	/** 0..1 of a photo uploaded, by clientMessageId, while its request runs. */
	uploadProgress?: Readonly<Record<string, number>>
	/** Server messages the user dropped with «Прибрати» (a photo that FAILED and can't be resent). */
	hiddenIds?: ReadonlySet<string>
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
	dismiss: FeedDismiss | null
	photo: FeedPhoto | undefined
	uploadProgress: number | undefined
}

type Entry = { kind: 'user'; user: UserEntry } | { kind: 'kusik'; message: ChatMessage }

const getServerUserState = (
	message: ChatMessage,
	now: Date,
): { state: UserItemState; error: SendError | null } => {
	// the picture was never stored: a resend can not bring it back
	const failure = message.photo ? PHOTO_LOST_FAILURE : STORED_FAILURE
	if (message.status === 'FAILED') return { state: 'failed', error: failure }
	if (message.status !== 'PENDING' && message.status !== 'STREAMING') {
		return { state: 'sent', error: null }
	}
	return isLostTurn(message, now)
		? { state: 'failed', error: failure }
		: { state: 'sending', error: null }
}

const getOutboxPhoto = (item: OutboxItem): FeedPhoto | undefined => {
	if (item.photo) return { kind: 'preview', url: item.photo.previewUrl }
	// restored after a reload: the picture is gone from the phone, but it was uploaded
	return item.photoLost || item.photoId ? { kind: 'placeholder' } : undefined
}

const fromOutbox = (item: OutboxItem, params: BuildFeedParams): UserEntry => ({
	key: item.clientMessageId,
	text: item.text,
	createdAt: item.createdAt,
	state: item.status,
	error: item.error,
	retry: item.photoLost
		? null
		: {
				clientMessageId: item.clientMessageId,
				text: item.text,
				photo: item.photo,
				photoId: item.photoId,
			},
	dismiss: item.photoLost ? { target: 'outbox', id: item.clientMessageId } : null,
	photo: getOutboxPhoto(item),
	uploadProgress:
		item.status === 'sending' ? params.uploadProgress?.[item.clientMessageId] : undefined,
})

const getServerPhoto = (message: ChatMessage, params: BuildFeedParams): FeedPhoto | undefined => {
	if (!message.photo) return undefined
	const url =
		message.clientMessageId === null ? undefined : params.previews?.[message.clientMessageId]
	return url === undefined ? { kind: 'placeholder' } : { kind: 'preview', url }
}

const toEntry = (message: ChatMessage, params: BuildFeedParams): Entry => {
	if (message.role === 'ASSISTANT') return { kind: 'kusik', message }
	const text = message.content ?? ''
	const serverPhoto = getServerPhoto(message, params)
	// a photo message can not be resent from the feed: the picture is not on the server
	const retry =
		message.clientMessageId === null || message.photo
			? null
			: { clientMessageId: message.clientMessageId, text }
	// the client's own state of a resend wins over the copy the server had before it
	const outboxItem =
		message.clientMessageId === null ? undefined : params.outbox[message.clientMessageId]
	if (outboxItem && message.status !== 'COMPLETED') {
		return {
			kind: 'user',
			user: {
				...fromOutbox(outboxItem, params),
				key: message.id,
				createdAt: message.createdAt,
				photo: getOutboxPhoto(outboxItem) ?? serverPhoto,
			},
		}
	}
	const { state, error } = getServerUserState(message, params.now)
	return {
		kind: 'user',
		user: {
			key: message.id,
			text,
			createdAt: message.createdAt,
			state,
			error,
			retry,
			// a photo that failed on the server stays a dead end otherwise: «Прибрати» hides it
			dismiss: message.photo && state === 'failed' ? { target: 'server', id: message.id } : null,
			photo: serverPhoto,
			uploadProgress: undefined,
		},
	}
}

/** How the photo of each user message went, by message id: the reply after it follows. */
const getPhotoStatuses = ({ pages }: BuildFeedParams): Map<string, FeedPhotoStatus> => {
	const statuses = new Map<string, FeedPhotoStatus>()
	for (const message of pages.flat()) {
		const status = message.photo?.status
		if (message.role === 'USER' && (status === 'PROCESSED' || status === 'FAILED')) {
			statuses.set(message.id, status)
		}
	}
	return statuses
}

/** Server messages oldest first (minus the hidden ones), then what is still only on this device. */
const getEntries = (params: BuildFeedParams): Entry[] => {
	const messages = params.pages
		.flat()
		.toReversed()
		.filter((message) => !(message.role === 'USER' && params.hiddenIds?.has(message.id)))
	const knownIds = new Set(messages.flatMap((message) => message.clientMessageId ?? []))
	const local = Object.values(params.outbox)
		.filter((item) => !knownIds.has(item.clientMessageId))
		.toSorted((a, b) => a.createdAt.localeCompare(b.createdAt))
		.map((item): Entry => ({ kind: 'user', user: fromOutbox(item, params) }))
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
	const photoStatusByUserId = getPhotoStatuses(params)
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
			const photoStatus = photoStatusByUserId.get(entry.message.replyToId ?? '')
			items.push({
				kind: 'kusik',
				key: entry.message.id,
				message: entry.message,
				...(photoStatus ? { photoStatus } : {}),
			})
		} else {
			const isGap = cursor.previousAt !== null && at - cursor.previousAt >= TIME_GAP_MS
			if (!cursor.hasUserMessage || isGap) {
				items.push({ kind: 'time', key: `time-${entry.user.key}`, at: createdAt })
			}
			cursor.hasUserMessage = true
			const { user } = entry
			items.push({
				kind: 'user',
				key: user.key,
				text: user.text,
				state: user.state,
				...(user.photo ? { photo: user.photo } : {}),
				...(user.uploadProgress === undefined ? {} : { uploadProgress: user.uploadProgress }),
			})
			if (user.state === 'failed' && user.error) {
				items.push({
					kind: 'failure',
					key: `failure-${user.key}`,
					error: user.error,
					retry: user.error.canRetry ? user.retry : null,
					dismiss: user.dismiss,
				})
			}
		}
		cursor.previousAt = at
	}

	if (cursor.day !== params.today) openDay(params.today)
	const sending = items.filter((item) => item.kind === 'user' && item.state === 'sending')
	if (sending.length > 0) {
		// the photo is still on its way: Kusik has nothing to think about yet
		const isUploading = sending.some(
			(item) => item.kind === 'user' && (item.uploadProgress ?? 1) < 1,
		)
		items.push({ kind: 'typing', key: 'typing', phase: isUploading ? 'uploading' : 'thinking' })
	}
	return items
}
