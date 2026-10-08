import type { ChatMessage, SendMessageResponse } from '@kus/shared'
import { QueryClient } from '@tanstack/react-query'
import { AxiosError } from 'axios'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { DAY_QUERY_KEY } from '@/entities/day'
import { MESSAGES_QUERY_KEY, type MessagesPage } from '@/entities/message'

import { postMessage } from '../api/send-message'
import { deliverMessage } from './deliver-message'
import { useOutboxStore } from './outbox-store'

vi.mock('../api/send-message', () => ({ postMessage: vi.fn() }))
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
}

const networkError = new AxiosError('Network Error')

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
