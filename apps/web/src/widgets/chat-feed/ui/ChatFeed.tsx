import { useInfiniteQuery } from '@tanstack/react-query'
import { motion } from 'motion/react'
import { useEffect, useMemo, useRef } from 'react'
import { useTranslation } from 'react-i18next'

import { messagesQueryOptions } from '@/entities/message'
import type { Addressee } from '@/entities/user'
import { useOutboxStore, useSendMessage } from '@/features/send-message'
import { bubbleVariants, shiftLocalDate } from '@/shared/lib'
import { Button, Loader, Text } from '@/shared/ui'

import { buildFeed } from '../lib/build-feed'
import { useNow } from '../model/use-now'
import { useFeedScroll } from '../model/use-feed-scroll'
import { useNewItemKeys } from '../model/use-new-item-keys'
import { FeedItemView } from './FeedItemView'
import { FeedSkeleton } from './FeedSkeleton'

export interface ChatFeedProps {
	/** Who the new-day greeting calls by name. */
	addressee: Addressee
	timeZone: string
	/** `YYYY-MM-DD` in the user's timezone. */
	today: string
	/** The user scrolled up into the history: the header collapses (mockups/chat-compact.html). */
	onCompactChange: (isCompact: boolean) => void
	/** The composer has focus: the feed shows the newest message above the keyboard. */
	isComposerFocused: boolean
}

/** Start loading the older page this far before the top edge comes into view. */
const PRELOAD_MARGIN = '240px 0px 0px 0px'
const OLDER_LOADER_SIZE = 28

/**
 * The chat history, newest at the bottom: pages of GET /messages plus what is still on its way
 * from this device, grouped by the user's days.
 */
export const ChatFeed = ({
	addressee,
	timeZone,
	today,
	onCompactChange,
	isComposerFocused,
}: ChatFeedProps) => {
	const { t } = useTranslation()
	const query = useInfiniteQuery(messagesQueryOptions)
	const outbox = useOutboxStore((state) => state.items)
	const { retry } = useSendMessage()
	const topRef = useRef<HTMLDivElement>(null)
	const now = useNow()

	const pages = query.data?.pages
	const items = useMemo(
		() =>
			pages
				? buildFeed({
						pages: pages.map((page) => page.messages),
						outbox,
						timeZone,
						today,
						yesterday: shiftLocalDate(today, -1),
						now,
					})
				: [],
		[pages, outbox, timeZone, today, now],
	)
	const newKeys = useNewItemKeys(items)
	const { scrollRef, contentRef } = useFeedScroll({
		items,
		onCompactChange,
		isPinnedToEnd: isComposerFocused,
	})
	const latestReplyKey = items.findLast((item) => item.kind === 'kusik')?.key

	const { hasNextPage, isFetchingNextPage, fetchNextPage } = query
	useEffect(() => {
		const element = topRef.current
		if (!element || !hasNextPage) return
		const observer = new IntersectionObserver(
			([entry]) => {
				if (entry?.isIntersecting && !isFetchingNextPage) void fetchNextPage()
			},
			{ root: scrollRef.current, rootMargin: PRELOAD_MARGIN },
		)
		observer.observe(element)
		return () => {
			observer.disconnect()
		}
	}, [hasNextPage, isFetchingNextPage, fetchNextPage, scrollRef])

	const renderContent = () => {
		if (query.isPending) return <FeedSkeleton />
		if (query.isError) {
			return (
				<div role="alert" className="flex flex-col items-center gap-3 py-6 text-center">
					<Text tone="muted">{t('chat.loadError')}</Text>
					<Button variant="secondary" size="md" onClick={() => void query.refetch()}>
						{t('common.retry')}
					</Button>
				</div>
			)
		}
		return items.map((item) => (
			<motion.div
				key={item.key}
				variants={bubbleVariants}
				initial={newKeys.has(item.key) ? 'hidden' : false}
				animate="visible"
				className="flex flex-col"
			>
				<FeedItemView
					item={item}
					isLatestReply={item.key === latestReplyKey}
					addressee={addressee}
					timeZone={timeZone}
					onRetry={retry}
				/>
			</motion.div>
		))
	}

	return (
		<div
			ref={scrollRef}
			className="scrollbar-none min-h-0 flex-1 overflow-y-auto overscroll-contain mask-fade-top"
		>
			<div
				ref={contentRef}
				role="log"
				aria-label={t('chat.feedLabel')}
				className="flex min-h-full flex-col justify-end gap-4 px-gutter pt-3.5 pb-2.5"
			>
				<div ref={topRef} aria-hidden="true" />
				{isFetchingNextPage && (
					<Loader
						size={OLDER_LOADER_SIZE}
						ariaLabel={t('chat.loadingOlder')}
						className="self-center"
					/>
				)}
				{renderContent()}
			</div>
		</div>
	)
}
