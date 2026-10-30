// @vitest-environment jsdom
// Focus return on a touch screen (coarse pointer): no keyboard-less field, no ring on a container.
// motion.div is a plain div (jsdom runs no animation frames); Radix's unmount autofocus is awaited.
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import { type ReactNode, type Ref } from 'react'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'

import { COARSE_POINTER_QUERY } from '@/shared/lib'

import { BaseBottomSheet } from './BaseBottomSheet'

interface MotionDivProps {
	children?: ReactNode
	className?: string
	ref?: Ref<HTMLDivElement>
}

vi.mock('motion/react', async (importOriginal) => {
	const actual = await importOriginal<Record<string, unknown>>()
	const MotionDiv = ({ children, className, ref, ...rest }: MotionDivProps) => {
		const domProps = Object.fromEntries(
			Object.entries(rest).filter(
				([key]) =>
					key.startsWith('aria-') ||
					key === 'role' ||
					key === 'id' ||
					key === 'tabIndex' ||
					key.startsWith('data-') ||
					(key.startsWith('on') && !key.includes('Drag')),
			),
		)
		return (
			<div ref={ref} className={className} {...domProps}>
				{children}
			</div>
		)
	}
	const actualMotion = actual.motion as Record<string, unknown>
	const motion = new Proxy(actualMotion, {
		get: (target, key: string) => (key === 'div' ? MotionDiv : target[key]),
	})
	return { ...actual, motion }
})

beforeAll(() => {
	window.matchMedia = (query: string): MediaQueryList => ({
		matches: query === COARSE_POINTER_QUERY,
		media: query,
		onchange: null,
		addEventListener: () => undefined,
		removeEventListener: () => undefined,
		addListener: () => undefined,
		removeListener: () => undefined,
		dispatchEvent: () => false,
	})
})

afterEach(() => {
	cleanup()
	vi.restoreAllMocks()
})

const Screen = ({ isOpen }: { isOpen: boolean }) => (
	<>
		<textarea aria-label="composer" />
		<div role="tabpanel" tabIndex={0} aria-label="products">
			list
		</div>
		<button type="button">row</button>
		<BaseBottomSheet isOpen={isOpen} onOpenChange={() => undefined} title="Sheet">
			<p>body</p>
		</BaseBottomSheet>
	</>
)

/** Focus what a tap would have focused, open the sheet, close it, and wait for Radix to settle. */
const openAndCloseFrom = async (
	pick: () => HTMLElement,
	onBeforeClose?: (element: HTMLElement) => void,
) => {
	const view = render(<Screen isOpen={false} />)
	const element = pick()
	element.focus()
	view.rerender(<Screen isOpen />)
	await screen.findByRole('dialog')
	onBeforeClose?.(element)
	view.rerender(<Screen isOpen={false} />)
	await waitFor(() => {
		expect(screen.queryByRole('dialog')).toBeNull()
	})
	return element
}

describe('BaseBottomSheet focus return on touch', () => {
	it('does not put the focus back into a text field (no keyboard-less focus)', async () => {
		const field = await openAndCloseFrom(() => screen.getByRole('textbox', { name: 'composer' }))

		await waitFor(() => {
			expect(document.activeElement).not.toBe(field)
		})
	})

	it('does not focus a container that only took the tap (no ring around the list)', async () => {
		const panel = await openAndCloseFrom(() => screen.getByRole('tabpanel', { name: 'products' }))

		await waitFor(() => {
			expect(document.activeElement).not.toBe(panel)
		})
	})

	it('returns the focus to a control without the ring and without scrolling', async () => {
		const focus = vi.fn<(options?: FocusOptions) => void>()
		await openAndCloseFrom(
			() => screen.getByRole('button', { name: 'row' }),
			(row) => {
				row.focus = focus
			},
		)

		await waitFor(() => {
			expect(focus).toHaveBeenCalledWith({ preventScroll: true, focusVisible: false })
		})
	})
})
