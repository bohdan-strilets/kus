import type { ChatMessage } from '@kus/shared'
import { type InfiniteData, infiniteQueryOptions, type QueryClient } from '@tanstack/react-query'

import { getMessages, type MessagesPage } from '../api/get-messages'

export const MESSAGES_QUERY_KEY = ['messages'] as const

/** While a turn is still PENDING on the server (sent from another tab, or before a reload). */
const PENDING_POLL_MS = 3000
/** The API resumes a PENDING turn older than this on a resend: it was lost (STALE_PENDING_MS). */
export const STALE_PENDING_MS = 2 * 60 * 1000

export const isLostTurn = (message: ChatMessage, now: Date): boolean =>
	now.getTime() - Date.parse(message.createdAt) > STALE_PENDING_MS

/** Only a live turn is worth polling; a lost one stays PENDING until it is resent. */
const hasPendingTurn = (data: InfiniteData<MessagesPage> | undefined): boolean => {
	const newest = data?.pages[0]?.messages[0]
	return newest?.status === 'PENDING' && !isLostTurn(newest, new Date())
}

export const messagesQueryOptions = infiniteQueryOptions({
	queryKey: MESSAGES_QUERY_KEY,
	queryFn: ({ pageParam }) => getMessages(pageParam),
	initialPageParam: null as string | null,
	getNextPageParam: (lastPage) => lastPage.nextCursor,
	refetchInterval: (query) => (hasPendingTurn(query.state.data) ? PENDING_POLL_MS : false),
})

type FeedData = InfiniteData<MessagesPage, string | null>

const updateFeed = (
	queryClient: QueryClient,
	update: (pages: MessagesPage[]) => MessagesPage[],
): void => {
	queryClient.setQueryData<FeedData>(MESSAGES_QUERY_KEY, (data) =>
		data ? { ...data, pages: update(data.pages) } : data,
	)
}

/**
 * A finished turn goes on top of the newest page. A resend reuses the user message id, so its
 * FAILED copy from an earlier load is dropped first.
 */
export const addTurnToFeed = (
	queryClient: QueryClient,
	{ userMessage, assistantMessage }: { userMessage: ChatMessage; assistantMessage: ChatMessage },
): void => {
	const ids = new Set([userMessage.id, assistantMessage.id])
	updateFeed(queryClient, (pages) =>
		pages.map((page, index) => {
			const messages = page.messages.filter((message) => !ids.has(message.id))
			return index === 0
				? { ...page, messages: [assistantMessage, userMessage, ...messages] }
				: { ...page, messages }
		}),
	)
}

/** An answered clarification changes its message (status and meal card) in place. */
export const replaceFeedMessage = (queryClient: QueryClient, next: ChatMessage): void => {
	updateFeed(queryClient, (pages) =>
		pages.map((page) => ({
			...page,
			messages: page.messages.map((message) => (message.id === next.id ? next : message)),
		})),
	)
}
