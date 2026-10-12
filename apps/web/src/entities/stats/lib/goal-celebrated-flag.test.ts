import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
	clearGoalCelebratedFlags,
	hasCelebratedGoal,
	markGoalCelebrated,
} from './goal-celebrated-flag'

const USER_A = '0199b3a4-0000-7000-8000-00000000000a'
const USER_B = '0199b3a4-0000-7000-8000-00000000000b'
const DAY_1 = '2026-10-11'
const DAY_2 = '2026-10-12'

const createMemoryStorage = (): Storage => {
	const items = new Map<string, string>()
	return {
		get length() {
			return items.size
		},
		clear: () => {
			items.clear()
		},
		getItem: (key) => items.get(key) ?? null,
		key: (index) => [...items.keys()][index] ?? null,
		removeItem: (key) => {
			items.delete(key)
		},
		setItem: (key, value) => {
			items.set(key, value)
		},
	}
}

describe('goal-celebrated-flag', () => {
	let storage: Storage

	beforeEach(() => {
		storage = createMemoryStorage()
		vi.stubGlobal('localStorage', storage)
	})

	afterEach(() => {
		vi.unstubAllGlobals()
	})

	it('stores a bare flag under kusik-goal-celebrated:<userId>:<localDate>', () => {
		markGoalCelebrated(USER_A, DAY_1)

		expect(storage.getItem(`kusik-goal-celebrated:${USER_A}:${DAY_1}`)).not.toBeNull()
		expect(storage.length).toBe(1)
	})

	it('knows a marked day, not another date or another user', () => {
		expect(hasCelebratedGoal(USER_A, DAY_1)).toBe(false)

		markGoalCelebrated(USER_A, DAY_1)

		expect(hasCelebratedGoal(USER_A, DAY_1)).toBe(true)
		expect(hasCelebratedGoal(USER_A, DAY_2)).toBe(false)
		expect(hasCelebratedGoal(USER_B, DAY_1)).toBe(false)
	})

	it('drops the same user flags of older dates on a new mark, keeps other users and foreign keys', () => {
		markGoalCelebrated(USER_A, DAY_1)
		markGoalCelebrated(USER_B, DAY_1)
		storage.setItem('kusik-sound-settings', '{}')

		markGoalCelebrated(USER_A, DAY_2)

		expect(hasCelebratedGoal(USER_A, DAY_1)).toBe(false)
		expect(hasCelebratedGoal(USER_A, DAY_2)).toBe(true)
		expect(hasCelebratedGoal(USER_B, DAY_1)).toBe(true)
		expect(storage.getItem('kusik-sound-settings')).toBe('{}')
	})

	it('sweeps every stale key, not every other one', () => {
		storage.setItem(`kusik-goal-celebrated:${USER_A}:2026-10-09`, '1')
		storage.setItem(`kusik-goal-celebrated:${USER_A}:2026-10-10`, '1')
		storage.setItem(`kusik-goal-celebrated:${USER_A}:${DAY_1}`, '1')

		markGoalCelebrated(USER_A, DAY_2)

		expect(storage.length).toBe(1)
		expect(hasCelebratedGoal(USER_A, DAY_2)).toBe(true)
	})

	it('clears only the given user flags', () => {
		markGoalCelebrated(USER_A, DAY_1)
		markGoalCelebrated(USER_B, DAY_1)

		clearGoalCelebratedFlags(USER_A)

		expect(hasCelebratedGoal(USER_A, DAY_1)).toBe(false)
		expect(hasCelebratedGoal(USER_B, DAY_1)).toBe(true)
	})

	it('does not throw and reports nothing when the storage throws', () => {
		const fail = (): never => {
			throw new Error('storage unavailable')
		}
		vi.stubGlobal('localStorage', {
			length: 1,
			key: fail,
			getItem: fail,
			setItem: fail,
			removeItem: fail,
		})

		expect(hasCelebratedGoal(USER_A, DAY_1)).toBe(false)
		expect(() => {
			markGoalCelebrated(USER_A, DAY_1)
		}).not.toThrow()
		expect(() => {
			clearGoalCelebratedFlags(USER_A)
		}).not.toThrow()
	})
})
