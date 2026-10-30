import type { ChatMessage, SendMessageResponse } from '@kus/shared'
import { QueryClient } from '@tanstack/react-query'
import { AxiosError, AxiosHeaders } from 'axios'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { playSound } from '@/shared/lib'
import { DAY_QUERY_KEY } from '@/entities/day'
import { WORKOUTS_QUERY_KEY } from '@/entities/workout'
import { MESSAGES_QUERY_KEY, type MessagesPage, useFreshReplyStore } from '@/entities/message'
import { useGoalCelebrationStore } from '@/entities/stats'

import { postMessage } from '../api/send-message'
import { uploadPhoto } from '../api/upload-photo'
import { deliverMessage } from './deliver-message'
import { useOutboxStore } from './outbox-store'
import { usePhotoLimitStore } from './photo-limit-store'
import { usePhotoSessionStore } from './photo-session-store'

vi.mock('../api/send-message', () => ({ postMessage: vi.fn() }))
vi.mock('../api/upload-photo', () => ({ uploadPhoto: vi.fn() }))
const photo = {
	previewUrl: 'blob:http://localhost/preview',
	base64: 'AAAA',
	thumbBase64: 'TTTT',
	mimeType: 'image/jpeg',
	width: 800,
	height: 600,
} as const

vi.mock('@/shared/lib', async (importOriginal) => ({
	...(await importOriginal<object>()),
	playSound: vi.fn(),
}))

const CLIENT_ID = '0199b3a4-0000-7000-8000-0000000000aa'

const message = (overrides: Partial<ChatMessage>): ChatMessage => ({
	id: '0199b3a4-0000-7000-8000-000000000010',
	role: 'USER',
	content: 'тарілка супу',
	status: 'COMPLETED',
	clientMessageId: CLIENT_ID,
	replyToId: null,
	createdAt: '2026-10-07T12:00:00.000Z',
	meals: [],
	clarifications: [],
	measurements: [],
	workouts: [],
	achievements: [],
	dayCard: null,
	statsCard: null,
	savedFoods: [],
	factProposal: null,
	photo: null,
	...overrides,
})

const turn: SendMessageResponse = {
	userMessage: message({}),
	assistantMessage: message({
		id: '0199b3a4-0000-7000-8000-000000000011',
		role: 'ASSISTANT',
		content: 'Записав!',
		clientMessageId: null,
		replyToId: '0199b3a4-0000-7000-8000-000000000010',
	}),
	dayTotals: {
		localDate: '2026-10-07',
		totals: { kcal: 150, protein: 6, fat: 6, carbs: 18, fiber: 0 },
		goalKcal: null,
		remainingKcal: null,
	},
	updatedMessages: [],
}

const networkError = new AxiosError('Network Error')

const apiFailure = (
	status: number,
	errorCode: string,
	details: Record<string, unknown> = {},
): AxiosError =>
	new AxiosError('failed', AxiosError.ERR_BAD_REQUEST, undefined, undefined, {
		status,
		statusText: '',
		data: { statusCode: status, errorCode, details },
		headers: {},
		config: { headers: new AxiosHeaders() },
	})

const createClient = (): QueryClient => {
	const client = new QueryClient()
	const feed: MessagesPage = { messages: [], nextCursor: null }
	client.setQueryData(MESSAGES_QUERY_KEY, { pages: [feed], pageParams: [null] })
	return client
}

