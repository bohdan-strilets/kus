// @vitest-environment jsdom
import { act, cleanup, screen } from '@testing-library/react'
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

		const link = screen.getByRole('link', { name: 'Верх А іде, 23 хв. Відкрити' })

		expect(link.getAttribute('href')).toBe(TRAINING_LIVE_ROUTE)
		expect(link.textContent).toContain('Верх А · 23:14')
	})

	it('falls back to the default name for a session without a template', () => {
		renderWithProviders(<WorkoutMiniStrip live={makeLiveResponse()} />)

		expect(screen.getByRole('link', { name: 'Тренування іде, 23 хв. Відкрити' })).toBeTruthy()
	})

	it('ticks every second', () => {
		renderWithProviders(<WorkoutMiniStrip live={makeLiveResponse({ templateName: 'Верх А' })} />)

		act(() => {
			vi.advanceTimersByTime(46_000)
		})

		const link = screen.getByRole('link')
		expect(link.textContent).toContain('Верх А · 24:00')
		expect(link.getAttribute('aria-label')).toBe('Верх А іде, 24 хв. Відкрити')
	})

	it('shows 00:00 for a session the chat started without a time', () => {
		const live = makeLiveResponse()
		renderWithProviders(
			<WorkoutMiniStrip live={{ ...live, workout: { ...live.workout, startedAt: null } }} />,
		)

		expect(screen.getByRole('link').textContent).toContain('Тренування · 00:00')
	})
})
