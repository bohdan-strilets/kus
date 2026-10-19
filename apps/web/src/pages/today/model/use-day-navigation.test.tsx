// @vitest-environment jsdom
import { act, cleanup } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { useLocalToday } from '@/entities/day'
import { renderHookWithProviders } from '@/shared/testing'

import { type DayNavigation, useDayNavigation } from './use-day-navigation'

const WARSAW = 'Europe/Warsaw'
const TODAY_BEFORE_MIDNIGHT = '2026-10-12'
const TOMORROW_BEFORE_MIDNIGHT = '2026-10-13'
const TODAY_AFTER_MIDNIGHT = '2026-10-13'
const TOMORROW_AFTER_MIDNIGHT = '2026-10-14'
/** 23:59:30 in Warsaw (UTC+2) on 12 October. */
const BEFORE_MIDNIGHT = '2026-10-12T21:59:30.000Z'
/** 00:10 in Warsaw on 13 October. */
const AFTER_MIDNIGHT = '2026-10-12T22:10:00.000Z'
const HALF_MINUTE_MS = 30_000

const useScreenNavigation = (): DayNavigation => useDayNavigation(useLocalToday(WARSAW))

const renderNavigation = (route = '/') => renderHookWithProviders(useScreenNavigation, { route })

beforeEach(() => {
	vi.useFakeTimers()
	vi.setSystemTime(new Date(BEFORE_MIDNIGHT))
})

afterEach(() => {
	cleanup()
	vi.useRealTimers()
})

describe('useDayNavigation across local midnight', () => {
	it('starts on today with the strip ending tomorrow and no next week', () => {
		const { result } = renderNavigation()

		expect(result.current.selected).toBe(TODAY_BEFORE_MIDNIGHT)
		expect(result.current.windowEnd).toBe(TOMORROW_BEFORE_MIDNIGHT)
		expect(result.current.showNextWeek).toBeNull()
	})

	it('follows the new day on the clock tick when no date is in the URL', () => {
		const { result } = renderNavigation()

		act(() => {
			vi.advanceTimersByTime(HALF_MINUTE_MS)
		})

		expect(result.current.selected).toBe(TODAY_AFTER_MIDNIGHT)
		expect(result.current.windowEnd).toBe(TOMORROW_AFTER_MIDNIGHT)
		expect(result.current.showNextWeek).toBeNull()
	})

	it.each(['pageshow', 'focus'])(
		'follows the new day on %s after the clock jumped over midnight without a tick',
		(eventType) => {
			const { result } = renderNavigation()

			vi.setSystemTime(new Date(AFTER_MIDNIGHT))
			act(() => {
				window.dispatchEvent(new Event(eventType))
			})

			expect(result.current.selected).toBe(TODAY_AFTER_MIDNIGHT)
			expect(result.current.windowEnd).toBe(TOMORROW_AFTER_MIDNIGHT)
			expect(result.current.showNextWeek).toBeNull()
		},
	)

	it('keeps an explicitly chosen day after midnight while the strip follows the clock', () => {
		const { result } = renderNavigation(`/?date=${TODAY_BEFORE_MIDNIGHT}`)
		expect(result.current.selected).toBe(TODAY_BEFORE_MIDNIGHT)
		expect(result.current.showNextWeek).toBeNull()

		act(() => {
			vi.advanceTimersByTime(HALF_MINUTE_MS)
		})

		expect(result.current.selected).toBe(TODAY_BEFORE_MIDNIGHT)
		expect(result.current.windowEnd).toBe(TOMORROW_AFTER_MIDNIGHT)
		expect(result.current.showNextWeek).toBeNull()
	})
})

describe('useDayNavigation ahead', () => {
	it('opens tomorrow and sends a day further ahead to today', () => {
		expect(renderNavigation('/?date=2026-10-13').result.current.selected).toBe('2026-10-13')
		expect(renderNavigation('/?date=2026-10-14').result.current.selected).toBe(
			TODAY_BEFORE_MIDNIGHT,
		)
	})

	it('shows the current week from the week before it and lands on today, not tomorrow', () => {
		const { result } = renderNavigation('/?date=2026-10-05')
		expect(result.current.windowEnd).toBe('2026-10-05')
		expect(result.current.showNextWeek).not.toBeNull()

		act(() => {
			result.current.showNextWeek?.()
		})

		expect(result.current.windowEnd).toBe(TOMORROW_BEFORE_MIDNIGHT)
		expect(result.current.selected).toBe(TODAY_BEFORE_MIDNIGHT)
		expect(result.current.showNextWeek).toBeNull()
	})
})
