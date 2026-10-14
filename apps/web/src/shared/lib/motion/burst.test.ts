// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { stubMatchMedia } from '@/shared/testing'

import { burst } from './burst'
import { CELEBRATE } from './celebrate'

vi.mock('motion', () => ({ animate: vi.fn(() => Promise.resolve()) }))

const { animate } = await import('motion')

const MS_IN_SECOND = 1000
const NEAR_MAX_RANDOM = 0.999

beforeEach(() => {
	stubMatchMedia()
	vi.spyOn(Math, 'random').mockReturnValue(NEAR_MAX_RANDOM)
})

afterEach(() => {
	vi.restoreAllMocks()
	vi.clearAllMocks()
})

describe('burst', () => {
	it.each(Object.entries(CELEBRATE))(
		'never lets a %s particle outlast the level duration',
		(_level, config) => {
			const host = document.createElement('div')
			const origin = document.createElement('div')
			host.appendChild(origin)

			burst(host, origin, config)

			expect(animate).toHaveBeenCalledTimes(config.count)
			for (const [, , options] of vi.mocked(animate).mock.calls) {
				expect((options as { duration: number }).duration).toBeLessThanOrEqual(
					config.durationMs / MS_IN_SECOND,
				)
			}
		},
	)
})
