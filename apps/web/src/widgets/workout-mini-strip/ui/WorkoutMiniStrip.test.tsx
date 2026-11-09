// @vitest-environment jsdom
import { act, cleanup, fireEvent, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { TRAINING_LIVE_ROUTE } from '@/shared/config'
import { makeLiveResponse, renderWithProviders } from '@/shared/testing'

import { WorkoutMiniStrip } from './WorkoutMiniStrip'

beforeEach(() => {
	vi.useFakeTimers({ toFake: ['Date', 'setInterval', 'clearInterval'] })
	vi.setSystemTime(new Date('2026-11-02T09:23:14.000Z'))
})

afterEach(() => {
	cleanup()
	vi.useRealTimers()
})

describe('WorkoutMiniStrip', () => {
	it('is one link to the live screen with the name, the timer and a spoken label', () => {
		renderWithProviders(<WorkoutMiniStrip live={makeLiveResponse({ templateName: 'Верх А' })} />)

		const link = screen.getByRole('link', { name: 'Іде тренування: Верх А · 23:14. Відкрити' })

		expect(link.getAttribute('href')).toBe(TRAINING_LIVE_ROUTE)
		expect(link.textContent).toContain('Верх А · 23:14')
	})

	it('truncates the name and keeps the time apart, with the full name in the title', () => {
		const name = 'Груди, плечі й трицепс — важкий день'
		renderWithProviders(<WorkoutMiniStrip live={makeLiveResponse({ templateName: name })} />)

		const nameEl = screen.getByText(name)

		expect(nameEl.className).toContain('truncate')
		expect(nameEl.parentElement?.getAttribute('title')).toBe(name)
		expect(screen.getByText('· 23:14').className).toContain('shrink-0')
		expect(screen.getByRole('link').getAttribute('aria-label')).toContain(name)
	})

	it('falls back to the default name for a session without a template', () => {
		renderWithProviders(<WorkoutMiniStrip live={makeLiveResponse()} />)

		expect(
			screen.getByRole('link', { name: 'Іде тренування: Тренування · 23:14. Відкрити' }),
		).toBeTruthy()
	})

	it('ticks every second', () => {
		renderWithProviders(<WorkoutMiniStrip live={makeLiveResponse({ templateName: 'Верх А' })} />)

		act(() => {
			vi.advanceTimersByTime(46_000)
		})

		const link = screen.getByRole('link')
		expect(link.textContent).toContain('Верх А · 24:00')
		expect(link.getAttribute('aria-label')).toBe('Іде тренування: Верх А · 24:00. Відкрити')
	})

	it('shows 00:00 for a session the chat started without a time', () => {
		const live = makeLiveResponse()
		renderWithProviders(
			<WorkoutMiniStrip live={{ ...live, workout: { ...live.workout, startedAt: null } }} />,
		)

		expect(screen.getByRole('link').textContent).toContain('Тренування · 00:00')
	})
})

describe('WorkoutMiniStrip: the live screen unfolds from it', () => {
	it('carries data-mini-strip, so the surface finds its rectangle', () => {
		renderWithProviders(<WorkoutMiniStrip live={makeLiveResponse()} />)

		expect(screen.getByRole('link').hasAttribute('data-mini-strip')).toBe(true)
	})

	it('warms the live screen up when the finger comes down', () => {
		const onWarm = vi.fn()
		renderWithProviders(<WorkoutMiniStrip live={makeLiveResponse()} onWarm={onWarm} />)

		fireEvent.pointerDown(screen.getByRole('link'))

		expect(onWarm).toHaveBeenCalledTimes(1)
	})

	it('works without onWarm: pointerdown does not throw', () => {
		renderWithProviders(<WorkoutMiniStrip live={makeLiveResponse()} />)

		expect(() => fireEvent.pointerDown(screen.getByRole('link'))).not.toThrow()
	})
})

describe('WorkoutMiniStrip: offline', () => {
	it('online: a green dot and the normal spoken label', () => {
		renderWithProviders(<WorkoutMiniStrip live={makeLiveResponse({ templateName: 'Верх А' })} />)

		const link = screen.getByRole('link')

		expect(link.querySelector('.bg-success')).toBeTruthy()
		expect(link.getAttribute('aria-label')).toBe('Іде тренування: Верх А · 23:14. Відкрити')
	})

	it('offline: an empty ring instead of the dot and «без мережі» in the label', () => {
		renderWithProviders(
			<WorkoutMiniStrip live={makeLiveResponse({ templateName: 'Верх А' })} isOffline />,
		)

		const link = screen.getByRole('link')

		expect(link.querySelector('.bg-success')).toBeNull()
		expect(link.querySelector('.border-2')).toBeTruthy()
		// the wording of mockups/training-offline.html
		expect(link.getAttribute('aria-label')).toBe(
			'Іде тренування: Верх А · 23:14, без мережі. Відкрити',
		)
	})

	it('offline: still a link to the live screen that warms up on pointerdown', () => {
		const onWarm = vi.fn()
		renderWithProviders(<WorkoutMiniStrip live={makeLiveResponse()} isOffline onWarm={onWarm} />)

		const link = screen.getByRole('link')
		fireEvent.pointerDown(link)

		expect(link.getAttribute('href')).toBe(TRAINING_LIVE_ROUTE)
		expect(onWarm).toHaveBeenCalledTimes(1)
	})
})
