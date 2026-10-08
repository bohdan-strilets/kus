import { type RefObject, useEffect, useLayoutEffect, useRef } from 'react'

import type { FeedItem } from './feed.types'

/** Closer than this to the end counts as «at the bottom»: new messages keep it pinned. */
const BOTTOM_SLACK_PX = 24
/**
 * The header collapses once the user scrolls this far up from the newest message, and opens again
 * near the end. The gap must exceed what the swap itself adds (full 185 → compact 70 px at 390 px
 * width), or opening the header would push the distance back over the threshold and collapse it.
 */
const COMPACT_FROM_PX = 200
const EXPAND_UNDER_PX = BOTTOM_SLACK_PX
/** The header's exit + enter (base 200 ms each, AnimatePresence mode="wait") and a little air. */
const HEADER_SWAP_SETTLE_MS = 500

interface Snapshot {
	/** The oldest message, not a divider: an older page of the same day keeps the day pill first. */
	firstKey: string | undefined
	lastKey: string | undefined
	scrollHeight: number
}

interface FeedScrollOptions {
	items: readonly FeedItem[]
	onCompactChange: (isCompact: boolean) => void
}

interface FeedScroll {
	scrollRef: RefObject<HTMLDivElement | null>
	contentRef: RefObject<HTMLDivElement | null>
}

const getDistanceFromBottom = (element: HTMLElement): number =>
	element.scrollHeight - element.scrollTop - element.clientHeight

/**
 * The chat reads from the bottom: it opens at the newest message and stays there while new ones
 * arrive or the content grows (a question opens, the header collapses). An older page loaded on
 * top keeps the message under the finger where it was.
 */
export const useFeedScroll = ({ items, onCompactChange }: FeedScrollOptions): FeedScroll => {
	const scrollRef = useRef<HTMLDivElement>(null)
	const contentRef = useRef<HTMLDivElement>(null)
	const snapshot = useRef<Snapshot | null>(null)
	const isAtBottom = useRef(true)
	const isCompact = useRef(false)
	const onCompactChangeRef = useRef(onCompactChange)
	useLayoutEffect(() => {
		onCompactChangeRef.current = onCompactChange
	})

	useLayoutEffect(() => {
		const element = scrollRef.current
		if (!element) return
		const firstKey = items.find((item) => item.kind === 'user' || item.kind === 'kusik')?.key
		const lastKey = items.at(-1)?.key
		const previous = snapshot.current
		const isPrepended =
			previous !== null && previous.lastKey === lastKey && previous.firstKey !== firstKey
		if (isPrepended) {
			element.scrollTop += element.scrollHeight - previous.scrollHeight
		} else if (previous === null || isAtBottom.current || previous.lastKey !== lastKey) {
			// first paint, or something new at the end — the user's own message or the answer to it
			element.scrollTop = element.scrollHeight
			isAtBottom.current = true
		}
		snapshot.current = { firstKey, lastKey, scrollHeight: element.scrollHeight }
	}, [items])

	useEffect(() => {
		const element = scrollRef.current
		const content = contentRef.current
		if (!element || !content) return

		let settleTimer: ReturnType<typeof setTimeout> | undefined
		let isSettling = false

		const updateCompact = (): void => {
			const distance = getDistanceFromBottom(element)
			const nextCompact = isCompact.current
				? distance > EXPAND_UNDER_PX
				: distance > COMPACT_FROM_PX
			if (nextCompact === isCompact.current) return
			isCompact.current = nextCompact
			onCompactChangeRef.current(nextCompact)
			// the swap resizes the feed and moves the scroll by itself, often without a scroll event
			// (at the end there is nowhere to scroll): judge again once the new header is in place
			isSettling = true
			settleTimer = setTimeout(() => {
				isSettling = false
				updateCompact()
			}, HEADER_SWAP_SETTLE_MS)
		}
		const handleScroll = (): void => {
			isAtBottom.current = getDistanceFromBottom(element) <= BOTTOM_SLACK_PX
			if (!isSettling) updateCompact()
		}
		const keepBottom = (): void => {
			if (isAtBottom.current) element.scrollTop = element.scrollHeight
			if (snapshot.current) snapshot.current.scrollHeight = element.scrollHeight
		}
		const observer = new ResizeObserver(keepBottom)
		observer.observe(element)
		observer.observe(content)
		element.addEventListener('scroll', handleScroll, { passive: true })
		return () => {
			clearTimeout(settleTimer)
			observer.disconnect()
			element.removeEventListener('scroll', handleScroll)
		}
	}, [])

	return { scrollRef, contentRef }
}
