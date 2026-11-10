import { type ChatMessage, TRAINING_ONBOARDING_LAST_QUESTION } from '@kus/shared'

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

/** The file of a message with exactly one stored photo; null when it is gone or was never stored. */
const getStoredPhotoId = (message: ChatMessage): string | null => {
	const photos = message.photos ?? []
	return photos.length === 1 ? (photos[0]?.fileId ?? null) : null
}

const getServerUserState = (
	message: ChatMessage,
	now: Date,
): { state: UserItemState; error: SendError | null } => {
	// a photo with no file on the server (the old inline flow): a resend can not bring it back
	const failure = message.photo && !getStoredPhotoId(message) ? PHOTO_LOST_FAILURE : STORED_FAILURE
	if (message.status === 'FAILED') return { state: 'failed', error: failure }
	if (message.status !== 'PENDING' && message.status !== 'STREAMING') {
		return { state: 'sent', error: null }
	}
	return isLostTurn(message, now)
		? { state: 'failed', error: failure }
		: { state: 'sending', error: null }
}

const getOutboxPhoto = (item: OutboxItem): FeedPhoto | undefined => {
	if (item.photo) {
		const { previewUrl: url, width, height } = item.photo
		return { kind: 'preview', url, width, height }
	}
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
				...(item.onboardingAnswer ? { onboardingAnswer: item.onboardingAnswer } : {}),
				...(item.sendNow ? { sendNow: true } : {}),
			},
	// «Прибрати» is always there: an unsent message is never lost silently, and never stuck
	dismiss: { target: 'outbox', id: item.clientMessageId },
	photo: getOutboxPhoto(item),
	uploadProgress:
		item.status === 'sending' ? params.uploadProgress?.[item.clientMessageId] : undefined,
})

const getServerPhoto = (message: ChatMessage, params: BuildFeedParams): FeedPhoto | undefined => {
	const [stored] = message.photos ?? []
	// the old `photo` without `photos`: only the fact that it was there
	if (!stored) return message.photo ? { kind: 'placeholder' } : undefined
	const previewUrl =
		message.clientMessageId === null ? undefined : params.previews?.[message.clientMessageId]
	return {
		kind: 'stored',
		fileId: stored.fileId,
		width: stored.width,
		height: stored.height,
		...(previewUrl === undefined ? {} : { previewUrl }),
	}
}

