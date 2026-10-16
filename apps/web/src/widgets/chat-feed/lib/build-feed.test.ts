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
		measurements: [],
		achievements: [],
		photo: null,
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
			dismiss: null,
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

describe('buildFeed with photos', () => {
	const outboxPhoto = {
		previewUrl: 'blob:http://localhost/preview',
		base64: 'AAAA',
		thumbBase64: 'TTTT',
		mimeType: 'image/jpeg',
		width: 800,
		height: 600,
	} as const
	const outboxItem = (overrides: Partial<OutboxItem>): OutboxItem => ({
		clientMessageId: 'local-1',
		text: '',
		createdAt: '2026-10-07T16:10:00Z',
		status: 'sending',
		error: null,
		...overrides,
	})
	const userItem = (feed: ReturnType<typeof buildFeed>) => feed.find((item) => item.kind === 'user')
	const getPhoto = (feed: ReturnType<typeof buildFeed>) => {
		const user = userItem(feed)
		return user?.kind === 'user' ? user.photo : undefined
	}
	const FILE_ID = '0199b3a4-0000-7000-8000-0000000000f1'
	const OTHER_FILE_ID = '0199b3a4-0000-7000-8000-0000000000f2'
	const storedPhoto = (
		overrides: Partial<NonNullable<ChatMessage['photos']>[number]> = {},
	): NonNullable<ChatMessage['photos']>[number] => ({
		fileId: FILE_ID,
		width: 1568,
		height: 1176,
		status: 'PROCESSED',
		position: 0,
		...overrides,
	})

	it('shows the picture of a message on its way, with the upload progress and the uploading dots', () => {
		const item = outboxItem({ photo: outboxPhoto })
		const feed = buildFeed({
			...params([], { [item.clientMessageId]: item }),
			uploadProgress: { [item.clientMessageId]: 0.3 },
		})

		expect(userItem(feed)).toMatchObject({
			photo: { kind: 'preview', url: outboxPhoto.previewUrl },
			uploadProgress: 0.3,
		})
		expect(feed.at(-1)).toMatchObject({ kind: 'typing', phase: 'uploading' })
	})

	it('switches the dots to thinking once the upload is complete', () => {
		const item = outboxItem({ photo: outboxPhoto })
		const feed = buildFeed({
			...params([], { [item.clientMessageId]: item }),
			uploadProgress: { [item.clientMessageId]: 1 },
		})

		expect(feed.at(-1)).toMatchObject({ kind: 'typing', phase: 'thinking' })
	})

	it('offers a retry with the picture, and only «Прибрати» when the picture is gone', () => {
		const retriable = outboxItem({
			photo: outboxPhoto,
			status: 'failed',
			error: { messageKey: 'chat.networkError', canRetry: true },
		})
		const lost = outboxItem({
			clientMessageId: 'local-2',
			createdAt: '2026-10-07T16:11:00Z',
			photoLost: true,
			status: 'failed',
			error: { messageKey: 'chat.photoLost', canRetry: false },
		})
		const feed = buildFeed(
			params([], { [retriable.clientMessageId]: retriable, [lost.clientMessageId]: lost }),
		)
		const failures = feed.filter((item) => item.kind === 'failure')

		expect(failures[0]).toMatchObject({
			retry: { clientMessageId: 'local-1', photo: outboxPhoto },
			dismiss: null,
		})
		expect(failures[1]).toMatchObject({ retry: null, dismiss: { target: 'outbox', id: 'local-2' } })
		expect(feed.filter((item) => item.kind === 'user')[1]).toMatchObject({
			photo: { kind: 'placeholder' },
		})
	})

	it('draws a placeholder and offers a retry with the id for a photo restored after a reload', () => {
		const PHOTO_ID = '0199b3a4-0000-7000-8000-0000000000c1'
		const restored = outboxItem({
			photoId: PHOTO_ID,
			status: 'failed',
			error: { messageKey: 'errors.api.UNKNOWN', canRetry: true },
		})
		const feed = buildFeed(params([], { [restored.clientMessageId]: restored }))

		expect(userItem(feed)).toMatchObject({ photo: { kind: 'placeholder' } })
		expect(feed.find((item) => item.kind === 'failure')).toMatchObject({
			retry: { clientMessageId: 'local-1', text: '', photo: undefined, photoId: PHOTO_ID },
			dismiss: null,
		})
	})

	it('passes both the picture and its id to the retry while the session still has the picture', () => {
		const PHOTO_ID = '0199b3a4-0000-7000-8000-0000000000c1'
		const item = outboxItem({
			photo: outboxPhoto,
			photoId: PHOTO_ID,
			status: 'failed',
			error: { messageKey: 'chat.networkError', canRetry: true },
		})
		const feed = buildFeed(params([], { [item.clientMessageId]: item }))

		expect(userItem(feed)).toMatchObject({
			photo: { kind: 'preview', url: outboxPhoto.previewUrl },
		})
		expect(feed.find((entry) => entry.kind === 'failure')).toMatchObject({
			retry: { clientMessageId: 'local-1', photo: outboxPhoto, photoId: PHOTO_ID },
		})
	})

	it('offers only «Прибрати» for a photo the server dropped, even if the words are still there', () => {
		const lost = outboxItem({
			text: 'обід',
			photoLost: true,
			status: 'failed',
			error: { messageKey: 'chat.photoLost', canRetry: false },
		})
		const feed = buildFeed(params([], { [lost.clientMessageId]: lost }))

		expect(userItem(feed)).toMatchObject({ text: 'обід', photo: { kind: 'placeholder' } })
		expect(feed.find((item) => item.kind === 'failure')).toMatchObject({
			retry: null,
			dismiss: { target: 'outbox', id: 'local-1' },
		})
	})

	it.each(['errors.api.PHOTO_NOT_FOUND', 'errors.api.PHOTO_IN_USE'] as const)(
		'a final photo error %s leaves «Прибрати» as the only way out',
		(messageKey) => {
			const dead = outboxItem({
				text: 'обід',
				photoId: '0199b3a4-0000-7000-8000-0000000000c1',
				status: 'failed',
				error: { messageKey, canRetry: false },
			})
			const feed = buildFeed(params([], { [dead.clientMessageId]: dead }))

			expect(feed.find((item) => item.kind === 'failure')).toMatchObject({
				dismiss: { target: 'outbox', id: dead.clientMessageId },
			})
		},
	)

	it('has no photo and no photo id in the retry of a plain text message', () => {
		const text = outboxItem({
			text: 'борщ',
			status: 'failed',
			error: { messageKey: 'chat.networkError', canRetry: true },
		})
		const feed = buildFeed(params([], { [text.clientMessageId]: text }))

		const user = userItem(feed)
		expect(user?.kind === 'user' ? user.photo : 'not a user bubble').toBeUndefined()
		const failure = feed.find((item) => item.kind === 'failure')
		expect(failure?.kind === 'failure' ? failure.retry : 'not a failure').toEqual({
			clientMessageId: 'local-1',
			text: 'борщ',
		})
	})

	it('keeps showing the picture of a sent message while this session still has it', () => {
		const sent = message({
			createdAt: '2026-10-07T06:40:00Z',
			content: '150 г',
			photo: { status: 'PROCESSED' },
			photos: [storedPhoto()],
		})
		const feed = buildFeed({
			...params([sent]),
			previews: { [sent.clientMessageId ?? '']: 'blob:http://localhost/sent' },
		})

		expect(userItem(feed)).toMatchObject({
			state: 'sent',
			text: '150 г',
			photo: {
				kind: 'stored',
				fileId: FILE_ID,
				width: 1568,
				height: 1176,
				previewUrl: 'blob:http://localhost/sent',
			},
		})
	})

	it('shows a stored photo without a preview when this session never had the picture', () => {
		const sent = message({
			createdAt: '2026-10-07T06:40:00Z',
			photo: { status: 'PROCESSED' },
			photos: [storedPhoto()],
		})
		const photo = getPhoto(buildFeed(params([sent])))

		expect(photo).toEqual({ kind: 'stored', fileId: FILE_ID, width: 1568, height: 1176 })
		expect(photo).not.toHaveProperty('previewUrl')
	})

	it('ignores the preview of another message', () => {
		const sent = message({
			createdAt: '2026-10-07T06:40:00Z',
			photo: { status: 'PROCESSED' },
			photos: [storedPhoto()],
		})
		const feed = buildFeed({
			...params([sent]),
			previews: { 'client-other': 'blob:http://localhost/other' },
		})

		expect(getPhoto(feed)).not.toHaveProperty('previewUrl')
	})

	it('keeps fileId null when the stored file is gone', () => {
		const sent = message({
			createdAt: '2026-10-07T06:40:00Z',
			photo: { status: 'PROCESSED' },
			photos: [storedPhoto({ fileId: null })],
		})

		expect(getPhoto(buildFeed(params([sent])))).toMatchObject({ kind: 'stored', fileId: null })
	})

	it('takes the first of several stored photos', () => {
		const sent = message({
			createdAt: '2026-10-07T06:40:00Z',
			photo: { status: 'PROCESSED' },
			photos: [storedPhoto(), storedPhoto({ fileId: OTHER_FILE_ID, position: 1 })],
		})

		expect(getPhoto(buildFeed(params([sent])))).toMatchObject({ fileId: FILE_ID })
	})

	it('draws a placeholder for a photo the server reports without photos[], even with a preview', () => {
		const sent = message({
			createdAt: '2026-10-07T06:40:00Z',
			photo: { status: 'PROCESSED' },
		})
		const feed = buildFeed({
			...params([sent]),
			previews: { [sent.clientMessageId ?? '']: 'blob:http://localhost/sent' },
		})

		expect(getPhoto(feed)).toEqual({ kind: 'placeholder' })
	})

	it('draws a placeholder for photo with an empty photos[]', () => {
		const sent = message({
			createdAt: '2026-10-07T06:40:00Z',
			photo: { status: 'PROCESSED' },
			photos: [],
		})

		expect(getPhoto(buildFeed(params([sent])))).toEqual({ kind: 'placeholder' })
	})

	it('has no photo for a text message', () => {
		expect(getPhoto(buildFeed(params([message({ createdAt: '2026-10-07T06:40:00Z' })])))).toBe(
			undefined,
		)
	})

	it('passes the outbox size with the preview', () => {
		const item = outboxItem({ photo: outboxPhoto })
		const photo = getPhoto(buildFeed(params([], { [item.clientMessageId]: item })))

		expect(photo).toEqual({ kind: 'preview', url: outboxPhoto.previewUrl, width: 800, height: 600 })
	})

	it('prefers the outbox picture of a resend over the stored one of the server copy', () => {
		const pending = message({
			createdAt: '2026-10-07T16:10:00Z',
			status: 'FAILED',
			clientMessageId: 'local-1',
			photo: { status: 'PENDING' },
			photos: [storedPhoto()],
		})
		const item = outboxItem({ photo: outboxPhoto, status: 'sending' })
		const photo = getPhoto(buildFeed(params([pending], { [item.clientMessageId]: item })))

		expect(photo).toMatchObject({ kind: 'preview', url: outboxPhoto.previewUrl })
	})

	it('falls back to the stored photo of the server copy when the outbox has no picture', () => {
		const pending = message({
			createdAt: '2026-10-07T16:10:00Z',
			status: 'FAILED',
			clientMessageId: 'local-1',
			photo: { status: 'PENDING' },
			photos: [storedPhoto()],
		})
		const item = outboxItem({ status: 'sending' })
		const photo = getPhoto(buildFeed(params([pending], { [item.clientMessageId]: item })))

		expect(photo).toMatchObject({ kind: 'stored', fileId: FILE_ID })
	})

	it('retries a FAILED server message with a stored photo by its file id, with the stored-failure text', () => {
		const failed = message({
			createdAt: '2026-10-07T16:10:00Z',
			status: 'FAILED',
			clientMessageId: 'client-photo',
			content: 'обід',
			photo: { status: 'PENDING' },
			photos: [storedPhoto()],
		})
		const feed = buildFeed(params([failed]))

		expect(feed.find((item) => item.kind === 'failure')).toMatchObject({
			error: { messageKey: 'errors.api.AI_UNAVAILABLE', canRetry: true },
			retry: { clientMessageId: 'client-photo', text: 'обід', photoId: FILE_ID },
			dismiss: null,
		})
	})

	it('keeps «фото не надіслано» without a retry for a FAILED photo whose file is null', () => {
		const failed = message({
			createdAt: '2026-10-07T16:10:00Z',
			status: 'FAILED',
			photo: { status: 'PENDING' },
			photos: [storedPhoto({ fileId: null })],
		})
		const feed = buildFeed(params([failed]))

		expect(feed.find((item) => item.kind === 'failure')).toMatchObject({
			error: { messageKey: 'chat.photoLost' },
			retry: null,
			dismiss: { target: 'server', id: failed.id },
		})
	})

	it('draws a placeholder for the photo of a server message and passes its status to the reply', () => {
		const asked = message({
			createdAt: '2026-10-07T06:40:00Z',
			content: null,
			photo: { status: 'FAILED' },
		})
		const answer = {
			...reply('2026-10-07T06:40:06Z'),
			replyToId: asked.id,
		}
		const feed = buildFeed(params([asked, answer]))

		expect(userItem(feed)).toMatchObject({ photo: { kind: 'placeholder' } })
		expect(feed.find((item) => item.kind === 'kusik')).toMatchObject({ photoStatus: 'FAILED' })
	})

	it('lets a photo message that failed on the server be hidden, and hides it', () => {
		const failed = message({
			createdAt: '2026-10-07T06:40:00Z',
			content: null,
			status: 'FAILED',
			photo: { status: 'PENDING' },
		})
		const feed = buildFeed(params([failed]))

		expect(feed.find((item) => item.kind === 'failure')).toMatchObject({
			error: { messageKey: 'chat.photoLost', canRetry: false },
			retry: null,
			dismiss: { target: 'server', id: failed.id },
		})

		const hidden = buildFeed({ ...params([failed]), hiddenIds: new Set([failed.id]) })
		expect(hidden.some((item) => item.kind === 'user' || item.kind === 'failure')).toBe(false)
	})
})
