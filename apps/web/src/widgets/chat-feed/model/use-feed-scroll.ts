import { useReducedMotion } from 'motion/react'
import { type RefObject, useEffect, useLayoutEffect, useRef, useState } from 'react'

import type { FeedItem } from './feed.types'

/** Closer than this to the end counts as «at the bottom»: new messages keep it pinned. */
const BOTTOM_SLACK_PX = 24
/**
 * The header collapses once the user scrolls this far up from the newest message, and opens again
 * near the end. The gap is a hysteresis, so the header does not flicker around one threshold.
 */
const COMPACT_FROM_PX = 200
const EXPAND_UNDER_PX = BOTTOM_SLACK_PX
/**
 * iOS Safari can stop a native smooth scroll short when photos load under it: once it should have
 * finished (~300 ms), whatever is left to the end is scrolled instantly.
 */
export const SMOOTH_SCROLL_SAFETY_MS = 350
const SCROLL_END_TOLERANCE_PX = 1

type ScrollBehaviorMode = 'auto' | 'smooth'

interface Snapshot {
	/** The oldest message, not a divider: an older page of the same day keeps the day pill first. */
	firstKey: string | undefined
	lastKey: string | undefined
	scrollHeight: number
}

interface FeedScrollOptions {
	items: readonly FeedItem[]
	onCompactChange: (isCompact: boolean) => void
	/**
	 * Grows on every ask to show the newest message (the field was tapped or focused, a chip was
	 * tapped): jump to the end and stay there while the keyboard opens.
	 */
	scrollToEndRequest: number
	/** Measured height of the full header, which the feed content is padded by. */
	fullHeaderHeight: number
}

interface FeedScroll {
	scrollRef: RefObject<HTMLDivElement | null>
	contentRef: RefObject<HTMLDivElement | null>
	/** Scrolled far enough from the newest message for the «to the end» button to show. */
	isScrolledUp: boolean
	/** The «to the end» button: a smooth scroll (instant under reduced motion). */
	scrollToEndOnTap: () => void
}

const getDistanceFromBottom = (element: HTMLElement): number =>
	element.scrollHeight - element.scrollTop - element.clientHeight

const scrollElementToEnd = (element: HTMLElement, behavior: ScrollBehaviorMode): void => {
	element.scrollTo({ top: element.scrollHeight, behavior })
}

/**
 * The chat reads from the bottom: it opens at the newest message and stays there while new ones
 * arrive or the content grows (a question opens, the header collapses). An older page loaded on
 * top keeps the message under the finger where it was.
 */
export const useFeedScroll = ({
	items,
	onCompactChange,
	scrollToEndRequest,
	fullHeaderHeight,
}: FeedScrollOptions): FeedScroll => {
	const scrollRef = useRef<HTMLDivElement>(null)
	const contentRef = useRef<HTMLDivElement>(null)
	const snapshot = useRef<Snapshot | null>(null)
	const isAtBottom = useRef(true)
	const isCompact = useRef(false)
	const [isScrolledUp, setIsScrolledUp] = useState(false)
	const onCompactChangeRef = useRef(onCompactChange)
	useLayoutEffect(() => {
		onCompactChangeRef.current = onCompactChange
	})
	const isReducedMotion = useReducedMotion()
	const safetyTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
	const clearSafetyTimer = (): void => {
		clearTimeout(safetyTimer.current)
		safetyTimer.current = undefined
	}
	useEffect(() => clearSafetyTimer, [])

	const scrollToEndOnTap = (): void => {
		const element = scrollRef.current
		if (!element) return
		clearSafetyTimer()
		if (isReducedMotion) {
			scrollElementToEnd(element, 'auto')
			isAtBottom.current = true
			setIsScrolledUp(false)
			return
		}
		scrollElementToEnd(element, 'smooth')
		safetyTimer.current = setTimeout(() => {
			safetyTimer.current = undefined
			if (getDistanceFromBottom(element) > SCROLL_END_TOLERANCE_PX) {
				scrollElementToEnd(element, 'auto')
			}
		}, SMOOTH_SCROLL_SAFETY_MS)
	}

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

	// the keyboard then shrinks the feed: keepBottom below holds the end while it does
	useLayoutEffect(() => {
		const element = scrollRef.current
		if (scrollToEndRequest === 0 || !element) return
		clearSafetyTimer()
		element.scrollTop = element.scrollHeight
		isAtBottom.current = true
		setIsScrolledUp(false)
	}, [scrollToEndRequest])

	// The full header floats over the feed and the content is padded by its height. When that height
	// changes (skeleton -> card) and the user is not at the end, the content moves by the delta: shift
	// the scroll by the same amount so what they read stays in place. isCompact is the scroll state
	// (a header shrunk by typing still shifts the content, so the shift still applies). Only a real
	// height change writes scrollTop; swapping the headers never does (it stops iOS inertia).
	const lastHeaderHeight = useRef(fullHeaderHeight)
	useLayoutEffect(() => {
		const element = scrollRef.current
		const delta = fullHeaderHeight - lastHeaderHeight.current
		lastHeaderHeight.current = fullHeaderHeight
		if (!element || delta === 0 || isCompact.current || isAtBottom.current) return
		element.scrollTop += delta
	}, [fullHeaderHeight])

	useEffect(() => {
		const element = scrollRef.current
		const content = contentRef.current
		if (!element || !content) return

		const updateScrolledUp = (): void => {
			setIsScrolledUp(getDistanceFromBottom(element) > COMPACT_FROM_PX)
		}
		const updateCompact = (): void => {
			const distance = getDistanceFromBottom(element)
			const nextCompact = isCompact.current
				? distance > EXPAND_UNDER_PX
				: distance > COMPACT_FROM_PX
			if (nextCompact === isCompact.current) return
			isCompact.current = nextCompact
			onCompactChangeRef.current(nextCompact)
		}
		const handleScroll = (): void => {
			isAtBottom.current = getDistanceFromBottom(element) <= BOTTOM_SLACK_PX
			updateScrolledUp()
			updateCompact()
		}
		let lastClientHeight = element.clientHeight
		const keepBottom = (entries: readonly ResizeObserverEntry[]): void => {
			const isContainerResized = entries.some((entry) => entry.target === element)
			if (isContainerResized) {
				const clientHeight = element.clientHeight
				const delta = clientHeight - lastClientHeight
				lastClientHeight = clientHeight
				// the keyboard or the composer resizes the feed: its bottom edge stays put for the user,
				// so one scrolled up keeps the same distance to it instead of drifting
				if (!isAtBottom.current) element.scrollTop -= delta
			}
			if (isAtBottom.current) element.scrollTop = element.scrollHeight
			if (snapshot.current) snapshot.current.scrollHeight = element.scrollHeight
			updateScrolledUp()
		}
		const observer = new ResizeObserver(keepBottom)
		observer.observe(element)
		observer.observe(content)
		element.addEventListener('scroll', handleScroll, { passive: true })
		// the user took over the scroll: the safety jump must not drag them back
		element.addEventListener('touchstart', clearSafetyTimer, { passive: true })
		element.addEventListener('wheel', clearSafetyTimer, { passive: true })
		return () => {
			observer.disconnect()
			element.removeEventListener('scroll', handleScroll)
			element.removeEventListener('touchstart', clearSafetyTimer)
			element.removeEventListener('wheel', clearSafetyTimer)
		}
	}, [])

	return { scrollRef, contentRef, isScrolledUp, scrollToEndOnTap }
}
