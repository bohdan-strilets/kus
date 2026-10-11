// @vitest-environment jsdom
import { cleanup, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { unlockSound } from './sounds'
import { useUnlockSoundOnFirstTap } from './use-unlock-sound-on-first-tap'

vi.mock('./sounds', () => ({ unlockSound: vi.fn() }))

const tap = (): void => {
	document.body.dispatchEvent(new MouseEvent('click', { bubbles: true }))
}

afterEach(() => {
	cleanup()
	vi.clearAllMocks()
})

describe('useUnlockSoundOnFirstTap', () => {
	it('unlocks the audio on the first tap only', () => {
		renderHook(() => {
			useUnlockSoundOnFirstTap()
		})

		tap()
		tap()

		expect(unlockSound).toHaveBeenCalledTimes(1)
	})

	it('leaves no listener behind after unmount', () => {
		const { unmount } = renderHook(() => {
			useUnlockSoundOnFirstTap()
		})
		unmount()

		tap()

		expect(unlockSound).not.toHaveBeenCalled()
	})
})
