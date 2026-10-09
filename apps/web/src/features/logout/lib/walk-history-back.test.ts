import { describe, expect, it, vi } from 'vitest'

import { type HistoryWalkEnv, walkHistoryBack } from './walk-history-back'

const createEnv = () => {
	let popListener: (() => void) | null = null
	let timer: (() => void) | null = null
	const env: HistoryWalkEnv = {
		go: vi.fn(),
		onPopState: (listener) => {
			popListener = listener
			return () => {
				popListener = null
			}
		},
		setTimer: (callback) => {
			timer = callback
			return () => {
				timer = null
			}
		},
	}
	return {
		env,
		popState: () => popListener?.(),
		fireTimer: () => timer?.(),
		isListening: () => popListener !== null || timer !== null,
	}
}

describe('walkHistoryBack', () => {
	it('goes back by the steps and arrives on popstate', () => {
		const fake = createEnv()
		const onArrive = vi.fn()

		walkHistoryBack({ steps: 3, onArrive, timeoutMs: 1000 }, fake.env)
		expect(fake.env.go).toHaveBeenCalledWith(-3)
		expect(onArrive).not.toHaveBeenCalled()

		fake.popState()
		expect(onArrive).toHaveBeenCalledTimes(1)
		expect(fake.isListening()).toBe(false)
	})

	it('arrives on the timer when no popstate comes, and only once', () => {
		const fake = createEnv()
		const onArrive = vi.fn()

		walkHistoryBack({ steps: 2, onArrive, timeoutMs: 1000 }, fake.env)
		fake.fireTimer()
		fake.popState()

		expect(onArrive).toHaveBeenCalledTimes(1)
		expect(fake.isListening()).toBe(false)
	})
})
