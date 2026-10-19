// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { FeedItem } from './feed.types'
import { SMOOTH_SCROLL_SAFETY_MS, useFeedScroll } from './use-feed-scroll'

const reducedMotion = vi.hoisted(() => ({ value: false }))

vi.mock('motion/react', () => ({ useReducedMotion: () => reducedMotion.value }))

const SCROLL_HEIGHT = 2000
const CLIENT_HEIGHT = 500
const MAX_SCROLL_TOP = SCROLL_HEIGHT - CLIENT_HEIGHT
const FAR_FROM_BOTTOM_TOP = 400

const items: FeedItem[] = [{ kind: 'greeting', key: 'greeting' }]

const metrics = { scrollTop: 0 }
const scrollToMock = vi.fn()

const Harness = () => {
	const { scrollRef, contentRef, scrollToEndOnTap } = useFeedScroll({
		items,
		onCompactChange: () => undefined,
		scrollToEndRequest: 0,
		fullHeaderHeight: 0,
	})
	return (
		<div data-testid="container" ref={scrollRef}>
			<div ref={contentRef} />
			<button type="button" onClick={scrollToEndOnTap}>
				tap
			</button>
		</div>
	)
}

beforeEach(() => {
	vi.useFakeTimers()
	reducedMotion.value = false
	metrics.scrollTop = FAR_FROM_BOTTOM_TOP
	scrollToMock.mockReset()
	vi.stubGlobal(
		'ResizeObserver',
		class {
			observe = () => undefined
			unobserve = () => undefined
			disconnect = () => undefined
		},
	)
	Object.defineProperty(HTMLDivElement.prototype, 'scrollHeight', {
		configurable: true,
		get: () => SCROLL_HEIGHT,
	})
	Object.defineProperty(HTMLDivElement.prototype, 'clientHeight', {
		configurable: true,
		get: () => CLIENT_HEIGHT,
	})
	Object.defineProperty(HTMLDivElement.prototype, 'scrollTop', {
		configurable: true,
		get: () => metrics.scrollTop,
		set: (value: number) => {
			metrics.scrollTop = Math.min(Math.max(value, 0), MAX_SCROLL_TOP)
		},
	})
	Object.defineProperty(HTMLDivElement.prototype, 'scrollTo', {
		configurable: true,
		value: scrollToMock,
	})
})

afterEach(() => {
	cleanup()
	vi.useRealTimers()
	vi.unstubAllGlobals()
	for (const key of ['scrollHeight', 'clientHeight', 'scrollTop', 'scrollTo']) {
		Reflect.deleteProperty(HTMLDivElement.prototype, key)
	}
})

const tap = (): void => {
	render(<Harness />)
	metrics.scrollTop = FAR_FROM_BOTTOM_TOP
	scrollToMock.mockClear()
	fireEvent.click(screen.getByText('tap'))
}

describe('useFeedScroll scrollToEndOnTap', () => {
	it('scrolls smoothly to the end', () => {
		tap()

		expect(scrollToMock).toHaveBeenCalledWith({ top: SCROLL_HEIGHT, behavior: 'smooth' })
	})

	it('scrolls instantly under reduced motion', () => {
		reducedMotion.value = true

		tap()

		expect(scrollToMock).toHaveBeenCalledWith({ top: SCROLL_HEIGHT, behavior: 'auto' })
		expect(scrollToMock).not.toHaveBeenCalledWith(expect.objectContaining({ behavior: 'smooth' }))
	})

	it('jumps to the end after the safety delay when the smooth scroll stopped short', () => {
		tap()
		scrollToMock.mockClear()

		act(() => {
			vi.advanceTimersByTime(SMOOTH_SCROLL_SAFETY_MS)
		})

		expect(scrollToMock).toHaveBeenCalledWith({ top: SCROLL_HEIGHT, behavior: 'auto' })
	})

	it('does nothing extra when the end was reached', () => {
		tap()
		scrollToMock.mockClear()
		metrics.scrollTop = MAX_SCROLL_TOP

		act(() => {
			vi.advanceTimersByTime(SMOOTH_SCROLL_SAFETY_MS)
		})

		expect(scrollToMock).not.toHaveBeenCalled()
	})

	it('drops the safety jump when the user takes over the scroll', () => {
		tap()
		scrollToMock.mockClear()

		fireEvent.touchStart(screen.getByTestId('container'))
		act(() => {
			vi.advanceTimersByTime(SMOOTH_SCROLL_SAFETY_MS)
		})

		expect(scrollToMock).not.toHaveBeenCalled()
	})

	it('drops the safety jump on unmount', () => {
		tap()
		scrollToMock.mockClear()

		cleanup()
		act(() => {
			vi.advanceTimersByTime(SMOOTH_SCROLL_SAFETY_MS)
		})

		expect(scrollToMock).not.toHaveBeenCalled()
	})
})