describe('deliverMessage', () => {
	beforeEach(() => {
		useOutboxStore.setState({ items: {} })
		vi.mocked(postMessage).mockReset()
	})

	it('keeps a failed message with its error, then resends it under the same clientMessageId', async () => {
		const client = createClient()
		const invalidate = vi.spyOn(client, 'invalidateQueries')
		vi.mocked(postMessage).mockRejectedValueOnce(networkError).mockResolvedValueOnce(turn)

		await deliverMessage(client, { clientMessageId: CLIENT_ID, text: 'тарілка супу' })

		expect(useOutboxStore.getState().items[CLIENT_ID]).toMatchObject({
			status: 'failed',
			error: { messageKey: 'chat.networkError', canRetry: true },
		})

		await deliverMessage(client, { clientMessageId: CLIENT_ID, text: 'тарілка супу' })

		expect(vi.mocked(postMessage).mock.calls.map(([body]) => body)).toEqual([
			{ clientMessageId: CLIENT_ID, text: 'тарілка супу' },
			{ clientMessageId: CLIENT_ID, text: 'тарілка супу' },
		])
		expect(useOutboxStore.getState().items).toEqual({})
		const feed = client.getQueryData<{ pages: MessagesPage[] }>(MESSAGES_QUERY_KEY)
		expect(feed?.pages[0]?.messages.map((item) => item.role)).toEqual(['ASSISTANT', 'USER'])
		expect(invalidate).toHaveBeenCalledWith({ queryKey: DAY_QUERY_KEY })
		expect(invalidate).toHaveBeenCalledWith({ queryKey: WORKOUTS_QUERY_KEY })
	})

	it('replaces the FAILED server copy of a resent message instead of showing it twice', async () => {
		const client = createClient()
		const failedCopy = message({ status: 'FAILED' })
		client.setQueryData(MESSAGES_QUERY_KEY, {
			pages: [{ messages: [failedCopy], nextCursor: null }],
			pageParams: [null],
		})
		vi.mocked(postMessage).mockResolvedValueOnce(turn)

		await deliverMessage(client, { clientMessageId: CLIENT_ID, text: 'тарілка супу' })

		const feed = client.getQueryData<{ pages: MessagesPage[] }>(MESSAGES_QUERY_KEY)
		expect(feed?.pages[0]?.messages.map((item) => item.status)).toEqual(['COMPLETED', 'COMPLETED'])
	})

	it('reloads the feed after a resend: a replayed turn carries no changed cards', async () => {
		const client = createClient()
		const invalidate = vi.spyOn(client, 'invalidateQueries')
		vi.mocked(postMessage).mockResolvedValueOnce(turn)

		await deliverMessage(client, {
			clientMessageId: CLIENT_ID,
			text: 'тарілка супу',
			isRetry: true,
		})

		expect(invalidate).toHaveBeenCalledWith({ queryKey: MESSAGES_QUERY_KEY })
	})

	it('refreshes an earlier card the turn changed in place', async () => {
		const client = createClient()
		const earlier = message({
			id: '0199b3a4-0000-7000-8000-000000000001',
			role: 'ASSISTANT',
			content: 'Записав борщ',
			clientMessageId: null,
		})
		client.setQueryData(MESSAGES_QUERY_KEY, {
			pages: [{ messages: [earlier], nextCursor: null }],
			pageParams: [null],
		})
		const corrected = { ...earlier, content: 'Записав борщ (змінено)' }
		vi.mocked(postMessage).mockResolvedValueOnce({ ...turn, updatedMessages: [corrected] })

		await deliverMessage(client, { clientMessageId: CLIENT_ID, text: 'зміни на 600 г' })

		const feed = client.getQueryData<{ pages: MessagesPage[] }>(MESSAGES_QUERY_KEY)
		const messages = feed?.pages[0]?.messages ?? []
		expect(messages).toHaveLength(3)
		expect(messages.find((item) => item.id === earlier.id)).toEqual(corrected)
	})

	it('shows the item as sending while the request runs', async () => {
		const client = createClient()
		let finish: (value: SendMessageResponse) => void = () => undefined
		vi.mocked(postMessage).mockReturnValueOnce(
			new Promise((resolve) => {
				finish = resolve
			}),
		)

		const pending = deliverMessage(client, { clientMessageId: CLIENT_ID, text: 'тарілка супу' })

		expect(useOutboxStore.getState().items[CLIENT_ID]?.status).toBe('sending')
		finish(turn)
		await pending
		expect(useOutboxStore.getState().items[CLIENT_ID]).toBeUndefined()
	})
})

