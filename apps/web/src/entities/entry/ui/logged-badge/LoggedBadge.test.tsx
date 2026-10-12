// @vitest-environment jsdom
// motion.span is replaced by a plain span: jsdom runs no animation frames, so onAnimationComplete
// (which ends the pop and the fade) would never fire. The test triggers it by hand through
// `completeAnimation`, which is what motion does when an animation ends.
import { act, cleanup } from '@testing-library/react'
import type { ReactNode, Ref } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { burst, CELEBRATE } from '@/shared/lib'
import { renderWithProviders } from '@/shared/testing'

import { LoggedBadge } from './LoggedBadge'
import { BADGE_HOLD_MS } from './logged-badge.constants'

interface ActualLib {
	burst: (host: HTMLElement, origin: Element, config: typeof CELEBRATE.kusik) => void
}

let latestOnComplete: (() => void) | undefined

interface MotionSpanProps {
	children?: ReactNode
	className?: string
	onAnimationComplete?: () => void
	ref?: Ref<HTMLSpanElement>
}

vi.mock('motion/react', async (importOriginal) => {
	const actual = await importOriginal<Record<string, unknown>>()
	const MotionSpan = ({ children, className, onAnimationComplete, ref }: MotionSpanProps) => {
		latestOnComplete = onAnimationComplete
		return (
			<span ref={ref} className={className}>
				{children}
			</span>
		)
	}
	return { ...actual, motion: { span: MotionSpan } }
})
vi.mock('@/shared/lib', async (importOriginal) => ({
	...(await importOriginal<Record<string, unknown>>()),
	burst: vi.fn(),
}))

const completeAnimation = () => {
	act(() => {
		latestOnComplete?.()
	})
}

const advance = (ms: number) => {
	act(() => {
		vi.advanceTimersByTime(ms)
	})
}

const host = document.body

beforeEach(() => {
	vi.useFakeTimers()
	latestOnComplete = undefined
	// jsdom has no layout: offsetParent is always null, but the badge needs its positioned ancestor
	vi.spyOn(HTMLElement.prototype, 'offsetParent', 'get').mockReturnValue(host)
})

afterEach(() => {
	cleanup()
	vi.useRealTimers()
	vi.restoreAllMocks()
	vi.mocked(burst).mockClear()
})

describe('LoggedBadge', () => {
	it('throws the crumbs exactly once, after the pop, when it has them', () => {
		const { container } = renderWithProviders(<LoggedBadge index={0} hasCrumbs onDone={vi.fn()} />)
		advance(0)
		expect(burst).not.toHaveBeenCalled()

		completeAnimation()

		expect(burst).toHaveBeenCalledTimes(1)
		expect(burst).toHaveBeenCalledWith(host, container.querySelector('span'), CELEBRATE.kusik)
	})

	it('throws no crumbs when it has none', () => {
		renderWithProviders(<LoggedBadge index={0} hasCrumbs={false} onDone={vi.fn()} />)
		advance(0)

		completeAnimation()

		expect(burst).not.toHaveBeenCalled()
	})

	it('holds, fades, reports done once and renders nothing', () => {
		const onDone = vi.fn()
		const { queryByRole } = renderWithProviders(<LoggedBadge index={0} hasCrumbs onDone={onDone} />)
		expect(queryByRole('img', { name: 'Записано' })).not.toBeNull()
		advance(0)
		completeAnimation()

		advance(BADGE_HOLD_MS - 1)
		completeAnimation()
		expect(onDone).not.toHaveBeenCalled()

		advance(1)
		completeAnimation()

		expect(onDone).toHaveBeenCalledTimes(1)
		expect(queryByRole('img', { name: 'Записано' })).toBeNull()
	})

	it('does not report done before the pop has finished', () => {
		const onDone = vi.fn()
		renderWithProviders(<LoggedBadge index={0} hasCrumbs onDone={onDone} />)

		advance(BADGE_HOLD_MS * 3)

		expect(onDone).not.toHaveBeenCalled()
	})

	it('leaves no timers and no done call after unmount while waiting', () => {
		const onDone = vi.fn()
		const { unmount } = renderWithProviders(<LoggedBadge index={2} hasCrumbs onDone={onDone} />)
		expect(vi.getTimerCount()).toBeGreaterThan(0)

		unmount()

		expect(vi.getTimerCount()).toBe(0)
		advance(BADGE_HOLD_MS * 3)
		expect(onDone).not.toHaveBeenCalled()
	})

	it('leaves no timers and no done call after unmount during the hold', () => {
		const onDone = vi.fn()
		const { unmount } = renderWithProviders(<LoggedBadge index={0} hasCrumbs onDone={onDone} />)
		advance(0)
		completeAnimation()

		unmount()

		expect(vi.getTimerCount()).toBe(0)
		advance(BADGE_HOLD_MS * 3)
		expect(onDone).not.toHaveBeenCalled()
	})
})

describe('burst under reduced motion', () => {
	it('adds no crumbs to the host', async () => {
		const actualLib = await vi.importActual<ActualLib>('@/shared/lib')
		vi.stubGlobal('matchMedia', (query: string) => ({
			matches: query.includes('prefers-reduced-motion'),
			media: query,
		}))
		const origin = document.createElement('span')
		const crumbHost = document.createElement('div')
		crumbHost.appendChild(origin)

		actualLib.burst(crumbHost, origin, CELEBRATE.kusik)
		vi.unstubAllGlobals()

		expect(crumbHost.children).toHaveLength(1)
	})
})
