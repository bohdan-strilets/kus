import { useInfiniteQuery } from '@tanstack/react-query'
import { motion } from 'motion/react'
import { type CSSProperties, useEffect, useMemo, useRef } from 'react'
import { useTranslation } from 'react-i18next'

import { messagesQueryOptions } from '@/entities/message'
import type { Addressee } from '@/entities/user'
import { useOutboxStore, usePhotoSessionStore, useSendMessage } from '@/features/send-message'
import { bubbleVariants, shiftLocalDate } from '@/shared/lib'
import { Button, Loader, Text } from '@/shared/ui'

import { buildFeed } from '../lib/build-feed'
import type { FeedDismiss } from '../model/feed.types'
import { useNow } from '../model/use-now'
import { useFeedScroll } from '../model/use-feed-scroll'
import { useNewItemKeys } from '../model/use-new-item-keys'
import { FeedItemView } from './FeedItemView'
import { FeedSkeleton } from './FeedSkeleton'
import { ScrollToEndButton } from './ScrollToEndButton'

export interface ChatFeedProps {
	/** Who the new-day greeting calls by name. */
	addressee: Addressee
	timeZone: string
	/** `YYYY-MM-DD` in the user's timezone. */
	today: string
	/** The user scrolled up into the history: the header collapses (mockups/chat-compact.html). */
	onCompactChange: (isCompact: boolean) => void
	/** Grows when the feed should show the newest message above the keyboard (see useFeedScroll). */
	scrollToEndRequest: number
	/** The last measured height of the full header: the content starts below it. */
	headerHeight: number
	/** The header's height in its current mode: the feed is masked out above it. */
	fadeTop: number
	/** A sheet is open over the feed: whoever was at the end stays there (see useFeedScroll). */
	isCovered?: boolean
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
	scrollToEndRequest,
	headerHeight,
	fadeTop,
	isCovered = false,
}: ChatFeedProps) => {
	const { t } = useTranslation()
	const query = useInfiniteQuery(messagesQueryOptions)
	const outbox = useOutboxStore((state) => state.items)
	const hiddenIds = useOutboxStore((state) => state.hiddenIds)
	const removeDraft = useOutboxStore((state) => state.remove)
	const hideMessage = useOutboxStore((state) => state.hide)
	const previews = usePhotoSessionStore((state) => state.previews)
	const uploadProgress = usePhotoSessionStore((state) => state.uploadProgress)
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
						previews,
						uploadProgress,
						hiddenIds: new Set(hiddenIds),
						timeZone,
						today,
						yesterday: shiftLocalDate(today, -1),
						now,
					})
				: [],
		[pages, outbox, previews, uploadProgress, hiddenIds, timeZone, today, now],
	)
	const dismiss = (target: FeedDismiss): void => {
		if (target.target === 'outbox') removeDraft(target.id)
		else hideMessage(target.id)
	}
	const newKeys = useNewItemKeys(items)
	const { scrollRef, contentRef, isScrolledUp, scrollToEndOnTap } = useFeedScroll({
		items,
		onCompactChange,
		scrollToEndRequest,
		fullHeaderHeight: headerHeight,
		isCovered,
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
					today={today}
					onRetry={retry}
					onDismiss={dismiss}
				/>
			</motion.div>
		))
	}

	return (
		<div className="relative flex min-h-0 flex-1 flex-col">
			<div
				ref={scrollRef}
				style={
					{ '--feed-top': `${fadeTop}px`, '--feed-header': `${headerHeight}px` } as CSSProperties
				}
				className="scrollbar-none min-h-0 flex-1 overflow-y-auto overscroll-contain mask-fade-top"
			>
				<div
					ref={contentRef}
					role="log"
					aria-label={t('chat.feedLabel')}
					className="flex min-h-full flex-col justify-end gap-4 px-gutter pt-feed-header pb-2.5"
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
			<ScrollToEndButton isShown={isScrolledUp} onPress={scrollToEndOnTap} />
		</div>
	)
}
