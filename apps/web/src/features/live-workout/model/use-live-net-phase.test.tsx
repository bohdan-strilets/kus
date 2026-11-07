// @vitest-environment jsdom
import { act, cleanup, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { LiveSyncStatus } from './create-live-sync'
import { SAVED_VISIBLE_MS } from './live-net-phase.types'
import { useLiveNetPhase } from './use-live-net-phase'

const setup = (initial: LiveSyncStatus) => {
	const hook = renderHook(({ status }) => useLiveNetPhase(status), {
		initialProps: { status: initial },
	})
	const go = (status: LiveSyncStatus) => {
		hook.rerender({ status })
	}
	return { ...hook, go }
}

beforeEach(() => {
	vi.useFakeTimers()
})

afterEach(() => {
	cleanup()
	vi.useRealTimers()
})

describe('useLiveNetPhase', () => {
	it('is hidden while idle', () => {
		expect(setup('idle').result.current).toBe('hidden')
	})

	it('offline -> offline', () => {
		const { result, go } = setup('idle')
		go('offline')
		expect(result.current).toBe('offline')
	})

	it('starting offline shows offline right away', () => {
		expect(setup('offline').result.current).toBe('offline')
	})

	it('offline -> saving -> syncing only after 300 ms of saving', () => {
		const { result, go } = setup('idle')
		go('offline')
		go('saving')
		expect(result.current).toBe('offline')

		act(() => {
			vi.advanceTimersByTime(299)
		})
		expect(result.current).toBe('offline')

		act(() => {
			vi.advanceTimersByTime(1)
		})
		expect(result.current).toBe('syncing')
	})

	it('quick failed retries keep offline and never flash syncing', () => {
		const { result, go } = setup('idle')
		go('offline')
		for (let i = 0; i < 3; i += 1) {
			go('saving')
			expect(result.current).toBe('offline')
			act(() => {
				vi.advanceTimersByTime(65)
			})
			expect(result.current).toBe('offline')
			go('offline')
			expect(result.current).toBe('offline')
		}
	})

	it('a fast successful save after offline still shows saved', () => {
		const { result, go } = setup('idle')
		go('offline')
		go('saving')
		act(() => {
			vi.advanceTimersByTime(50)
		})
		go('idle')
		expect(result.current).toBe('saved')
	})

	it('offline -> saving -> idle -> saved, hidden after exactly 2 s', () => {
		const { result, go } = setup('idle')
		go('offline')
		go('saving')
		go('idle')
		expect(result.current).toBe('saved')

		act(() => {
			vi.advanceTimersByTime(SAVED_VISIBLE_MS - 1)
		})
		expect(result.current).toBe('saved')

		act(() => {
			vi.advanceTimersByTime(1)
		})
		expect(result.current).toBe('hidden')
	})

	it('SAVED_VISIBLE_MS is 2 s', () => {
		expect(SAVED_VISIBLE_MS).toBe(2000)
	})

	it('a normal online saving/idle stays hidden', () => {
		const { result, go } = setup('idle')
		go('saving')
		expect(result.current).toBe('hidden')
		go('idle')
		expect(result.current).toBe('hidden')
		act(() => {
			vi.advanceTimersByTime(SAVED_VISIBLE_MS * 2)
		})
		expect(result.current).toBe('hidden')
	})

	it('offline -> error clears everything and saved does not appear afterwards', () => {
		const { result, go } = setup('idle')
		go('offline')
		go('error')
		expect(result.current).toBe('hidden')
		go('idle')
		expect(result.current).toBe('hidden')
		go('saving')
		expect(result.current).toBe('hidden')
	})

	it('saved -> saving hides it', () => {
		const { result, go } = setup('idle')
		go('offline')
		go('saving')
		go('idle')
		expect(result.current).toBe('saved')
		go('saving')
		expect(result.current).toBe('hidden')
		act(() => {
			vi.advanceTimersByTime(SAVED_VISIBLE_MS)
		})
		expect(result.current).toBe('hidden')
	})

	it('retry loop offline -> saving -> offline -> saving stays consistent', () => {
		const { result, go } = setup('idle')
		go('offline')
		go('saving')
		act(() => {
			vi.advanceTimersByTime(300)
		})
		expect(result.current).toBe('syncing')
		go('offline')
		expect(result.current).toBe('offline')
		go('saving')
		expect(result.current).toBe('offline')
		act(() => {
			vi.advanceTimersByTime(300)
		})
		expect(result.current).toBe('syncing')
		go('idle')
		expect(result.current).toBe('saved')
	})

	it('a new offline spell during saved cancels the old timer', () => {
		const { result, go } = setup('idle')
		go('offline')
		go('saving')
		go('idle')
		act(() => {
			vi.advanceTimersByTime(SAVED_VISIBLE_MS - 500)
		})
		go('offline')
		expect(result.current).toBe('offline')
		act(() => {
			vi.advanceTimersByTime(1000)
		})
		expect(result.current).toBe('offline')
	})

	it('clears the timer on unmount', () => {
		const { go, unmount } = setup('idle')
		go('offline')
		go('saving')
		go('idle')
		expect(vi.getTimerCount()).toBe(1)

		unmount()

		expect(vi.getTimerCount()).toBe(0)
	})
})
