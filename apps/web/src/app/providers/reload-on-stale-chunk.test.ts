import { describe, expect, it } from 'vitest'

import { shouldReloadForStaleChunk } from './reload-on-stale-chunk'

const NOW = 1_800_000_000_000

describe('shouldReloadForStaleChunk', () => {
	it('reloads on the first missing chunk', () => {
		expect(shouldReloadForStaleChunk(null, NOW)).toBe(true)
	})

	it('does not loop when the chunk is still missing right after the reload', () => {
		expect(shouldReloadForStaleChunk(NOW - 2_000, NOW)).toBe(false)
	})

	it('reloads again for the next deploy, long after the last reload', () => {
		expect(shouldReloadForStaleChunk(NOW - 60_000, NOW)).toBe(true)
	})
})
