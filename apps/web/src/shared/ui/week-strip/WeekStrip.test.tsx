// @vitest-environment jsdom
import { cleanup, createEvent, fireEvent, screen } from '@testing-library/react'
import type * as MotionModule from 'motion/react'
import type { PanInfo } from 'motion/react'
import type { ComponentProps, ReactElement } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { renderWithProviders } from '@/shared/testing'

import { WeekStrip } from './WeekStrip'
import type { WeekStripDay } from './week-strip.types'

type PanEnd = (event: PointerEvent, info: PanInfo) => void

const motionMock = vi.hoisted((): { panEnd: PanEnd | null } => ({ panEnd: null }))

// jsdom has no gesture recogniser: the pan end of the strip is driven by hand
vi.mock('motion/react', async (importOriginal) => {
	const original = await importOriginal<typeof MotionModule>()
	const Div = ({
		onPanEnd,
		...props
	}: ComponentProps<'div'> & { onPanEnd?: PanEnd }): ReactElement => {
		motionMock.panEnd = onPanEnd ?? null
		return <div {...props} />
	}
	const Button = ({
		whileTap: _whileTap,
		transition: _transition,
		...props
	}: ComponentProps<'button'> & { whileTap?: unknown; transition?: unknown }): ReactElement => (
		<button {...props} />
	)
	return { ...original, motion: { div: Div, button: Button } }
})

const makeDay = (day: number, overrides: Partial<WeekStripDay> = {}): WeekStripDay => ({
	date: new Date(2026, 9, day),
	isToday: false,
	isUpcoming: false,
	isSelected: false,
	isDisabled: false,
	ariaLabel: `день ${day}`,
	...overrides,
})

const DAYS: WeekStripDay[] = [
	makeDay(26, { isSelected: true, isToday: true }),
	makeDay(27, { isUpcoming: true }),
	makeDay(28, { isUpcoming: true, isDisabled: true }),
]

interface RenderProps {
	days?: WeekStripDay[]
	canGoNext?: boolean
}

const handlers = () => ({ onSelect: vi.fn(), onSwipePrev: vi.fn(), onSwipeNext: vi.fn() })

const renderStrip = ({ days = DAYS, canGoNext = true }: RenderProps = {}) => {
	const fns = handlers()
	renderWithProviders(
		<WeekStrip
			days={days}
			{...fns}
			canGoNext={canGoNext}
			renderIndicator={(day) => <i data-testid="indicator">{day.date.getDate()}</i>}
		/>,
	)
	return fns
}

const swipe = (x: number, y = 0): void => {
	const { panEnd } = motionMock
	if (!panEnd) throw new Error('the strip is not rendered')
	panEnd(new PointerEvent('pointerup'), { offset: { x, y } } as PanInfo)
}

beforeEach(() => {
	motionMock.panEnd = null
})

afterEach(cleanup)

describe('WeekStrip swipe', () => {
	it('goes to the previous week on a swipe to the right of 48 px', () => {
		const fns = renderStrip()

		swipe(48)

		expect(fns.onSwipePrev).toHaveBeenCalledTimes(1)
		expect(fns.onSwipeNext).not.toHaveBeenCalled()
	})

	it('goes to the next week on a swipe to the left of 48 px', () => {
		const fns = renderStrip()

		swipe(-48)

		expect(fns.onSwipeNext).toHaveBeenCalledTimes(1)
		expect(fns.onSwipePrev).not.toHaveBeenCalled()
	})

	it('does nothing for a swipe shorter than 48 px, either way', () => {
		const fns = renderStrip()

		swipe(47)
		swipe(-47)
		swipe(0)

		expect(fns.onSwipePrev).not.toHaveBeenCalled()
		expect(fns.onSwipeNext).not.toHaveBeenCalled()
	})

	it('does nothing for a mostly vertical drag', () => {
		const fns = renderStrip()

		swipe(60, 120)
		swipe(-60, -120)

		expect(fns.onSwipePrev).not.toHaveBeenCalled()
		expect(fns.onSwipeNext).not.toHaveBeenCalled()
	})

	it('blocks the forward swipe when the strip cannot go forward, the backward one still works', () => {
		const fns = renderStrip({ canGoNext: false })

		swipe(-200)
		expect(fns.onSwipeNext).not.toHaveBeenCalled()

		swipe(200)
		expect(fns.onSwipePrev).toHaveBeenCalledTimes(1)
	})
})

describe('WeekStrip days', () => {
	it('names the group and every day by its own label', () => {
		renderStrip()

		expect(screen.getByRole('group', { name: 'Тиждень' })).toBeTruthy()
		expect(
			screen.getAllByRole('button').map((button) => button.getAttribute('aria-label')),
		).toEqual(['день 26', 'день 27', 'день 28'])
	})

	it('marks only today with aria-current', () => {
		renderStrip()

		const current = screen.getAllByRole('button').filter((b) => b.hasAttribute('aria-current'))
		expect(current).toHaveLength(1)
		expect(current[0]?.getAttribute('aria-label')).toBe('день 26')
		expect(current[0]?.getAttribute('aria-current')).toBe('date')
	})

	it('selects an enabled day by a tap', () => {
		const fns = renderStrip()

		fireEvent.click(screen.getByRole('button', { name: 'день 27' }))

		expect(fns.onSelect).toHaveBeenCalledWith(DAYS[1])
	})

	it('marks a disabled day aria-disabled and does not select it', () => {
		const fns = renderStrip()
		const disabled = screen.getByRole('button', { name: 'день 28' })

		fireEvent.click(disabled)

		expect(disabled.getAttribute('aria-disabled')).toBe('true')
		expect(fns.onSelect).not.toHaveBeenCalled()
		expect(screen.getByRole('button', { name: 'день 27' }).hasAttribute('aria-disabled')).toBe(
			false,
		)
	})

	it('draws the indicator of the owner under every day', () => {
		renderStrip()

		expect(screen.getAllByTestId('indicator').map((node) => node.textContent)).toEqual([
			'26',
			'27',
			'28',
		])
	})

	it('keeps the tap target at the minimum height', () => {
		renderStrip()

		for (const button of screen.getAllByRole('button')) {
			expect(button.className).toContain('min-h-tap')
		}
	})

	it('puts the dark pill on the selected day and a thin ring on an upcoming one', () => {
		renderStrip()

		expect(screen.getByRole('button', { name: 'день 26' }).className).toContain('bg-ink')
		expect(screen.getByRole('button', { name: 'день 27' }).className).toContain('border-handle')
		expect(screen.getByRole('button', { name: 'день 26' }).className).not.toContain('border-handle')
	})

	// iOS/WebKit: preventDefault on pointerdown swallows the click of a touch tap
	it('does not cancel pointerdown on a day', () => {
		renderStrip()
		const day = screen.getByRole('button', { name: 'день 27' })
		const pointerDown = createEvent.pointerDown(day)

		fireEvent(day, pointerDown)

		expect(pointerDown.defaultPrevented).toBe(false)
	})
})
