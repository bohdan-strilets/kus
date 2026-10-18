// @vitest-environment jsdom
import { act, cleanup } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { useLocalToday } from '@/entities/day'
import { renderHookWithProviders } from '@/shared/testing'

import { type DayNavigation, useDayNavigation } from './use-day-navigation'

const WARSAW = 'Europe/Warsaw'
const YESTERDAY = '2026-10-12'
const TODAY_AFTER_MIDNIGHT = '2026-10-13'
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
	it('starts on today with no next week before midnight', () => {
		const { result } = renderNavigation()

		expect(result.current.selected).toBe(YESTERDAY)
		expect(result.current.windowEnd).toBe(YESTERDAY)
		expect(result.current.showNextWeek).toBeNull()
	})

	it('follows the new day on the clock tick when no date is in the URL', () => {
		const { result } = renderNavigation()

		act(() => {
			vi.advanceTimersByTime(HALF_MINUTE_MS)
		})

		expect(result.current.selected).toBe(TODAY_AFTER_MIDNIGHT)
		expect(result.current.windowEnd).toBe(TODAY_AFTER_MIDNIGHT)
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
			expect(result.current.windowEnd).toBe(TODAY_AFTER_MIDNIGHT)
			expect(result.current.showNextWeek).toBeNull()
		},
	)

	it('keeps an explicitly chosen past day after midnight and offers the next week', () => {
		const { result } = renderNavigation(`/?date=${YESTERDAY}`)
		expect(result.current.selected).toBe(YESTERDAY)
		expect(result.current.showNextWeek).toBeNull()

		act(() => {
			vi.advanceTimersByTime(HALF_MINUTE_MS)
		})

		expect(result.current.selected).toBe(YESTERDAY)
		expect(result.current.windowEnd).toBe(YESTERDAY)
		expect(result.current.showNextWeek).not.toBeNull()
	})

	it('moves the strip to the new today when the next week is shown after midnight', () => {
		const { result } = renderNavigation(`/?date=${YESTERDAY}`)
		act(() => {
			vi.advanceTimersByTime(HALF_MINUTE_MS)
		})

		act(() => {
			result.current.showNextWeek?.()
		})

		expect(result.current.windowEnd).toBe(TODAY_AFTER_MIDNIGHT)
		expect(result.current.selected).toBe(TODAY_AFTER_MIDNIGHT)
		expect(result.current.showNextWeek).toBeNull()
	})
})
