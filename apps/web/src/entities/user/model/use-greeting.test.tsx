// @vitest-environment jsdom
import { act, cleanup } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { i18n } from '@/shared/i18n'
import { renderHookWithProviders } from '@/shared/testing'

import { useGreeting } from './use-greeting'

const WARSAW = 'Europe/Warsaw'
const NO_NAME = { name: null, addressAs: null }
const EVENING_TEXT = 'Добрий вечір'
const MORNING_TEXT = 'Доброго ранку'
/** 19:00 in Warsaw (UTC+2): the evening. */
const EVENING = '2026-10-12T17:00:00.000Z'
/** 02:00 in Warsaw: deep night. */
const DEEP_NIGHT = '2026-10-12T00:00:00.000Z'
/** 23:00 in Warsaw: the night starts. */
const NIGHT_START = '2026-10-12T21:00:00.000Z'
/** 04:59:30 in Warsaw: still the night, half a minute before the morning. */
const BEFORE_MORNING = '2026-10-12T02:59:30.000Z'
/** 05:10 in Warsaw. */
const MORNING = '2026-10-12T03:10:00.000Z'
const HALF_MINUTE_MS = 30_000

const renderGreeting = (): { current: string } =>
	renderHookWithProviders(() => useGreeting({ addressee: NO_NAME, timeZone: WARSAW })).result

beforeEach(() => {
	vi.useFakeTimers()
	vi.setSystemTime(new Date(EVENING))
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

		expect(result.current).toBe(EVENING_TEXT)
	})

	it('adds the name', () => {
		const { result } = renderHookWithProviders(() =>
			useGreeting({ addressee: { name: null, addressAs: 'Бо' }, timeZone: WARSAW }),
		)

		expect(result.current).toBe('Добрий вечір, Бо')
	})

	it('has a night greeting in uk.json', () => {
		expect(i18n.exists('chat.greeting.night')).toBe(true)
	})

	it.each([
		['02:00', DEEP_NIGHT],
		['23:00', NIGHT_START],
		['04:59:30', BEFORE_MORNING],
	])('greets with the night text at %s local time, not evening or morning', (_label, iso) => {
		vi.setSystemTime(new Date(iso))

		const text = renderGreeting().current

		expect(text).toBe(i18n.t('chat.greeting.night'))
		expect(text).not.toBe(EVENING_TEXT)
		expect(text).not.toBe(MORNING_TEXT)
		expect(text).not.toBe('chat.greeting.night')
	})

	it('changes the text when the hour changes, without a remount', () => {
		vi.setSystemTime(new Date(BEFORE_MORNING))
		const result = renderGreeting()
		expect(result.current).toBe(i18n.t('chat.greeting.night'))

		act(() => {
			vi.advanceTimersByTime(HALF_MINUTE_MS)
		})

		expect(result.current).toBe(MORNING_TEXT)
	})

	it('changes the text on pageshow after the clock jumped over the boundary', () => {
		const { result } = renderHookWithProviders(() =>
			useGreeting({ addressee: NO_NAME, timeZone: WARSAW }),
		)

		vi.setSystemTime(new Date(MORNING))
		act(() => {
			window.dispatchEvent(new Event('pageshow'))
		})

		expect(result.current).toBe(MORNING_TEXT)
	})
})