describe('deliverMessage with a photo', () => {
	const PHOTO_ID = '0199b3a4-0000-7000-8000-0000000000c1'
	const NEW_PHOTO_ID = '0199b3a4-0000-7000-8000-0000000000c2'
	const uploaded = (id: string) => ({ id, width: 800, height: 600 })

	beforeEach(() => {
		useOutboxStore.setState({ items: {} })
		usePhotoSessionStore.setState({ uploadProgress: {}, previews: {} })
		usePhotoLimitStore.setState({ ownerId: null, blockedUntil: null })
		useFreshReplyStore.setState({ ownerId: null, freshAt: {} })
		useGoalCelebrationStore.setState({
			ownerId: null,
			armed: null,
			pending: null,
			celebratedReplyId: null,
		})
		vi.mocked(postMessage).mockReset()
		vi.mocked(uploadPhoto).mockReset()
		vi.mocked(playSound).mockClear()
		vi.stubGlobal('navigator', { onLine: true })
	})

	afterEach(() => {
		vi.unstubAllGlobals()
		vi.useRealTimers()
	})

	const bodyOfCall = (index: number) => vi.mocked(postMessage).mock.calls[index]?.[0]

	describe('the two steps', () => {
		it('uploads first, then posts the message with the photo id and without the photo itself', async () => {
			vi.mocked(uploadPhoto).mockResolvedValueOnce(uploaded(PHOTO_ID))
			vi.mocked(postMessage).mockResolvedValueOnce(turn)

			await deliverMessage(createClient(), { clientMessageId: CLIENT_ID, text: '', photo })

			expect(uploadPhoto).toHaveBeenCalledTimes(1)
			expect(vi.mocked(uploadPhoto).mock.calls[0]?.[0]).toEqual({
				base64: 'AAAA',
				thumbBase64: 'TTTT',
				width: 800,
				height: 600,
			})
			expect(postMessage).toHaveBeenCalledTimes(1)
			expect(bodyOfCall(0)).toEqual({ clientMessageId: CLIENT_ID, photoIds: [PHOTO_ID] })
			expect(bodyOfCall(0)).not.toHaveProperty('photo')
			expect(vi.mocked(uploadPhoto).mock.invocationCallOrder[0]).toBeLessThan(
				vi.mocked(postMessage).mock.invocationCallOrder[0] ?? Number.NEGATIVE_INFINITY,
			)
			expect(useOutboxStore.getState().items).toEqual({})
		})

		it('sends the caption together with the photo id', async () => {
			vi.mocked(uploadPhoto).mockResolvedValueOnce(uploaded(PHOTO_ID))
			vi.mocked(postMessage).mockResolvedValueOnce(turn)

			await deliverMessage(createClient(), { clientMessageId: CLIENT_ID, text: 'без олії', photo })

			expect(bodyOfCall(0)).toEqual({
				clientMessageId: CLIENT_ID,
				text: 'без олії',
				photoIds: [PHOTO_ID],
			})
		})

		it('tracks the upload of step 1, drops the progress before step 2 and keeps the picture', async () => {
			vi.mocked(uploadPhoto).mockImplementationOnce((_params, options) => {
				options?.onUploadProgress?.(0.5)
				expect(usePhotoSessionStore.getState().uploadProgress[CLIENT_ID]).toBe(0.5)
				return Promise.resolve(uploaded(PHOTO_ID))
			})
			vi.mocked(postMessage).mockImplementationOnce(() => {
				// the message has no heavy body: the feed shows «думає», not «надсилаю»
				expect(usePhotoSessionStore.getState().uploadProgress[CLIENT_ID]).toBeUndefined()
				expect(useOutboxStore.getState().items[CLIENT_ID]).toMatchObject({
					status: 'sending',
					photoId: PHOTO_ID,
				})
				return Promise.resolve(turn)
			})

			await deliverMessage(createClient(), { clientMessageId: CLIENT_ID, text: '', photo })

			expect(usePhotoSessionStore.getState()).toMatchObject({
				uploadProgress: {},
				previews: { [CLIENT_ID]: photo.previewUrl },
			})
			expect(postMessage).toHaveBeenCalledTimes(1)
		})

		it('starts the progress of a photo at 0 the moment the upload begins', async () => {
			let progressAtStart: number | undefined
			vi.mocked(uploadPhoto).mockImplementationOnce(() => {
				progressAtStart = usePhotoSessionStore.getState().uploadProgress[CLIENT_ID]
				return Promise.resolve(uploaded(PHOTO_ID))
			})
			vi.mocked(postMessage).mockResolvedValueOnce(turn)

			await deliverMessage(createClient(), { clientMessageId: CLIENT_ID, text: '', photo })

			expect(progressAtStart).toBe(0)
		})

		it('plays the photo-fail sound, not the «кусь», when the photo was not food', async () => {
			vi.mocked(uploadPhoto).mockResolvedValueOnce(uploaded(PHOTO_ID))
			const meal = { id: 'meal' } as ChatMessage['meals'][number]
			vi.mocked(postMessage).mockResolvedValueOnce({
				...turn,
				userMessage: message({ photo: { status: 'FAILED' } }),
				assistantMessage: { ...turn.assistantMessage, meals: [meal] },
			})

			await deliverMessage(createClient(), { clientMessageId: CLIENT_ID, text: '', photo })

			expect(playSound).toHaveBeenCalledWith('photoFail')
			expect(playSound).not.toHaveBeenCalledWith('kusik')
		})
	})

	describe('step 1 fails', () => {
		it.each([
			['the network', networkError, 'chat.networkError', true],
			['a 5xx', apiFailure(500, 'INTERNAL_ERROR'), 'errors.api.SERVER', true],
			[
				'the storage being down',
				apiFailure(503, 'STORAGE_UNAVAILABLE'),
				'errors.api.STORAGE_UNAVAILABLE',
				true,
			],
			[
				'a refused thumbnail',
				apiFailure(422, 'VALIDATION_ERROR', { fields: { thumb: 'PHOTO_TOO_LARGE' } }),
				'chat.photoTooLarge',
				false,
			],
			[
				'a refused photo',
				apiFailure(422, 'VALIDATION_ERROR', { fields: { photo: 'UNSUPPORTED_IMAGE' } }),
				'chat.photoUnsupported',
				false,
			],
			[
				'the per-minute limit',
				apiFailure(429, 'TOO_MANY_REQUESTS'),
				'errors.api.TOO_MANY_REQUESTS',
				true,
			],
		])(
			'keeps the message as failed, with no photo id and no message request, on %s',
			async (_name, error, messageKey, canRetry) => {
				vi.mocked(uploadPhoto).mockRejectedValueOnce(error)

				await deliverMessage(createClient(), { clientMessageId: CLIENT_ID, text: 'обід', photo })

				expect(postMessage).not.toHaveBeenCalled()
				const item = useOutboxStore.getState().items[CLIENT_ID]
				expect(item).toMatchObject({
					status: 'failed',
					error: { messageKey, canRetry },
					text: 'обід',
				})
				expect(item?.photoId).toBeUndefined()
				expect(item?.photo).toBe(photo)
				expect(usePhotoSessionStore.getState().uploadProgress).toEqual({})
				expect(playSound).toHaveBeenCalledWith('oops')
			},
		)

		it('uploads again on «Спробувати ще», since nothing was stored the first time', async () => {
			vi.mocked(uploadPhoto)
				.mockRejectedValueOnce(networkError)
				.mockResolvedValueOnce(uploaded(PHOTO_ID))
			vi.mocked(postMessage).mockResolvedValueOnce(turn)
			const client = createClient()

			await deliverMessage(client, { clientMessageId: CLIENT_ID, text: '', photo })
			await deliverMessage(client, { clientMessageId: CLIENT_ID, text: '', photo, isRetry: true })

			expect(uploadPhoto).toHaveBeenCalledTimes(2)
			expect(bodyOfCall(0)).toEqual({ clientMessageId: CLIENT_ID, photoIds: [PHOTO_ID] })
			expect(useOutboxStore.getState().items).toEqual({})
		})
	})

	describe('step 2 fails', () => {
		it('keeps the photo id, and the resend uploads nothing: one upload, the same id twice', async () => {
			vi.mocked(uploadPhoto).mockResolvedValueOnce(uploaded(PHOTO_ID))
			vi.mocked(postMessage).mockRejectedValueOnce(networkError).mockResolvedValueOnce(turn)
			const client = createClient()

			await deliverMessage(client, { clientMessageId: CLIENT_ID, text: 'обід', photo })

			expect(useOutboxStore.getState().items[CLIENT_ID]).toMatchObject({
				status: 'failed',
				photoId: PHOTO_ID,
				error: { messageKey: 'chat.networkError', canRetry: true },
			})
			expect(usePhotoSessionStore.getState().uploadProgress).toEqual({})

			// exactly what the feed hands to the retry button
			await deliverMessage(client, {
				clientMessageId: CLIENT_ID,
				text: 'обід',
				photo,
				photoId: PHOTO_ID,
				isRetry: true,
			})

			expect(uploadPhoto).toHaveBeenCalledTimes(1)
			expect(vi.mocked(postMessage).mock.calls.map(([body]) => body)).toEqual([
				{ clientMessageId: CLIENT_ID, text: 'обід', photoIds: [PHOTO_ID] },
				{ clientMessageId: CLIENT_ID, text: 'обід', photoIds: [PHOTO_ID] },
			])
			expect(useOutboxStore.getState().items).toEqual({})
			expect(usePhotoSessionStore.getState().previews[CLIENT_ID]).toBe(photo.previewUrl)
		})

		it('takes the photo id from the outbox when the resend does not pass it', async () => {
			vi.mocked(uploadPhoto).mockResolvedValueOnce(uploaded(PHOTO_ID))
			vi.mocked(postMessage).mockRejectedValueOnce(networkError).mockResolvedValueOnce(turn)
			const client = createClient()

			await deliverMessage(client, { clientMessageId: CLIENT_ID, text: '', photo })
			await deliverMessage(client, { clientMessageId: CLIENT_ID, text: '', photo, isRetry: true })

			expect(uploadPhoto).toHaveBeenCalledTimes(1)
			expect(bodyOfCall(1)).toEqual({ clientMessageId: CLIENT_ID, photoIds: [PHOTO_ID] })
		})

		it('resends after a reload with the id alone: only the message goes out', async () => {
			vi.mocked(postMessage).mockResolvedValueOnce(turn)

			await deliverMessage(createClient(), {
				clientMessageId: CLIENT_ID,
				text: '',
				photoId: PHOTO_ID,
				isRetry: true,
			})

			expect(uploadPhoto).not.toHaveBeenCalled()
			expect(bodyOfCall(0)).toEqual({ clientMessageId: CLIENT_ID, photoIds: [PHOTO_ID] })
			expect(bodyOfCall(0)).not.toHaveProperty('photo')
			expect(useOutboxStore.getState().items).toEqual({})
		})

		it('needs no connection check for a photo that is already on the server', async () => {
			vi.stubGlobal('navigator', { onLine: false })
			vi.mocked(postMessage).mockResolvedValueOnce(turn)

			await deliverMessage(createClient(), {
				clientMessageId: CLIENT_ID,
				text: '',
				photo,
				photoId: PHOTO_ID,
			})

			expect(postMessage).toHaveBeenCalledTimes(1)
		})

		it('shows the network failure when the resend really has no connection', async () => {
			vi.stubGlobal('navigator', { onLine: false })
			vi.mocked(postMessage).mockRejectedValueOnce(networkError)

			await deliverMessage(createClient(), {
				clientMessageId: CLIENT_ID,
				text: 'обід',
				photo,
				photoId: PHOTO_ID,
				isRetry: true,
			})

			expect(postMessage).toHaveBeenCalledTimes(1)
			expect(useOutboxStore.getState().items[CLIENT_ID]).toMatchObject({
				status: 'failed',
				photoId: PHOTO_ID,
				error: { messageKey: 'chat.networkError', canRetry: true },
			})
			expect(usePhotoSessionStore.getState().uploadProgress).toEqual({})
		})

		it('keeps the AI failure retriable with the same photo id', async () => {
			vi.mocked(uploadPhoto).mockResolvedValueOnce(uploaded(PHOTO_ID))
			vi.mocked(postMessage).mockRejectedValueOnce(apiFailure(503, 'AI_UNAVAILABLE'))

			await deliverMessage(createClient(), { clientMessageId: CLIENT_ID, text: '', photo })

			expect(useOutboxStore.getState().items[CLIENT_ID]).toMatchObject({
				photoId: PHOTO_ID,
				error: { messageKey: 'errors.api.AI_UNAVAILABLE', canRetry: true },
			})
		})

		it('hands the item over while the first request is still running on the server', async () => {
			vi.mocked(uploadPhoto).mockResolvedValueOnce(uploaded(PHOTO_ID))
			vi.mocked(postMessage).mockRejectedValueOnce(apiFailure(409, 'MESSAGE_IN_PROGRESS'))

			await deliverMessage(createClient(), { clientMessageId: CLIENT_ID, text: '', photo })

			expect(playSound).not.toHaveBeenCalledWith('oops')
			expect(usePhotoSessionStore.getState().previews[CLIENT_ID]).toBe(photo.previewUrl)
		})
	})

	describe('the server no longer has the photo (PHOTO_NOT_FOUND)', () => {
		const notFound = () => apiFailure(404, 'PHOTO_NOT_FOUND')

		it('uploads the picture again when this device still has it, and the resend goes through', async () => {
			vi.mocked(uploadPhoto).mockResolvedValueOnce(uploaded(NEW_PHOTO_ID))
			vi.mocked(postMessage).mockRejectedValueOnce(notFound()).mockResolvedValueOnce(turn)

			await deliverMessage(createClient(), {
				clientMessageId: CLIENT_ID,
				text: 'обід',
				photo,
				photoId: PHOTO_ID,
				isRetry: true,
			})

			expect(uploadPhoto).toHaveBeenCalledTimes(1)
			expect(postMessage).toHaveBeenCalledTimes(2)
			expect(bodyOfCall(0)).toEqual({
				clientMessageId: CLIENT_ID,
				text: 'обід',
				photoIds: [PHOTO_ID],
			})
			expect(bodyOfCall(1)).toEqual({
				clientMessageId: CLIENT_ID,
				text: 'обід',
				photoIds: [NEW_PHOTO_ID],
			})
			expect(useOutboxStore.getState().items).toEqual({})
			expect(usePhotoSessionStore.getState().uploadProgress).toEqual({})
			expect(usePhotoSessionStore.getState().previews[CLIENT_ID]).toBe(photo.previewUrl)
		})

		it('writes the new id into the outbox before the second post, so a failure there keeps it', async () => {
			vi.mocked(uploadPhoto).mockResolvedValueOnce(uploaded(NEW_PHOTO_ID))
			vi.mocked(postMessage).mockRejectedValueOnce(notFound()).mockRejectedValueOnce(networkError)

			await deliverMessage(createClient(), {
				clientMessageId: CLIENT_ID,
				text: '',
				photo,
				photoId: PHOTO_ID,
				isRetry: true,
			})

			expect(useOutboxStore.getState().items[CLIENT_ID]).toMatchObject({
				status: 'failed',
				photoId: NEW_PHOTO_ID,
				error: { messageKey: 'chat.networkError', canRetry: true },
			})
		})

		it('marks the photo as lost when the picture is gone from this device too', async () => {
			vi.mocked(postMessage).mockRejectedValueOnce(notFound())

			await deliverMessage(createClient(), {
				clientMessageId: CLIENT_ID,
				text: 'обід',
				photoId: PHOTO_ID,
				isRetry: true,
			})

			expect(uploadPhoto).not.toHaveBeenCalled()
			expect(postMessage).toHaveBeenCalledTimes(1)
			const item = useOutboxStore.getState().items[CLIENT_ID]
			expect(item).toMatchObject({
				text: 'обід',
				status: 'failed',
				photoLost: true,
				error: { messageKey: 'chat.photoLost', canRetry: false },
			})
			expect(item?.photoId).toBeUndefined()
			expect(item?.photo).toBeUndefined()
			expect(playSound).toHaveBeenCalledWith('oops')
			expect(playSound).toHaveBeenCalledTimes(1)
			expect(usePhotoSessionStore.getState().uploadProgress).toEqual({})
		})

		it('does not celebrate or refresh the day for a photo that was lost', async () => {
			const client = createClient()
			const invalidate = vi.spyOn(client, 'invalidateQueries')
			vi.mocked(postMessage).mockRejectedValueOnce(notFound())

			await deliverMessage(client, { clientMessageId: CLIENT_ID, text: '', photoId: PHOTO_ID })

			expect(useGoalCelebrationStore.getState().isArmed()).toBe(false)
			expect(invalidate).not.toHaveBeenCalled()
			expect(useFreshReplyStore.getState().freshAt).toEqual({})
		})

		it('gives up with the not-found text when the reupload is not found either: no endless loop', async () => {
			vi.mocked(uploadPhoto).mockResolvedValueOnce(uploaded(NEW_PHOTO_ID))
			vi.mocked(postMessage).mockRejectedValue(notFound())

			await deliverMessage(createClient(), {
				clientMessageId: CLIENT_ID,
				text: '',
				photo,
				photoId: PHOTO_ID,
				isRetry: true,
			})

			expect(uploadPhoto).toHaveBeenCalledTimes(1)
			expect(postMessage).toHaveBeenCalledTimes(2)
			expect(useOutboxStore.getState().items[CLIENT_ID]).toMatchObject({
				status: 'failed',
				error: { messageKey: 'errors.api.PHOTO_NOT_FOUND', canRetry: false },
			})
			expect(useOutboxStore.getState().items[CLIENT_ID]?.photoLost).toBeUndefined()
		})

		it('treats a 404 with another code as a normal failure, with no reupload', async () => {
			vi.mocked(postMessage).mockRejectedValueOnce(apiFailure(404, 'ENTRY_NOT_FOUND'))

			await deliverMessage(createClient(), {
				clientMessageId: CLIENT_ID,
				text: '',
				photo,
				photoId: PHOTO_ID,
			})

			expect(uploadPhoto).not.toHaveBeenCalled()
			expect(postMessage).toHaveBeenCalledTimes(1)
			expect(useOutboxStore.getState().items[CLIENT_ID]).toMatchObject({
				status: 'failed',
				photoId: PHOTO_ID,
			})
		})

		it('does not treat PHOTO_NOT_FOUND from the upload itself as a lost photo', async () => {
			vi.mocked(uploadPhoto).mockRejectedValueOnce(notFound())

			await deliverMessage(createClient(), { clientMessageId: CLIENT_ID, text: '', photo })

			expect(postMessage).not.toHaveBeenCalled()
			expect(useOutboxStore.getState().items[CLIENT_ID]?.photoLost).toBeUndefined()
		})
	})

	describe('without a connection', () => {
		it('fails at once, with no request at all, when a photo was never uploaded', async () => {
			vi.stubGlobal('navigator', { onLine: false })

			await deliverMessage(createClient(), { clientMessageId: CLIENT_ID, text: 'обід', photo })

			expect(uploadPhoto).not.toHaveBeenCalled()
			expect(postMessage).not.toHaveBeenCalled()
			expect(useOutboxStore.getState().items[CLIENT_ID]).toMatchObject({
				status: 'failed',
				error: { messageKey: 'chat.photoNeedsNetwork', canRetry: true },
			})
			expect(playSound).toHaveBeenCalledWith('oops')
		})

		it('resends on «Спробувати ще» even while navigator.onLine still says offline', async () => {
			// iOS keeps onLine false for a few seconds after airplane mode is switched off
			vi.stubGlobal('navigator', { onLine: false })
			vi.mocked(uploadPhoto).mockResolvedValueOnce(uploaded(PHOTO_ID))
			vi.mocked(postMessage).mockResolvedValueOnce(turn)

			await deliverMessage(createClient(), {
				clientMessageId: CLIENT_ID,
				text: 'обід',
				photo,
				isRetry: true,
			})

			expect(uploadPhoto).toHaveBeenCalledTimes(1)
			expect(bodyOfCall(0)).toEqual({
				clientMessageId: CLIENT_ID,
				text: 'обід',
				photoIds: [PHOTO_ID],
			})
			expect(useOutboxStore.getState().items).toEqual({})
			expect(usePhotoSessionStore.getState().previews[CLIENT_ID]).toBe(photo.previewUrl)
		})

		it('shows the network failure when a resend of the upload really has no connection', async () => {
			vi.stubGlobal('navigator', { onLine: false })
			vi.mocked(uploadPhoto).mockRejectedValueOnce(networkError)

			await deliverMessage(createClient(), {
				clientMessageId: CLIENT_ID,
				text: 'обід',
				photo,
				isRetry: true,
			})

			expect(uploadPhoto).toHaveBeenCalledTimes(1)
			expect(postMessage).not.toHaveBeenCalled()
			expect(useOutboxStore.getState().items[CLIENT_ID]).toMatchObject({
				status: 'failed',
				error: { messageKey: 'chat.networkError', canRetry: true },
			})
			expect(usePhotoSessionStore.getState().uploadProgress).toEqual({})
		})

		it('sends a text without a photo as before, and never touches /photos', async () => {
			vi.stubGlobal('navigator', { onLine: false })
			vi.mocked(postMessage).mockRejectedValueOnce(networkError)

			await deliverMessage(createClient(), { clientMessageId: CLIENT_ID, text: 'банан' })

			expect(postMessage).toHaveBeenCalledTimes(1)
			expect(uploadPhoto).not.toHaveBeenCalled()
			expect(useOutboxStore.getState().items[CLIENT_ID]).toMatchObject({
				error: { messageKey: 'chat.networkError', canRetry: true },
			})
		})
	})

	describe('the photo storage is down', () => {
		it('fails step 1 with a retriable «storage unavailable»', async () => {
			vi.mocked(uploadPhoto).mockRejectedValueOnce(apiFailure(503, 'STORAGE_UNAVAILABLE'))

			await deliverMessage(createClient(), { clientMessageId: CLIENT_ID, text: '', photo })

			expect(useOutboxStore.getState().items[CLIENT_ID]).toMatchObject({
				status: 'failed',
				error: { messageKey: 'errors.api.STORAGE_UNAVAILABLE', canRetry: true },
			})
			expect(postMessage).not.toHaveBeenCalled()
		})

		it('lets a text without a photo through: it never asks the storage', async () => {
			vi.mocked(postMessage).mockResolvedValueOnce(turn)

			await deliverMessage(createClient(), { clientMessageId: CLIENT_ID, text: 'тарілка супу' })

			expect(uploadPhoto).not.toHaveBeenCalled()
			expect(bodyOfCall(0)).toEqual({ clientMessageId: CLIENT_ID, text: 'тарілка супу' })
			expect(bodyOfCall(0)).not.toHaveProperty('photo')
			expect(bodyOfCall(0)).not.toHaveProperty('photoIds')
			expect(useOutboxStore.getState().items).toEqual({})
		})
	})

	describe('the daily photo limit', () => {
		const NOW = new Date('2026-10-16T12:00:00.000Z')
		const RESETS_AT = '2026-10-17T00:00:00.000Z'
		const limitReached = (details: Record<string, unknown>) =>
			apiFailure(429, 'DAILY_PHOTO_LIMIT_REACHED', details)

		beforeEach(() => {
			vi.useFakeTimers({ toFake: ['Date'] })
			vi.setSystemTime(NOW)
		})

		it('blocks the camera until resetsAt when step 1 hits the limit, with no retry', async () => {
			vi.mocked(uploadPhoto).mockRejectedValueOnce(limitReached({ resetsAt: RESETS_AT }))

			await deliverMessage(createClient(), { clientMessageId: CLIENT_ID, text: '', photo })

			expect(usePhotoLimitStore.getState().blockedUntil).toBe(Date.parse(RESETS_AT))
			expect(useOutboxStore.getState().items[CLIENT_ID]).toMatchObject({
				status: 'failed',
				error: { messageKey: 'errors.api.DAILY_PHOTO_LIMIT_REACHED', canRetry: false },
			})
			expect(postMessage).not.toHaveBeenCalled()
		})

		it('blocks the camera when step 2 reports the limit', async () => {
			vi.mocked(uploadPhoto).mockResolvedValueOnce(uploaded(PHOTO_ID))
			vi.mocked(postMessage).mockRejectedValueOnce(limitReached({ resetsAt: RESETS_AT }))

			await deliverMessage(createClient(), { clientMessageId: CLIENT_ID, text: '', photo })

			expect(usePhotoLimitStore.getState().blockedUntil).toBe(Date.parse(RESETS_AT))
			expect(useOutboxStore.getState().items[CLIENT_ID]?.error).toEqual({
				messageKey: 'errors.api.DAILY_PHOTO_LIMIT_REACHED',
				canRetry: false,
			})
		})

		it.each([
			['no resetsAt', {}],
			['a resetsAt in the past', { resetsAt: '2026-10-15T00:00:00.000Z' }],
			['a resetsAt of exactly now', { resetsAt: NOW.toISOString() }],
			['garbage', { resetsAt: 'tomorrow-ish' }],
			['a number', { resetsAt: 1_760_000_000_000 }],
			['null', { resetsAt: null }],
		])('blocks nothing when the answer has %s', async (_name, details) => {
			vi.mocked(uploadPhoto).mockRejectedValueOnce(limitReached(details))

			await deliverMessage(createClient(), { clientMessageId: CLIENT_ID, text: '', photo })

			expect(usePhotoLimitStore.getState().blockedUntil).toBeNull()
			expect(useOutboxStore.getState().items[CLIENT_ID]?.error?.messageKey).toBe(
				'errors.api.DAILY_PHOTO_LIMIT_REACHED',
			)
		})

		it('does not block the camera for the daily message limit', async () => {
			vi.mocked(postMessage).mockRejectedValueOnce(
				apiFailure(429, 'DAILY_LIMIT_REACHED', { resetsAt: RESETS_AT }),
			)

			await deliverMessage(createClient(), { clientMessageId: CLIENT_ID, text: 'суп' })

			expect(usePhotoLimitStore.getState().blockedUntil).toBeNull()
		})

		it('still sends a text message while the camera is blocked', async () => {
			usePhotoLimitStore.setState({ blockedUntil: Date.parse(RESETS_AT) })
			vi.mocked(postMessage).mockResolvedValueOnce(turn)

			await deliverMessage(createClient(), { clientMessageId: CLIENT_ID, text: 'тарілка супу' })

			expect(postMessage).toHaveBeenCalledTimes(1)
			expect(useOutboxStore.getState().items).toEqual({})
		})
	})
})

