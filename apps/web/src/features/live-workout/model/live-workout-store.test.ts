// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'

import { LIVE_EDITED_AT, makeLiveInput } from '@/shared/testing'

import {
	LIVE_WORKOUT_STORAGE_KEY,
	restoreOwnerId,
	restoreSnapshots,
	SNAPSHOTS_MAX,
	useLiveWorkoutStore,
} from './live-workout-store'

const id = (n: number): string => `0199b3a4-0000-7000-8000-${String(n).padStart(12, '0')}`
const snapshot = (name = 'А') => ({
	exercises: [makeLiveInput({ name })],
	knownEditedAt: LIVE_EDITED_AT,
})

afterEach(() => {
	useLiveWorkoutStore.setState({ snapshots: {} })
	localStorage.clear()
})

describe('restoreSnapshots', () => {
	it('keeps a valid snapshot', () => {
		const valid = snapshot()

		expect(restoreSnapshots({ snapshots: { [id(1)]: valid } })).toEqual({ [id(1)]: valid })
	})

	it('drops what does not parse and keeps the rest', () => {
		const restored = restoreSnapshots({
			snapshots: {
				[id(1)]: snapshot(),
				[id(2)]: { exercises: 'broken', knownEditedAt: null },
				[id(3)]: { exercises: [], knownEditedAt: 'yesterday' },
			},
		})

		expect(Object.keys(restored)).toEqual([id(1)])
	})

	it('survives garbage in the storage', () => {
		expect(restoreSnapshots(null)).toEqual({})
		expect(restoreSnapshots('text')).toEqual({})
		expect(restoreSnapshots({ snapshots: 5 })).toEqual({})
		expect(restoreSnapshots({ snapshots: { 'not-a-uuid': snapshot() } })).toEqual({})
	})

	it('drops a snapshot that would break the PUT rules (bodyweight with a weight)', () => {
		const bad = {
			exercises: [
				makeLiveInput({
					isBodyweight: true,
					sets: [
						{
							reps: 5,
							weightKg: 20,
							durationSec: null,
							distanceM: null,
							isWarmup: false,
							doneAt: null,
						},
					],
				}),
			],
			knownEditedAt: null,
		}

		expect(restoreSnapshots({ snapshots: { [id(1)]: bad } })).toEqual({})
	})
})

describe('useLiveWorkoutStore', () => {
	it('saves and clears a snapshot by workout id', () => {
		const { saveSnapshot, clearSnapshot } = useLiveWorkoutStore.getState()

		saveSnapshot(id(1), snapshot('А'))
		saveSnapshot(id(2), snapshot('Б'))
		clearSnapshot(id(1))

		expect(Object.keys(useLiveWorkoutStore.getState().snapshots)).toEqual([id(2)])
	})

	it('clearing an unknown id does nothing', () => {
		useLiveWorkoutStore.getState().saveSnapshot(id(1), snapshot())

		useLiveWorkoutStore.getState().clearSnapshot(id(9))

		expect(Object.keys(useLiveWorkoutStore.getState().snapshots)).toEqual([id(1)])
	})

	it('overwrites the snapshot of the same session with the newest', () => {
		const { saveSnapshot } = useLiveWorkoutStore.getState()

		saveSnapshot(id(1), snapshot('старий'))
		saveSnapshot(id(1), snapshot('новий'))

		expect(useLiveWorkoutStore.getState().snapshots[id(1)]?.exercises[0]?.name).toBe('новий')
	})

	it('keeps at most SNAPSHOTS_MAX, the oldest go first', () => {
		const { saveSnapshot } = useLiveWorkoutStore.getState()
		for (let n = 1; n <= SNAPSHOTS_MAX + 2; n += 1) saveSnapshot(id(n), snapshot())

		const keys = Object.keys(useLiveWorkoutStore.getState().snapshots)

		expect(keys).toHaveLength(SNAPSHOTS_MAX)
		expect(keys).not.toContain(id(1))
		expect(keys).toContain(id(SNAPSHOTS_MAX + 2))
	})

	it('a rewritten session counts as the newest, so it is not the next to go', () => {
		const { saveSnapshot } = useLiveWorkoutStore.getState()
		for (let n = 1; n <= SNAPSHOTS_MAX; n += 1) saveSnapshot(id(n), snapshot())

		saveSnapshot(id(1), snapshot('ще раз'))
		saveSnapshot(id(99), snapshot())

		const keys = Object.keys(useLiveWorkoutStore.getState().snapshots)
		expect(keys).toContain(id(1))
		expect(keys).not.toContain(id(2))
	})

	it('writes to localStorage under its key', () => {
		useLiveWorkoutStore.getState().saveSnapshot(id(1), snapshot())

		const raw = localStorage.getItem(LIVE_WORKOUT_STORAGE_KEY)

		expect(raw).not.toBeNull()
		const stored = JSON.parse(raw ?? '{}') as { state?: { snapshots?: unknown } }
		expect(stored.state?.snapshots).toHaveProperty(id(1))
	})
})

