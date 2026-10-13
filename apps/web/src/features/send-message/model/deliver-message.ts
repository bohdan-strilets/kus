import type { QueryClient } from '@tanstack/react-query'

import { DAY_QUERY_KEY } from '@/entities/day'
import {
	addTurnToFeed,
	MESSAGES_QUERY_KEY,
	replaceFeedMessage,
	useFreshReplyStore,
} from '@/entities/message'
import { useGoalCelebrationStore } from '@/entities/stats'
import { getApiError } from '@/shared/api'
import { playSound } from '@/shared/lib'

import { postMessage } from '../api/send-message'
import { getReplySound } from '../lib/get-reply-sound'
import { getSendError, PHOTO_NEEDS_NETWORK_FAILURE } from '../lib/get-send-error'
import { type OutboxPhoto, useOutboxStore } from './outbox-store'
import { usePhotoSessionStore } from './photo-session-store'

interface DeliverParams {
	clientMessageId: string
	/** Empty for a photo without words. */
	text: string
	photo?: OutboxPhoto
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

/**
 * Sends one message, first try or «Спробувати ще» — always with the same clientMessageId, so the
 * API replays or resumes the turn instead of logging the food twice.
 */
export const deliverMessage = async (
	queryClient: QueryClient,
	{ clientMessageId, text, photo, isRetry = false }: DeliverParams,
): Promise<void> => {
	const outbox = useOutboxStore.getState()
	const session = usePhotoSessionStore.getState()
	outbox.markSending({ clientMessageId, text, photo, createdAt: new Date().toISOString() })
	// a photo is too heavy to wait in a queue: say so at once instead of a spinner that ends in a failure.
	// Only for the first send: after airplane mode iOS keeps onLine false for a few seconds, and the
	// tap on «Спробувати ще» would be swallowed; a resend goes to the network and fails there if it must
	if (photo && !isRetry && !navigator.onLine) {
		outbox.markFailed(clientMessageId, PHOTO_NEEDS_NETWORK_FAILURE)
		playSound('oops')
		return
	}
	if (photo) session.setUploadProgress(clientMessageId, 0)
	try {
		const turn = await postMessage(
			{
				clientMessageId,
				text: text || undefined,
				...(photo ? { photo: { mimeType: photo.mimeType, data: photo.base64 } } : {}),
			},
			{
				onUploadProgress: (ratio) => {
					session.setUploadProgress(clientMessageId, ratio)
				},
			},
		)
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
		// a replayed turn returns no updatedMessages: reload the feed so edited cards are current
		if (isRetry) void queryClient.invalidateQueries({ queryKey: MESSAGES_QUERY_KEY })
	} catch (error) {
		const sendError = getSendError(getApiError(error))
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
