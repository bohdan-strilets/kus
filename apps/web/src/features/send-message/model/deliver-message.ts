import type { QueryClient } from '@tanstack/react-query'

import { DAY_QUERY_KEY } from '@/entities/day'
import { addTurnToFeed, MESSAGES_QUERY_KEY, replaceFeedMessage } from '@/entities/message'
import { getApiError } from '@/shared/api'
import { playSound } from '@/shared/lib'

import { postMessage } from '../api/send-message'
import { getSendError, PHOTO_NEEDS_NETWORK_FAILURE } from '../lib/get-send-error'
import { type OutboxPhoto, useOutboxStore } from './outbox-store'

interface DeliverParams {
	clientMessageId: string
	/** Empty for a photo without words. */
	text: string
	photo?: OutboxPhoto
	/** «Спробувати ще»: the server may replay a finished turn, without the cards it changed. */
	isRetry?: boolean
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
	outbox.markSending({ clientMessageId, text, photo, createdAt: new Date().toISOString() })
	// a photo is too heavy to wait in a queue: say so at once instead of a spinner that ends in a failure
	if (photo && !navigator.onLine) {
		outbox.markFailed(clientMessageId, PHOTO_NEEDS_NETWORK_FAILURE)
		return
	}
	try {
		const turn = await postMessage(
			{
				clientMessageId,
				text: text || undefined,
				...(photo ? { photo: { mimeType: photo.mimeType, data: photo.base64 } } : {}),
			},
			{
				onUploadProgress: (ratio) => {
					outbox.setUploadProgress(clientMessageId, ratio)
				},
			},
		)
		addTurnToFeed(queryClient, turn)
		// earlier cards this turn corrected, deleted from or answered in words
		for (const updated of turn.updatedMessages) replaceFeedMessage(queryClient, updated)
		outbox.remove(clientMessageId)
		if (turn.userMessage.photo?.status === 'FAILED') playSound('photoFail')
		else if (turn.assistantMessage.meals.length > 0) playSound('kusik')
		void queryClient.invalidateQueries({ queryKey: DAY_QUERY_KEY })
		// a replayed turn returns no updatedMessages: reload the feed so edited cards are current
		if (isRetry) void queryClient.invalidateQueries({ queryKey: MESSAGES_QUERY_KEY })
	} catch (error) {
		const sendError = getSendError(getApiError(error))
		outbox.markFailed(clientMessageId, sendError)
		// the first request is still running on the server: the feed polls its PENDING turn
		if (sendError.messageKey === 'errors.api.MESSAGE_IN_PROGRESS') {
			outbox.remove(clientMessageId)
			void queryClient.invalidateQueries({ queryKey: MESSAGES_QUERY_KEY })
		}
	}
}