const toEntry = (message: ChatMessage, params: BuildFeedParams): Entry => {
	if (message.role === 'ASSISTANT') return { kind: 'kusik', message }
	const text = message.content ?? ''
	const serverPhoto = getServerPhoto(message, params)
	const photoId = getStoredPhotoId(message)
	// a stored photo is resent by its id, without an upload; a photo without a file can not be resent
	const retry =
		message.clientMessageId === null || (message.photo && !photoId)
			? null
			: {
					clientMessageId: message.clientMessageId,
					text,
					...(photoId ? { photoId } : {}),
				}
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
				// the server copy stays behind the resend: «Прибрати» drops both
				dismiss: { target: 'server', id: message.id, clientMessageId: outboxItem.clientMessageId },
				photo: outboxItem.photo
					? getOutboxPhoto(outboxItem)
					: (serverPhoto ?? getOutboxPhoto(outboxItem)),
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
			dismiss: state === 'failed' ? { target: 'server', id: message.id } : null,
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

const getCreatedAt = (entry: Entry): string =>
	entry.kind === 'user' ? entry.user.createdAt : entry.message.createdAt

/**
 * Server messages (minus the hidden ones) and what is still only on this device, oldest first by
 * createdAt: a message that waited in the outbox for hours stays where it was written. The sort is
 * stable, so the server's own order holds for equal times.
 */
const getEntries = (params: BuildFeedParams): Entry[] => {
	const messages = params.pages
		.flat()
		.toReversed()
		.filter((message) => !(message.role === 'USER' && params.hiddenIds?.has(message.id)))
	const knownIds = new Set(messages.flatMap((message) => message.clientMessageId ?? []))
	const local = Object.values(params.outbox)
		.filter((item) => !knownIds.has(item.clientMessageId))
		.map((item): Entry => ({ kind: 'user', user: fromOutbox(item, params) }))
	return [...messages.map((message) => toEntry(message, params)), ...local].toSorted(
		(a, b) => Date.parse(getCreatedAt(a)) - Date.parse(getCreatedAt(b)),
	)
}

/**
 * Kusik's greeting opens a day nobody has written in yet. The server's messages decide it (so a
 * message from another device counts, even one the user hid), plus this device's unsent ones: the
 * greeting must not vanish from under a message only because its server copy has just arrived.
 */
const isTodayEmpty = (params: BuildFeedParams): boolean => {
	const isToday = (createdAt: string): boolean =>
		getLocalDateString(new Date(Date.parse(createdAt)), params.timeZone) === params.today
	return (
		!params.pages.some((page) => page.some((message) => isToday(message.createdAt))) &&
		!Object.values(params.outbox).some((item) => isToday(item.createdAt))
	)
}

/**
 * Unsent since another local day: a resend would log it today, so it is offered as «send now» and
 * sits at the end of the feed instead of among the history of its own day.
 */
const isStaleFailureEntry = (entry: Entry, params: BuildFeedParams): boolean => {
	if (entry.kind !== 'user' || entry.user.state !== 'failed' || !entry.user.error?.canRetry) {
		return false
	}
	const localDate = getLocalDateString(new Date(Date.parse(entry.user.createdAt)), params.timeZone)
	return localDate !== params.today
}

/**
 * A stale message is resent with `sendNow`: the API logs a resend of the same id on the day it was
 * written, unless asked otherwise. The id stays (a photo is bound to its first message).
 */
const getFailureRetry = (user: UserEntry, isStale: boolean): RetryParams | null => {
	if (!user.error?.canRetry || !user.retry) return null
	return isStale ? { ...user.retry, sendNow: true } : user.retry
}

const getDayLabel = (localDate: string, { today, yesterday }: BuildFeedParams) => {
	if (localDate === today) return 'today'
	if (localDate === yesterday) return 'yesterday'
	return 'date'
}

/**
 * The chat as the user reads it, oldest first: day pills, times, bubbles, «Не надіслано» with
 * Kusik's «ой», the typing dots. Today always has its pill, and the greeting while it is empty; the day before
 * today ends with its recap.
 */
export const buildFeed = (params: BuildFeedParams): FeedItem[] => {
	const items: FeedItem[] = []
	const photoStatusByUserId = getPhotoStatuses(params)
	const isGreetingShown = isTodayEmpty(params)
	// mutated by openDay, so an object: TS would narrow a plain `let` to its initial value
	const cursor: {
		day: string | null
		previousAt: number | null
		hasUserMessage: boolean
		/** The last Kusik message before this one: the fifth question tells where a program card comes from. */
		previousKusik: ChatMessage | null
	} = {
		day: null,
		previousAt: null,
		hasUserMessage: false,
		previousKusik: null,
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
		if (localDate === params.today && isGreetingShown) {
			items.push({ kind: 'greeting', key: 'greeting' })
		}
	}

	const pushUser = (user: UserEntry, isStale: boolean): void => {
		items.push({
			kind: 'user',
			key: user.key,
			text: user.text,
			state: user.state,
			...(user.photo ? { photo: user.photo } : {}),
			...(user.uploadProgress === undefined ? {} : { uploadProgress: user.uploadProgress }),
		})
		if (user.state !== 'failed' || !user.error) return
		items.push({
			kind: 'failure',
			key: `failure-${user.key}`,
			error: user.error,
			retry: getFailureRetry(user, isStale),
			dismiss: user.dismiss,
			// the day it was written, only when a retry would log it on a later day
			staleSince:
				isStale && user.retry
					? getLocalDateString(new Date(Date.parse(user.createdAt)), params.timeZone)
					: null,
		})
	}

	const entries = getEntries(params)
	const staleEntries = entries.filter((entry) => isStaleFailureEntry(entry, params))
	for (const entry of entries.filter((item) => !staleEntries.includes(item))) {
		const createdAt = getCreatedAt(entry)
		const at = Date.parse(createdAt)
		const localDate = getLocalDateString(new Date(at), params.timeZone)
		if (localDate !== cursor.day) openDay(localDate)

		if (entry.kind === 'kusik') {
			const photoStatus = photoStatusByUserId.get(entry.message.replyToId ?? '')
			const isFromOnboarding =
				entry.message.programCard?.changes.initial === true &&
				cursor.previousKusik?.trainingOnboarding?.step === TRAINING_ONBOARDING_LAST_QUESTION
			items.push({
				kind: 'kusik',
				key: entry.message.id,
				message: entry.message,
				...(photoStatus ? { photoStatus } : {}),
				...(isFromOnboarding ? { isFromOnboarding } : {}),
			})
			cursor.previousKusik = entry.message
		} else {
			const isGap = cursor.previousAt !== null && at - cursor.previousAt >= TIME_GAP_MS
			if (!cursor.hasUserMessage || isGap) {
				items.push({ kind: 'time', key: `time-${entry.user.key}`, at: createdAt })
			}
			cursor.hasUserMessage = true
			pushUser(entry.user, false)
		}
		cursor.previousAt = at
	}

	if (cursor.day !== params.today) openDay(params.today)
	// after today's pill, outside the day grouping: no pill or time of their own, the text names the date
	for (const entry of staleEntries) {
		if (entry.kind === 'user') pushUser(entry.user, true)
	}
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
