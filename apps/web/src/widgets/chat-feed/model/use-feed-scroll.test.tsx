// @vitest-environment jsdom
import { act, cleanup, render, screen } from '@testing-library/react'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

import type { FeedItem } from './feed.types'
import { useFeedScroll } from './use-feed-scroll'

const INITIAL_SCROLL_HEIGHT = 2000
const INITIAL_CLIENT_HEIGHT = 500
const HEADER_DELTA_PX = 115
const FAR_FROM_BOTTOM_PX = 500
const NEAR_BOTTOM_PX = 10
const MID_DISTANCE_PX = 100
const HEADER_HEIGHT_PX = 219
const HEADER_HEIGHT_GROWTH_PX = 40

type ObserverCallback = (entries: { target: Element }[]) => void

let observerCallback: ObserverCallback | undefined
const observed: Element[] = []

beforeAll(() => {
	defineMetrics()
	vi.stubGlobal(
		'ResizeObserver',
		class {
			constructor(callback: ObserverCallback) {
				observerCallback = callback
			}
			observe = (element: Element): void => {
				observed.push(element)
			}
			unobserve = () => undefined
			disconnect = () => undefined
		},
	)
})

const items: FeedItem[] = [{ kind: 'greeting', key: 'greeting' }]

interface Metrics {
	scrollHeight: number
	clientHeight: number
	scrollTop: number
}

const metrics: Metrics = { scrollHeight: 0, clientHeight: 0, scrollTop: 0 }

interface HarnessProps {
	scrollToEndRequest?: number
	fullHeaderHeight?: number
	onCompactChange?: (isCompact: boolean) => void
}

const Harness = ({
	scrollToEndRequest = 0,
	fullHeaderHeight = HEADER_HEIGHT_PX,
	onCompactChange = () => undefined,
}: HarnessProps) => {
	const { scrollRef, contentRef, isScrolledUp } = useFeedScroll({
		items,
		onCompactChange,
		scrollToEndRequest,
		fullHeaderHeight,
	})
	return (
		<div data-testid="container" ref={scrollRef}>
			<div data-testid="content" ref={contentRef} />
			<output data-testid="scrolled-up">{String(isScrolledUp)}</output>
		</div>
	)
}

const maxScrollTop = (): number => metrics.scrollHeight - metrics.clientHeight

const defineMetrics = (): void => {
	Object.defineProperty(HTMLDivElement.prototype, 'scrollHeight', {
		configurable: true,
		get: () => metrics.scrollHeight,
	})
	Object.defineProperty(HTMLDivElement.prototype, 'clientHeight', {
		configurable: true,
		get: () => metrics.clientHeight,
	})
	Object.defineProperty(HTMLDivElement.prototype, 'scrollTop', {
		configurable: true,
		get: () => metrics.scrollTop,
		set: (value: number) => {
			metrics.scrollTop = Math.min(Math.max(value, 0), maxScrollTop())
		},
	})
}

const distanceFromBottom = (): number =>
	metrics.scrollHeight - metrics.scrollTop - metrics.clientHeight

const renderFeed = (onCompactChange?: (isCompact: boolean) => void) => {
	const view = render(<Harness onCompactChange={onCompactChange} />)
	return {
		setHeaderHeight: (fullHeaderHeight: number): void => {
			view.rerender(
				<Harness fullHeaderHeight={fullHeaderHeight} onCompactChange={onCompactChange} />,
			)
		},
		container: view.getByTestId('container'),
		content: view.getByTestId('content'),
		request: (scrollToEndRequest: number): void => {
			view.rerender(<Harness scrollToEndRequest={scrollToEndRequest} />)
		},
	}
}

const scrollTo = (container: HTMLElement, distance: number): void => {
	metrics.scrollTop = maxScrollTop() - distance
	act(() => {
		container.dispatchEvent(new Event('scroll'))
	})
}

const readScrolledUp = (): string | null => screen.getByTestId('scrolled-up').textContent

const resize = (target: Element): void => {
	act(() => {
		observerCallback?.([{ target }])
	})
}

beforeEach(() => {
	metrics.scrollHeight = INITIAL_SCROLL_HEIGHT
	metrics.clientHeight = INITIAL_CLIENT_HEIGHT
	metrics.scrollTop = 0
	observerCallback = undefined
	observed.length = 0
})

afterEach(cleanup)

afterAll(() => {
	for (const key of ['scrollHeight', 'clientHeight', 'scrollTop']) {
		Reflect.deleteProperty(HTMLDivElement.prototype, key)
	}
})

describe('useFeedScroll', () => {
	it('opens at the newest message', () => {
		renderFeed()

		expect(metrics.scrollTop).toBe(maxScrollTop())
	})

	it('keeps the distance to the bottom when the container grows while scrolled up', () => {
		const { container } = renderFeed()
		scrollTo(container, FAR_FROM_BOTTOM_PX)

		metrics.clientHeight += HEADER_DELTA_PX
		resize(container)

		expect(distanceFromBottom()).toBe(FAR_FROM_BOTTOM_PX)
	})

	it('keeps the distance to the bottom when the container shrinks while scrolled up', () => {
		const { container } = renderFeed()
		scrollTo(container, FAR_FROM_BOTTOM_PX)

		metrics.clientHeight -= HEADER_DELTA_PX
		resize(container)

		expect(distanceFromBottom()).toBe(FAR_FROM_BOTTOM_PX)
	})

	it('stays at the bottom when the container shrinks at the bottom', () => {
		const { container } = renderFeed()
		expect(observed).toContain(container)

		metrics.clientHeight -= 60
		resize(container)

		expect(distanceFromBottom()).toBe(0)
	})

	it('does not move the scroll when content grows while scrolled up', () => {
		const { container, content } = renderFeed()
		scrollTo(container, FAR_FROM_BOTTOM_PX)
		const before = metrics.scrollTop

		metrics.scrollHeight += 300
		resize(content)

		expect(metrics.scrollTop).toBe(before)
	})
})

