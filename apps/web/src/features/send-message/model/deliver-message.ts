import type { SendMessageResponse } from '@kus/shared'
import type { QueryClient } from '@tanstack/react-query'

import { DAY_QUERY_KEY } from '@/entities/day'
import {
	addTurnToFeed,
	MESSAGES_QUERY_KEY,
	replaceFeedMessage,
	useFreshReplyStore,
} from '@/entities/message'
import { useGoalCelebrationStore } from '@/entities/stats'
import { WORKOUTS_QUERY_KEY } from '@/entities/workout'
import { type ApiError, getApiError, HTTP_STATUS } from '@/shared/api'
import { playSound } from '@/shared/lib'

import { postMessage } from '../api/send-message'
import { getReplySound } from '../lib/get-reply-sound'
import { getSendError, PHOTO_NEEDS_NETWORK_FAILURE } from '../lib/get-send-error'
import { type OutboxPhoto, useOutboxStore } from './outbox-store'
import { usePhotoLimitStore } from './photo-limit-store'
import { usePhotoSessionStore } from './photo-session-store'
import { uploadOutboxPhoto } from './upload-outbox-photo'

const DAILY_PHOTO_LIMIT_CODE = 'DAILY_PHOTO_LIMIT_REACHED'
const PHOTO_NOT_FOUND_CODE = 'PHOTO_NOT_FOUND'

interface DeliverParams {
	clientMessageId: string
	/** Empty for a photo without words. */
	text: string
	photo?: OutboxPhoto
	/** The photo is already on the server (step 1 done on an earlier try): only the message is sent. */
	photoId?: string
	/**
	 * «Спробувати ще»: the server may replay a finished turn, without the cards it changed. The
	 * request is always made, whatever navigator.onLine says.
	 */
	isRetry?: boolean
}

/** The server has the message: the draft leaves, its picture stays for the bubble of the copy. */
const handOver = (clientMessageId: string): void => {
	const previewUrl = useOutboxStore.getState().complete(clientMessageId)
	if (previewUrl) usePhotoSessionStore.getState().keepPreview(clientMessageId, previewUrl)
}

const isApiErrorCode = (error: ApiError, status: number, errorCode: string): boolean =>
	error.kind === 'http' && error.status === status && error.errorCode === errorCode

/**
 * Step 2: the message with the id of the uploaded photo. When the server no longer has the file
 * (the sweep of unsent photos, ~24 h) the picture is uploaded again if this device still has it;
 * otherwise the message ends as «фото не надіслано» and returns null.
 */
const postWithPhoto = async (
	clientMessageId: string,
	text: string,
	photo: OutboxPhoto | undefined,
	photoId: string,
): Promise<SendMessageResponse | null> => {
	const post = (id: string): Promise<SendMessageResponse> =>
		postMessage({ clientMessageId, text: text || undefined, photoIds: [id] })
	try {
		return await post(photoId)
	} catch (error) {
		if (!isApiErrorCode(getApiError(error), HTTP_STATUS.notFound, PHOTO_NOT_FOUND_CODE)) throw error
		if (!photo) {
			useOutboxStore.getState().markPhotoLost(clientMessageId)
			return null
		}
		return post(await uploadOutboxPhoto(clientMessageId, photo))
	}
}

/**
 * Sends one message, first try or «Спробувати ще» — always with the same clientMessageId, so the
 * API replays or resumes the turn instead of logging the food twice. A photo goes in two steps:
 * POST /photos (its id is kept in the outbox), then POST /messages with that id. A message without
 * a photo never touches /photos.
 */
export const deliverMessage = async (
	queryClient: QueryClient,
	{ clientMessageId, text, photo, photoId: knownPhotoId, isRetry = false }: DeliverParams,
): Promise<void> => {
	const outbox = useOutboxStore.getState()
	const session = usePhotoSessionStore.getState()
	const photoId = knownPhotoId ?? outbox.items[clientMessageId]?.photoId
	outbox.markSending({
		clientMessageId,
		text,
		photo,
		photoId,
		createdAt: new Date().toISOString(),
	})
	// a photo is too heavy to wait in a queue: say so at once instead of a spinner that ends in a failure.
	// Only for the first send: after airplane mode iOS keeps onLine false for a few seconds, and the
	// tap on «Спробувати ще» would be swallowed; a resend goes to the network and fails there if it must
	if (photo && !photoId && !isRetry && !navigator.onLine) {
		outbox.markFailed(clientMessageId, PHOTO_NEEDS_NETWORK_FAILURE)
		playSound('oops')
		return
	}
	try {
		const id = photoId ?? (photo ? await uploadOutboxPhoto(clientMessageId, photo) : undefined)
		const turn = id
			? await postWithPhoto(clientMessageId, text, photo, id)
			: await postMessage({ clientMessageId, text: text || undefined })
		if (!turn) {
			playSound('oops')
			return
		}
		// before the feed gets the turn, so the first render of its cards already sees them as fresh
		useFreshReplyStore.getState().markFresh(turn.assistantMessage)
		// before the day refetch, so its result is seen as caused by this message
		// an achievement (level 3) outranks the day goal (level 2): the goal is marked but stays quiet
		useGoalCelebrationStore
			.getState()
			.arm(turn.assistantMessage.id, { isQuiet: turn.assistantMessage.achievements.length > 0 })
		addTurnToFeed(queryClient, turn)
		// earlier cards this turn corrected, deleted from or answered in words
		for (const updated of turn.updatedMessages) replaceFeedMessage(queryClient, updated)
		handOver(clientMessageId)
		const sound = getReplySound(turn)
		if (sound) playSound(sound)
		void queryClient.invalidateQueries({ queryKey: DAY_QUERY_KEY })
		void queryClient.invalidateQueries({ queryKey: WORKOUTS_QUERY_KEY })
		// a replayed turn returns no updatedMessages: reload the feed so edited cards are current
		if (isRetry) void queryClient.invalidateQueries({ queryKey: MESSAGES_QUERY_KEY })
	} catch (error) {
		const apiError = getApiError(error)
		// the camera stays off until the limit resets; without `resetsAt` this one try is all it costs
		if (apiError.kind === 'http' && apiError.errorCode === DAILY_PHOTO_LIMIT_CODE) {
			usePhotoLimitStore.getState().block(apiError.details.resetsAt)
		}
		const sendError = getSendError(apiError)
		outbox.markFailed(clientMessageId, sendError)
		if (sendError.messageKey !== 'errors.api.MESSAGE_IN_PROGRESS') playSound('oops')
		// the first request is still running on the server: the feed polls its PENDING turn
		if (sendError.messageKey === 'errors.api.MESSAGE_IN_PROGRESS') {
			handOver(clientMessageId)
			void queryClient.invalidateQueries({ queryKey: MESSAGES_QUERY_KEY })
		}
	} finally {
		session.clearUploadProgress(clientMessageId)
	}
}
