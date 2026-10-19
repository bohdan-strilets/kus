// @vitest-environment jsdom
import { cleanup, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import { renderWithProviders } from '@/shared/testing'

import type { WeekDay } from './week-strip.types'
import { WeekStrip } from './WeekStrip'

const DAYS: WeekDay[] = [
	{ date: new Date(2026, 9, 18), status: 'normal' },
	{ date: new Date(2026, 9, 19), status: 'planned', isUpcoming: true },
	{ date: new Date(2026, 9, 20), status: 'empty', isUpcoming: true },
]

afterEach(cleanup)

describe('WeekStrip upcoming days', () => {
	it('names a planned day and an empty upcoming one without «без записів»', () => {
		renderWithProviders(
			<WeekStrip days={DAYS} selectedDate={new Date(2026, 9, 18)} onSelect={() => undefined} />,
		)

		expect(screen.getByRole('button', { name: /— заплановано$/ })).toBeTruthy()
		expect(screen.getByRole('button', { name: /— нічого не записано$/ })).toBeTruthy()
		expect(screen.queryByRole('button', { name: /без записів/ })).toBeNull()
	})

	it('the chosen empty day has no dot, the chosen planned one a ring', () => {
		const { container, rerender } = renderWithProviders(
			<WeekStrip days={DAYS} selectedDate={new Date(2026, 9, 20)} onSelect={() => undefined} />,
		)
		const getSelectedDot = (): Element | null =>
			container.querySelector('[aria-current="date"] span:last-child')

		expect(getSelectedDot()?.className).toContain('bg-transparent')
		expect(getSelectedDot()?.className).not.toContain('bg-white')

		rerender(
			<WeekStrip days={DAYS} selectedDate={new Date(2026, 9, 19)} onSelect={() => undefined} />,
		)
		expect(getSelectedDot()?.className).toContain('border-white')
	})
})
