import type { QueryClient } from '@tanstack/react-query'

import { DAY_QUERY_KEY } from '@/entities/day'
import { addTurnToFeed, MESSAGES_QUERY_KEY } from '@/entities/message'
import { getApiError } from '@/shared/api'
import { playSound } from '@/shared/lib'

import { postMessage } from '../api/send-message'
import { getSendError } from '../lib/get-send-error'
import { useOutboxStore } from './outbox-store'

interface DeliverParams {
	clientMessageId: string
	text: string
}

/**
 * Sends one message, first try or «Спробувати ще» — always with the same clientMessageId, so the
 * API replays or resumes the turn instead of logging the food twice.
 */
export const deliverMessage = async (
	queryClient: QueryClient,
	{ clientMessageId, text }: DeliverParams,
): Promise<void> => {
	const outbox = useOutboxStore.getState()
	outbox.markSending({ clientMessageId, text, createdAt: new Date().toISOString() })
	try {
		const turn = await postMessage({ clientMessageId, text })
		addTurnToFeed(queryClient, turn)
		outbox.remove(clientMessageId)
		if (turn.assistantMessage.meals.length > 0) playSound('kusik')
		void queryClient.invalidateQueries({ queryKey: DAY_QUERY_KEY })
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
