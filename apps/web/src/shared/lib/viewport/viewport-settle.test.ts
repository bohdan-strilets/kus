import { describe, expect, it } from 'vitest'

import {
	advanceSettle,
	startSettle,
	VIEWPORT_SETTLE_MAX_MS,
	VIEWPORT_SETTLE_MIN_MS,
	VIEWPORT_SETTLE_STABLE_FRAMES,
} from './viewport-settle'

const FRAME_MS = 16

const run = (frames: Array<{ hasChanged: boolean }>, startFrom = 0) => {
	let progress = startSettle(startFrom)
	let doneAt: number | null = null
	frames.forEach((frame, index) => {
		if (doneAt !== null) return
		const now = startFrom + (index + 1) * FRAME_MS
		const step = advanceSettle(progress, { now, hasChanged: frame.hasChanged })
		progress = step.progress
		if (step.isDone) doneAt = now - startFrom
	})
	return doneAt
}

describe('advanceSettle', () => {
	it('is not done before the minimum time even when stable', () => {
		const doneAt = run(Array.from({ length: 40 }, () => ({ hasChanged: false })))
		expect(doneAt).not.toBeNull()
		expect(doneAt).toBeGreaterThanOrEqual(VIEWPORT_SETTLE_MIN_MS)
	})

	it('needs the stable frames in a row; a change resets the count', () => {
		const stable = Array.from({ length: VIEWPORT_SETTLE_STABLE_FRAMES - 1 }, () => ({
			hasChanged: false,
		}))
		const frames = [...stable, { hasChanged: true }, ...stable]
		// 7 + change + 7 frames: never 8 in a row inside the first 15 frames
		expect(run(frames)).toBeNull()
	})

	it('stops at the maximum even if the box keeps changing', () => {
		const doneAt = run(Array.from({ length: 200 }, () => ({ hasChanged: true })))
		expect(doneAt).not.toBeNull()
		expect(doneAt).toBeGreaterThanOrEqual(VIEWPORT_SETTLE_MAX_MS)
		expect(doneAt).toBeLessThan(VIEWPORT_SETTLE_MAX_MS + FRAME_MS)
	})
})