const OWNER_A = '0199b3a4-0000-7000-8000-00000000000a'
const OWNER_B = '0199b3a4-0000-7000-8000-00000000000b'

describe('useLiveWorkoutStore: owner', () => {
	afterEach(() => {
		useLiveWorkoutStore.setState({ ownerId: null, snapshots: {} })
	})

	it('the first claim (nobody before) also starts clean, like the other stores', () => {
		useLiveWorkoutStore.setState({ ownerId: null, snapshots: { [id(1)]: snapshot() } })

		useLiveWorkoutStore.getState().claim(OWNER_A)

		expect(useLiveWorkoutStore.getState().ownerId).toBe(OWNER_A)
		expect(useLiveWorkoutStore.getState().snapshots).toEqual({})
	})

	it('claim by the same owner keeps the snapshots', () => {
		useLiveWorkoutStore.setState({ ownerId: OWNER_A, snapshots: { [id(1)]: snapshot() } })

		useLiveWorkoutStore.getState().claim(OWNER_A)

		expect(Object.keys(useLiveWorkoutStore.getState().snapshots)).toEqual([id(1)])
	})

	it('claim by another user clears the snapshots of the previous one', () => {
		useLiveWorkoutStore.setState({ ownerId: OWNER_A, snapshots: { [id(1)]: snapshot() } })

		useLiveWorkoutStore.getState().claim(OWNER_B)

		expect(useLiveWorkoutStore.getState()).toMatchObject({ ownerId: OWNER_B, snapshots: {} })
	})

	it('a logout (null) clears the snapshots too', () => {
		useLiveWorkoutStore.setState({ ownerId: OWNER_A, snapshots: { [id(1)]: snapshot() } })

		useLiveWorkoutStore.getState().claim(null)

		expect(useLiveWorkoutStore.getState()).toMatchObject({ ownerId: null, snapshots: {} })
	})

	it('persists the owner next to the snapshots, in storage version 3', () => {
		useLiveWorkoutStore.getState().claim(OWNER_A)
		useLiveWorkoutStore.getState().saveSnapshot(id(1), snapshot())

		const stored = JSON.parse(localStorage.getItem(LIVE_WORKOUT_STORAGE_KEY) ?? '{}') as {
			version?: number
			state?: { ownerId?: string; snapshots?: unknown }
		}

		expect(stored.version).toBe(3)
		expect(stored.state?.ownerId).toBe(OWNER_A)
		expect(stored.state?.snapshots).toHaveProperty(id(1))
	})

	it('restoreOwnerId reads the owner and treats garbage as nobody', () => {
		expect(restoreOwnerId({ ownerId: OWNER_A, snapshots: {} })).toBe(OWNER_A)
		expect(restoreOwnerId({ ownerId: 'not-a-uuid', snapshots: {} })).toBeNull()
		expect(restoreOwnerId({ snapshots: {} })).toBeNull()
		expect(restoreOwnerId('text')).toBeNull()
	})
})

describe('useLiveWorkoutStore: a full storage', () => {
	afterEach(() => {
		vi.restoreAllMocks()
	})

	it('saveSnapshot returns true when the write works', () => {
		expect(useLiveWorkoutStore.getState().saveSnapshot(id(1), snapshot())).toBe(true)
	})

	it('a refused write (quota) keeps the copy in memory and does not throw', () => {
		vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
			throw new DOMException('full', 'QuotaExceededError')
		})
		const saved = snapshot("у пам'яті")

		const result = useLiveWorkoutStore.getState().saveSnapshot(id(1), saved)

		expect(result).toBe(false)
		expect(useLiveWorkoutStore.getState().snapshots[id(1)]).toEqual(saved)
	})

	it('after the quota error the next write that works returns true again', () => {
		const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementationOnce(() => {
			throw new DOMException('full', 'QuotaExceededError')
		})

		expect(useLiveWorkoutStore.getState().saveSnapshot(id(1), snapshot())).toBe(false)
		expect(useLiveWorkoutStore.getState().saveSnapshot(id(1), snapshot('ще'))).toBe(true)
		spy.mockRestore()
	})
})
