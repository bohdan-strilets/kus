// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { createWrapper } from '@/shared/testing'

import type { LiveSyncStatus } from '../model/create-live-sync'
import { LiveNetStatus } from './LiveNetStatus'

const motionMock = vi.hoisted(() => ({ isReduced: false }))

vi.mock('motion/react', async (importOriginal) => ({
	...(await importOriginal<Record<string, unknown>>()),
	useReducedMotion: () => motionMock.isReduced,
}))

const renderStatus = (status: LiveSyncStatus, onRetry = vi.fn()) => {
	const view = render(<LiveNetStatus status={status} onRetry={onRetry} />, {
		wrapper: createWrapper(),
	})
	const rerender = (next: LiveSyncStatus) => {
		view.rerender(<LiveNetStatus status={next} onRetry={onRetry} />)
	}
	return { ...view, rerender, onRetry }
}

beforeEach(() => {
	motionMock.isReduced = false
})

afterEach(() => {
	cleanup()
	vi.useRealTimers()
})

describe('LiveNetStatus', () => {
	it.each<LiveSyncStatus>(['idle', 'saving'])('shows nothing visible for online %s', (status) => {
		renderStatus(status)

		const region = screen.getByRole('status')
		expect(region.getAttribute('aria-live')).toBe('polite')
		expect(region.textContent).toBe('')
		expect(screen.queryByRole('button')).toBeNull()
	})

	it('offline: the pill with a ring mark and the muted variant', () => {
		renderStatus('offline')

		const pill = screen.getByText('Без мережі — усе збережено на телефоні')
		expect(pill.className).toContain('text-muted-strong')
		expect(pill.className).not.toContain('bg-success-soft')
		expect(pill.querySelector('span[aria-hidden="true"]')).not.toBeNull()
		expect(screen.queryByRole('button')).toBeNull()
	})

	it('syncing: the pill with a loader', () => {
		vi.useFakeTimers()
		const { rerender } = renderStatus('idle')
		rerender('offline')
		rerender('saving')
		expect(screen.queryByText('Синхронізую…')).toBeNull()

		act(() => {
			vi.advanceTimersByTime(300)
		})

		const pill = screen.getByText('Синхронізую…')
		expect(pill.className).toContain('text-muted-strong')
		expect(pill.querySelector('[aria-label="Завантаження"], [role="img"], svg')).not.toBeNull()
		vi.useRealTimers()
	})

	it('syncing -> saved never shows two pills at once', async () => {
		vi.useFakeTimers()
		const { rerender } = renderStatus('idle')
		rerender('offline')
		rerender('saving')
		act(() => {
			vi.advanceTimersByTime(300)
		})
		expect(screen.getByText('Синхронізую…')).toBeTruthy()

		rerender('idle')
		const countPills = () => screen.queryAllByText(/Синхронізую…|Збережено/).length
		for (let i = 0; i < 20; i += 1) {
			expect(countPills()).toBeLessThanOrEqual(1)
			await act(async () => {
				await vi.advanceTimersByTimeAsync(25)
			})
		}
		expect(screen.getByText('Збережено')).toBeTruthy()
		vi.useRealTimers()
	})

	it('saved: the success pill with a check icon', async () => {
		const { rerender } = renderStatus('idle')
		rerender('offline')
		rerender('saving')
		rerender('idle')

		const pill = await screen.findByText('Збережено')
		expect(pill.className).toContain('bg-success-soft')
		expect(pill.className).toContain('text-success-ink')
		expect(pill.querySelector('svg')).not.toBeNull()
	})

	it('the status wrapper stays in the DOM for every phase', () => {
		const { rerender } = renderStatus('idle')
		const region = screen.getByRole('status')

		rerender('offline')
		expect(screen.getByRole('status')).toBe(region)
		rerender('saving')
		expect(screen.getByRole('status')).toBe(region)
		rerender('idle')
		expect(screen.getByRole('status')).toBe(region)
		rerender('error')
		expect(screen.getByRole('status')).toBe(region)
	})

	it('error: the text and [Повторити] calls onRetry, no pill', () => {
		const { onRetry } = renderStatus('error')

		expect(screen.getByText('Не вдалося зберегти підходи. Спробуй ще раз.')).toBeTruthy()
		expect(screen.queryByText(/Без мережі/)).toBeNull()

		fireEvent.click(screen.getByRole('button', { name: 'Повторити' }))

		expect(onRetry).toHaveBeenCalledTimes(1)
	})

	it('offline -> error swaps the pill for the error line', () => {
		const { rerender } = renderStatus('offline')
		rerender('error')

		expect(screen.getByRole('button', { name: 'Повторити' })).toBeTruthy()
		expect(screen.queryByText('Збережено')).toBeNull()
	})

	it('reduced motion still renders the pill', () => {
		motionMock.isReduced = true
		renderStatus('offline')

		expect(screen.getByText('Без мережі — усе збережено на телефоні')).toBeTruthy()
	})
})
