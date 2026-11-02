// @vitest-environment jsdom
import { cleanup, fireEvent, screen } from '@testing-library/react'
import type * as MotionModule from 'motion/react'
import type { PanInfo } from 'motion/react'
import type { ComponentProps, ReactElement } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { renderWithProviders } from '@/shared/testing'

import type { WeekDay } from './food-week-strip.types'
import { FoodWeekStrip } from './FoodWeekStrip'

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

const TODAY = new Date(2026, 9, 20)
const DAYS: WeekDay[] = [
	{ date: new Date(2026, 9, 18), status: 'normal' },
	{ date: new Date(2026, 9, 19), status: 'over' },
	{ date: new Date(2026, 9, 20), status: 'empty' },
	{ date: new Date(2026, 9, 21), status: 'empty', isUpcoming: true },
]

const swipe = (x: number): void => {
	const { panEnd } = motionMock
	if (!panEnd) throw new Error('the strip is not rendered')
	panEnd(new PointerEvent('pointerup'), { offset: { x, y: 0 } } as PanInfo)
}

const renderStrip = (selectedDate: Date, canGoNext = true) => {
	const onSelect = vi.fn()
	const onSwipePrev = vi.fn()
	const onSwipeNext = vi.fn()
	const view = renderWithProviders(
		<FoodWeekStrip
			days={DAYS}
			selectedDate={selectedDate}
			today={TODAY}
			onSelect={onSelect}
			onSwipePrev={onSwipePrev}
			onSwipeNext={onSwipeNext}
			canGoNext={canGoNext}
		/>,
	)
	return { ...view, onSelect, onSwipePrev, onSwipeNext }
}

const getDot = (button: HTMLElement): Element | null =>
	button.querySelector('span > span[aria-hidden]')

beforeEach(() => {
	motionMock.panEnd = null
})

afterEach(cleanup)

describe('FoodWeekStrip', () => {
	it('shows success for a day in the norm and over for a day above the goal', () => {
		renderStrip(TODAY)
		const buttons = screen.getAllByRole('button')

		expect(getDot(buttons[0] as HTMLElement)?.className).toContain('bg-success')
		expect(getDot(buttons[1] as HTMLElement)?.className).toContain('bg-over')
		expect(getDot(buttons[2] as HTMLElement)?.className).toContain('bg-transparent')
	})

	it('turns the dot of the chosen day white', () => {
		renderStrip(new Date(2026, 9, 19))
		const buttons = screen.getAllByRole('button')

		expect(getDot(buttons[1] as HTMLElement)?.className).toContain('bg-white')
		expect(getDot(buttons[1] as HTMLElement)?.className).not.toContain('bg-over')
		expect(getDot(buttons[0] as HTMLElement)?.className).toContain('bg-success')
	})

	it('says the state of a day in its label', () => {
		renderStrip(TODAY)

		expect(screen.getByRole('button', { name: /, у нормі$/ })).toBeTruthy()
		expect(screen.getByRole('button', { name: /, понад ціль$/ })).toBeTruthy()
	})

	it('marks today by aria-current while the pill follows the chosen day', () => {
		renderStrip(new Date(2026, 9, 18))
		const buttons = screen.getAllByRole('button')

		expect(buttons[2]?.getAttribute('aria-current')).toBe('date')
		expect(buttons[0]?.hasAttribute('aria-current')).toBe(false)
		expect(buttons[0]?.className).toContain('bg-ink')
		expect(buttons[2]?.className).not.toContain('bg-ink')
	})

	it('passes the tapped date to onSelect, upcoming days included', () => {
		const { onSelect } = renderStrip(TODAY)

		fireEvent.click(screen.getAllByRole('button')[1] as HTMLElement)
		fireEvent.click(screen.getAllByRole('button')[3] as HTMLElement)

		expect(onSelect).toHaveBeenNthCalledWith(1, DAYS[1]?.date)
		expect(onSelect).toHaveBeenNthCalledWith(2, DAYS[3]?.date)
	})

	it('never disables a day', () => {
		renderStrip(TODAY)

		for (const button of screen.getAllByRole('button')) {
			expect(button.hasAttribute('aria-disabled')).toBe(false)
		}
	})

	it('turns the week by a swipe, and blocks the forward swipe at the edge', () => {
		const first = renderStrip(TODAY)
		swipe(80)
		swipe(-80)
		expect(first.onSwipePrev).toHaveBeenCalledTimes(1)
		expect(first.onSwipeNext).toHaveBeenCalledTimes(1)
		cleanup()

		const blocked = renderStrip(TODAY, false)
		swipe(-80)
		expect(blocked.onSwipeNext).not.toHaveBeenCalled()
	})
})
