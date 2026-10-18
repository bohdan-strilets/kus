// @vitest-environment jsdom
import { act, cleanup } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { renderHookWithProviders } from '@/shared/testing'

import { useGreeting } from './use-greeting'

const WARSAW = 'Europe/Warsaw'
const NO_NAME = { name: null, addressAs: null }
/** 03:59:30 in Warsaw (UTC+2): still the night, «Добрий вечір». */
const BEFORE_MORNING = '2026-10-12T01:59:30.000Z'
/** 04:10 in Warsaw. */
const MORNING = '2026-10-12T02:10:00.000Z'
const HALF_MINUTE_MS = 30_000

beforeEach(() => {
	vi.useFakeTimers()
	vi.setSystemTime(new Date(BEFORE_MORNING))
})

afterEach(() => {
	cleanup()
	vi.useRealTimers()
})

describe('useGreeting', () => {
	it('greets by the local hour', () => {
		const { result } = renderHookWithProviders(() =>
			useGreeting({ addressee: NO_NAME, timeZone: WARSAW }),
		)

		expect(result.current).toBe('Добрий вечір')
	})

	it('adds the name', () => {
		const { result } = renderHookWithProviders(() =>
			useGreeting({ addressee: { name: null, addressAs: 'Бо' }, timeZone: WARSAW }),
		)

		expect(result.current).toBe('Добрий вечір, Бо')
	})

	it('changes the text when the hour changes, without a remount', () => {
		const { result } = renderHookWithProviders(() =>
			useGreeting({ addressee: NO_NAME, timeZone: WARSAW }),
		)
		expect(result.current).toBe('Добрий вечір')

		act(() => {
			vi.advanceTimersByTime(HALF_MINUTE_MS)
		})

		expect(result.current).toBe('Доброго ранку')
	})

	it('changes the text on pageshow after the clock jumped over the boundary', () => {
		const { result } = renderHookWithProviders(() =>
			useGreeting({ addressee: NO_NAME, timeZone: WARSAW }),
		)

		vi.setSystemTime(new Date(MORNING))
		act(() => {
			window.dispatchEvent(new Event('pageshow'))
		})

		expect(result.current).toBe('Доброго ранку')
	})
})