describe('deliverMessage sounds and fresh cards', () => {
	const MEAL = { id: 'meal-1' } as ChatMessage['meals'][number]
	const OPEN_CLARIFICATION = {
		status: 'OPEN',
	} as ChatMessage['clarifications'][number]

	const turnWith = (reply: Partial<ChatMessage>): SendMessageResponse => ({
		...turn,
		assistantMessage: { ...turn.assistantMessage, ...reply },
	})

	const inProgressError = new AxiosError(
		'conflict',
		AxiosError.ERR_BAD_REQUEST,
		undefined,
		undefined,
		{
			status: 409,
			statusText: '',
			data: { statusCode: 409, errorCode: 'MESSAGE_IN_PROGRESS', details: {} },
			headers: {},
			config: { headers: new AxiosHeaders() },
		},
	)

	beforeEach(() => {
		useOutboxStore.setState({ items: {} })
		usePhotoSessionStore.setState({ uploadProgress: {}, previews: {} })
		useFreshReplyStore.setState({ ownerId: null, freshAt: {} })
		useGoalCelebrationStore.setState({
			ownerId: null,
			armed: null,
			pending: null,
			celebratedReplyId: null,
		})
		vi.mocked(postMessage).mockReset()
		vi.mocked(playSound).mockClear()
		vi.stubGlobal('navigator', { onLine: true })
	})

	afterEach(() => {
		vi.unstubAllGlobals()
	})

	it('marks the meals fresh before the feed gets the turn, and plays «kusik»', async () => {
		const client = createClient()
		const freshWhenFeedChanged: boolean[] = []
		client.getQueryCache().subscribe((event) => {
			if (event.type === 'updated' && event.action.type === 'success') {
				freshWhenFeedChanged.push(
					useFreshReplyStore.getState().freshAt[`meal:${MEAL.id}`] !== undefined,
				)
			}
		})
		vi.mocked(postMessage).mockResolvedValueOnce(turnWith({ meals: [MEAL] }))

		await deliverMessage(client, { clientMessageId: CLIENT_ID, text: 'тарілка супу' })

		expect(Object.keys(useFreshReplyStore.getState().freshAt)).toEqual([`meal:${MEAL.id}`])
		expect(playSound).toHaveBeenCalledWith('kusik')
		expect(freshWhenFeedChanged.length).toBeGreaterThan(0)
		expect(freshWhenFeedChanged).not.toContain(false)
	})

	it('plays «clarify», not «kusik», when the reply has an open question and meals', async () => {
		vi.mocked(postMessage).mockResolvedValueOnce(
			turnWith({ meals: [MEAL], clarifications: [OPEN_CLARIFICATION] }),
		)

		await deliverMessage(createClient(), { clientMessageId: CLIENT_ID, text: 'тарілка супу' })

		expect(playSound).toHaveBeenCalledWith('clarify')
		expect(playSound).not.toHaveBeenCalledWith('kusik')
	})

	it('arms the goal celebration with the reply id before the day refetch', async () => {
		const client = createClient()
		const armedWhenDayInvalidated: boolean[] = []
		vi.spyOn(client, 'invalidateQueries').mockImplementation((filters) => {
			if (filters?.queryKey === DAY_QUERY_KEY) {
				armedWhenDayInvalidated.push(useGoalCelebrationStore.getState().isArmed())
			}
			return Promise.resolve()
		})
		vi.mocked(postMessage).mockResolvedValueOnce(turnWith({ meals: [MEAL] }))

		await deliverMessage(client, { clientMessageId: CLIENT_ID, text: 'тарілка супу' })

		expect(useGoalCelebrationStore.getState().isArmed()).toBe(true)
		expect(useGoalCelebrationStore.getState().armed?.messageId).toBe(turn.assistantMessage.id)
		expect(armedWhenDayInvalidated).toEqual([true])
	})

	it('arms the goal celebration normally when the reply has no achievement', async () => {
		vi.mocked(postMessage).mockResolvedValueOnce(turnWith({ meals: [MEAL] }))

		await deliverMessage(createClient(), { clientMessageId: CLIENT_ID, text: 'тарілка супу' })

		expect(useGoalCelebrationStore.getState().armed?.isQuiet).toBe(false)
	})

	it('arms it quietly and plays only «achieve» when the reply has an achievement', async () => {
		const achievement = {
			id: 'a1',
			type: 'FOOD_STREAK',
			value: 7,
		} as ChatMessage['achievements'][number]
		vi.mocked(postMessage).mockResolvedValueOnce(
			turnWith({ meals: [MEAL], achievements: [achievement] }),
		)

		await deliverMessage(createClient(), { clientMessageId: CLIENT_ID, text: 'тарілка супу' })

		expect(useGoalCelebrationStore.getState().armed?.isQuiet).toBe(true)
		expect(useFreshReplyStore.getState().freshAt['achievement:a1']).toBeDefined()
		expect(playSound).toHaveBeenCalledTimes(1)
		expect(playSound).toHaveBeenCalledWith('achieve')
	})

	it('does not arm the goal celebration when the request fails', async () => {
		vi.mocked(postMessage).mockRejectedValueOnce(networkError)

		await deliverMessage(createClient(), { clientMessageId: CLIENT_ID, text: 'тарілка супу' })

		expect(useGoalCelebrationStore.getState().isArmed()).toBe(false)
	})

	it('does not arm the goal celebration for a photo without a connection', async () => {
		vi.stubGlobal('navigator', { onLine: false })

		await deliverMessage(createClient(), { clientMessageId: CLIENT_ID, text: '', photo })

		expect(useGoalCelebrationStore.getState().isArmed()).toBe(false)
	})

	it('plays «oops» when the request fails on the network', async () => {
		vi.mocked(postMessage).mockRejectedValueOnce(networkError)

		await deliverMessage(createClient(), { clientMessageId: CLIENT_ID, text: 'тарілка супу' })

		expect(playSound).toHaveBeenCalledWith('oops')
		expect(useFreshReplyStore.getState().freshAt).toEqual({})
	})

	it('plays «oops» for a photo without a connection, with no request', async () => {
		vi.stubGlobal('navigator', { onLine: false })

		await deliverMessage(createClient(), { clientMessageId: CLIENT_ID, text: '', photo })

		expect(postMessage).not.toHaveBeenCalled()
		expect(playSound).toHaveBeenCalledWith('oops')
	})

	it('stays quiet while the first request is still running on the server', async () => {
		vi.mocked(postMessage).mockRejectedValueOnce(inProgressError)

		await deliverMessage(createClient(), { clientMessageId: CLIENT_ID, text: 'тарілка супу' })

		expect(playSound).not.toHaveBeenCalledWith('oops')
		expect(playSound).not.toHaveBeenCalled()
	})

	it('is silent for a reply without meals and questions', async () => {
		vi.mocked(postMessage).mockResolvedValueOnce(turn)

		await deliverMessage(createClient(), { clientMessageId: CLIENT_ID, text: 'привіт' })

		expect(playSound).not.toHaveBeenCalled()
		expect(useFreshReplyStore.getState().freshAt).toEqual({})
	})
})
