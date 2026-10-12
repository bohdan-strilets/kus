// @vitest-environment jsdom
import { cleanup, renderHook } from '@testing-library/react'
import { useReducedMotion } from 'motion/react'
import { StrictMode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { HOP_KEYFRAMES, HOP_TRANSITION } from '@/shared/lib'

import { useHopOnMoodChange } from './use-hop-on-mood-change'

vi.mock('motion', () => ({ animate: vi.fn() }))
vi.mock('motion/react', async (importOriginal) => ({
	...(await importOriginal<Record<string, unknown>>()),
	useReducedMotion: vi.fn(),
}))

const { animate } = await import('motion')

const createRef = (): { current: SVGSVGElement } => ({
	current: document.createElementNS('http://www.w3.org/2000/svg', 'svg'),
})

beforeEach(() => {
	vi.mocked(useReducedMotion).mockReturnValue(false)
})

afterEach(() => {
	cleanup()
	vi.clearAllMocks()
})

describe('useHopOnMoodChange', () => {
	it('does not hop on mount, also in StrictMode', () => {
		renderHook(
			() => {
				useHopOnMoodChange(createRef(), 'happy')
			},
			{ wrapper: StrictMode },
		)
		expect(animate).not.toHaveBeenCalled()
	})

	it('hops exactly once when the mood changes', () => {
		const ref = createRef()
		const { rerender } = renderHook(
			({ mood }) => {
				useHopOnMoodChange(ref, mood)
			},
			{
				initialProps: { mood: 'happy' },
			},
		)
		rerender({ mood: 'sad' })
		expect(animate).toHaveBeenCalledTimes(1)
		expect(animate).toHaveBeenCalledWith(ref.current, HOP_KEYFRAMES, HOP_TRANSITION)
	})

	it('does not hop on a re-render with the same mood', () => {
		const ref = createRef()
		const { rerender } = renderHook(
			({ mood }) => {
				useHopOnMoodChange(ref, mood)
			},
			{
				initialProps: { mood: 'happy' },
			},
		)
		rerender({ mood: 'happy' })
		rerender({ mood: 'happy' })
		expect(animate).not.toHaveBeenCalled()
	})

	it('skips the hop under reduced motion and does not replay it after the toggle', () => {
		vi.mocked(useReducedMotion).mockReturnValue(true)
		const ref = createRef()
		const { rerender } = renderHook(
			({ mood }) => {
				useHopOnMoodChange(ref, mood)
			},
			{
				initialProps: { mood: 'happy' },
			},
		)
		rerender({ mood: 'sad' })
		expect(animate).not.toHaveBeenCalled()

		vi.mocked(useReducedMotion).mockReturnValue(false)
		rerender({ mood: 'sad' })
		expect(animate).not.toHaveBeenCalled()
	})
})
