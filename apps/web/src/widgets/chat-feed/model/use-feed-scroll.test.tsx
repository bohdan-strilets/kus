// @vitest-environment jsdom
import { act, cleanup, render } from '@testing-library/react'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

import type { FeedItem } from './feed.types'
import { useFeedScroll } from './use-feed-scroll'

const INITIAL_SCROLL_HEIGHT = 2000
const INITIAL_CLIENT_HEIGHT = 500
const HEADER_DELTA_PX = 115
const FAR_FROM_BOTTOM_PX = 500

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

const Harness = ({ scrollToEndRequest = 0 }: { scrollToEndRequest?: number }) => {
	const { scrollRef, contentRef } = useFeedScroll({
		items,
		onCompactChange: () => undefined,
		scrollToEndRequest,
	})
	return (
		<div data-testid="container" ref={scrollRef}>
			<div data-testid="content" ref={contentRef} />
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

const renderFeed = () => {
	const view = render(<Harness />)
	return {
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
