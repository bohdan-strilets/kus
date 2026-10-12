// @vitest-environment jsdom
import { act, cleanup, render, screen } from '@testing-library/react'
import { StrictMode, useEffect } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { burst, CELEBRATE, isReducedMotion, playSound, RING_FILL_MS } from '@/shared/lib'

import { useGoalCelebrationStore } from '../../model/goal-celebration-store'
import { COMPACT_GOAL_DISTANCE } from './goal-celebration-frame.constants'
import { GoalCelebrationFrame } from './GoalCelebrationFrame'

vi.mock('motion', () => ({ animate: vi.fn() }))
vi.mock('@/shared/lib', async (importOriginal) => ({
	...(await importOriginal<Record<string, unknown>>()),
	playSound: vi.fn(),
	burst: vi.fn(),
	isReducedMotion: vi.fn(),
}))

const USER = '0199b3a4-0000-7000-8000-00000000000a'
const TODAY = '2026-10-12'

const setPending = () => {
	act(() => {
		useGoalCelebrationStore.getState().setPending(TODAY)
	})
}

const advance = (ms: number) => {
	act(() => {
		vi.advanceTimersByTime(ms)
	})
}

beforeEach(() => {
	vi.useFakeTimers()
	localStorage.clear()
	vi.mocked(isReducedMotion).mockReturnValue(false)
	useGoalCelebrationStore.setState({
		ownerId: null,
		armed: null,
		pending: null,
		celebratedReplyId: null,
	})
})

afterEach(() => {
	cleanup()
	vi.clearAllMocks()
	vi.useRealTimers()
})

describe('GoalCelebrationFrame', () => {
	it('is a plain box without celebration and leaves a pending goal untouched', () => {
		const { container } = render(
			<GoalCelebrationFrame>
				<span>ring</span>
			</GoalCelebrationFrame>,
		)
		setPending()
		advance(RING_FILL_MS * 2)

		expect(screen.getByText('ring')).toBeTruthy()
		expect(container.querySelector('[aria-hidden="true"]')).toBeNull()
		expect(container.firstElementChild?.className).toContain('relative')
		expect(useGoalCelebrationStore.getState().pending).not.toBeNull()
		expect(burst).not.toHaveBeenCalled()
	})

	it('renders a hidden glow layer and the children with celebration', () => {
		const { container } = render(
			<GoalCelebrationFrame celebration={{ userId: USER, today: TODAY }}>
				<span>ring</span>
			</GoalCelebrationFrame>,
		)

		expect(screen.getByText('ring')).toBeTruthy()
		expect(container.querySelector('span[aria-hidden="true"]')).not.toBeNull()
	})

	it('does not remount the children when celebration comes and goes', () => {
		let mounts = 0
		let unmounts = 0
		const Ring = () => {
			useEffect(() => {
				mounts += 1
				return () => {
					unmounts += 1
				}
			}, [])
			return <span data-testid="ring">ring</span>
		}
		const celebration = { userId: USER, today: TODAY }
		const { rerender } = render(
			<GoalCelebrationFrame>
				<Ring />
			</GoalCelebrationFrame>,
		)
		const node = screen.getByTestId('ring')

		rerender(
			<GoalCelebrationFrame celebration={celebration}>
				<Ring />
			</GoalCelebrationFrame>,
		)
		expect(screen.getByTestId('ring')).toBe(node)

		rerender(
			<GoalCelebrationFrame>
				<Ring />
			</GoalCelebrationFrame>,
		)
		expect(screen.getByTestId('ring')).toBe(node)
		expect(mounts).toBe(1)
		expect(unmounts).toBe(0)
	})

	it('renders the glow only with celebration and before the children', () => {
		const { container, rerender } = render(
			<GoalCelebrationFrame celebration={{ userId: USER, today: TODAY }}>
				<span>ring</span>
			</GoalCelebrationFrame>,
		)
		const host = container.firstElementChild
		expect(host?.children).toHaveLength(2)
		expect(host?.firstElementChild?.getAttribute('aria-hidden')).toBe('true')
		expect(host?.lastElementChild?.textContent).toBe('ring')

		rerender(
			<GoalCelebrationFrame>
				<span>ring</span>
			</GoalCelebrationFrame>,
		)
		expect(container.firstElementChild?.children).toHaveLength(1)
		expect(container.querySelector('[aria-hidden="true"]')).toBeNull()
	})

	it('in StrictMode an existing pending goal is celebrated once through the frame', () => {
		act(() => {
			useGoalCelebrationStore.getState().setPending(TODAY)
		})
		render(
			<StrictMode>
				<GoalCelebrationFrame celebration={{ userId: USER, today: TODAY }}>
					<span>ring</span>
				</GoalCelebrationFrame>
			</StrictMode>,
		)
		advance(RING_FILL_MS * 2)

		expect(playSound).toHaveBeenCalledTimes(1)
		expect(burst).toHaveBeenCalledTimes(1)
	})

	it('passes particleDistance to the burst when the goal is celebrated', () => {
		render(
			<GoalCelebrationFrame
				celebration={{ userId: USER, today: TODAY }}
				particleDistance={COMPACT_GOAL_DISTANCE}
			>
				<span>ring</span>
			</GoalCelebrationFrame>,
		)
		setPending()
		advance(RING_FILL_MS)

		expect(burst).toHaveBeenCalledTimes(1)
		expect(burst).toHaveBeenCalledWith(expect.any(HTMLElement), expect.any(HTMLElement), {
			...CELEBRATE.goal,
			distance: COMPACT_GOAL_DISTANCE,
		})
	})
})