describe('useFeedScroll full header height', () => {
	it('moves the scroll by the delta when the full header grows while scrolled up', () => {
		const { container, setHeaderHeight } = renderFeed()
		scrollTo(container, MID_DISTANCE_PX)
		const before = metrics.scrollTop

		setHeaderHeight(HEADER_HEIGHT_PX + HEADER_HEIGHT_GROWTH_PX)

		expect(metrics.scrollTop).toBe(before + HEADER_HEIGHT_GROWTH_PX)
	})

	it('moves the scroll back when the full header shrinks while scrolled up', () => {
		const { container, setHeaderHeight } = renderFeed()
		scrollTo(container, MID_DISTANCE_PX)
		const before = metrics.scrollTop

		setHeaderHeight(HEADER_HEIGHT_PX - HEADER_HEIGHT_GROWTH_PX)

		expect(metrics.scrollTop).toBe(before - HEADER_HEIGHT_GROWTH_PX)
	})

	it('does not touch the scroll at the bottom', () => {
		const { setHeaderHeight } = renderFeed()
		const before = metrics.scrollTop

		setHeaderHeight(HEADER_HEIGHT_PX + HEADER_HEIGHT_GROWTH_PX)

		expect(metrics.scrollTop).toBe(before)
	})

	it('does not touch the scroll while the compact header is up', () => {
		const onCompactChange = vi.fn()
		const { container, setHeaderHeight } = renderFeed(onCompactChange)
		scrollTo(container, FAR_FROM_BOTTOM_PX)
		expect(onCompactChange).toHaveBeenCalledWith(true)
		const before = metrics.scrollTop

		setHeaderHeight(HEADER_HEIGHT_PX + HEADER_HEIGHT_GROWTH_PX)

		expect(metrics.scrollTop).toBe(before)
	})
})

describe('useFeedScroll compact header', () => {
	it('asks for the compact header at once when scrolled far up', () => {
		const onCompactChange = vi.fn()
		const { container } = renderFeed(onCompactChange)

		scrollTo(container, FAR_FROM_BOTTOM_PX)

		expect(onCompactChange).toHaveBeenCalledExactlyOnceWith(true)
	})

	it('asks for the full header again near the end', () => {
		const onCompactChange = vi.fn()
		const { container } = renderFeed(onCompactChange)
		scrollTo(container, FAR_FROM_BOTTOM_PX)

		scrollTo(container, 0)

		expect(onCompactChange).toHaveBeenLastCalledWith(false)
	})
})

describe('useFeedScroll scrollToEndRequest', () => {
	it('jumps to the end when the counter grows while scrolled up', () => {
		const { container, request } = renderFeed()
		scrollTo(container, FAR_FROM_BOTTOM_PX)

		request(1)

		expect(distanceFromBottom()).toBe(0)
	})

	it('jumps again on every next request, even though nothing else changed', () => {
		const { container, request } = renderFeed()
		scrollTo(container, FAR_FROM_BOTTOM_PX)
		request(1)
		scrollTo(container, FAR_FROM_BOTTOM_PX)

		request(2)

		expect(distanceFromBottom()).toBe(0)
	})

	it('counts as «at the bottom» afterwards: growing content keeps the end', () => {
		const { container, content, request } = renderFeed()
		scrollTo(container, FAR_FROM_BOTTOM_PX)
		request(1)

		metrics.scrollHeight += 300
		resize(content)

		expect(distanceFromBottom()).toBe(0)
	})

	it('does not scroll while the counter stays the same', () => {
		const { container, request } = renderFeed()
		scrollTo(container, FAR_FROM_BOTTOM_PX)
		const before = metrics.scrollTop

		request(0)

		expect(metrics.scrollTop).toBe(before)
	})

	it('does not scroll again on a rerender with the same non-zero counter', () => {
		const { container, request } = renderFeed()
		request(1)
		scrollTo(container, FAR_FROM_BOTTOM_PX)
		const before = metrics.scrollTop

		request(1)

		expect(metrics.scrollTop).toBe(before)
	})
})

describe('useFeedScroll isScrolledUp', () => {
	it('is false initially, at the bottom', () => {
		renderFeed()

		expect(readScrolledUp()).toBe('false')
	})

	it('is true after scrolling far up from the end', () => {
		const { container } = renderFeed()

		scrollTo(container, FAR_FROM_BOTTOM_PX)

		expect(readScrolledUp()).toBe('true')
	})

	it('stays false for a small scroll near the end', () => {
		const { container } = renderFeed()

		scrollTo(container, NEAR_BOTTOM_PX)

		expect(readScrolledUp()).toBe('false')
	})

	it('is false again after scrolling back down', () => {
		const { container } = renderFeed()
		scrollTo(container, FAR_FROM_BOTTOM_PX)

		scrollTo(container, 0)

		expect(readScrolledUp()).toBe('false')
	})

	it('is false after a scroll-to-end request', () => {
		const { container, request } = renderFeed()
		scrollTo(container, FAR_FROM_BOTTOM_PX)

		request(1)

		expect(readScrolledUp()).toBe('false')
	})

	it('follows a content resize: a user scrolled up stays «up» as the content grows', () => {
		const { container, content } = renderFeed()
		scrollTo(container, FAR_FROM_BOTTOM_PX)

		metrics.scrollHeight += 400
		resize(content)

		expect(readScrolledUp()).toBe('true')
	})
})
