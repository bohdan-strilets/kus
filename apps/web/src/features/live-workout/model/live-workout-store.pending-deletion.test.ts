// @vitest-environment jsdom
import { renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { LIVE_EDITED_AT, makeLiveInput, makeLiveResponse } from '@/shared/testing'

import {
	LIVE_WORKOUT_STORAGE_KEY,
	useHasOfflineLive,
	useLiveWorkoutStore,
} from './live-workout-store'

const OWNER_A = '0199b3a4-0000-7000-8000-00000000000a'
const OWNER_B = '0199b3a4-0000-7000-8000-00000000000b'
const WORKOUT_ID = '0199b3a4-0000-7000-8000-000000000001'

const snapshot = () => ({
	exercises: [makeLiveInput({ name: 'Присідання' })],
	knownEditedAt: LIVE_EDITED_AT,
})

const live = () => makeLiveResponse({ templateName: 'Верх А' })

const writeStorage = (version: number, state: unknown): void => {
	localStorage.setItem(LIVE_WORKOUT_STORAGE_KEY, JSON.stringify({ version, state }))
}

const reset = (): void => {
	useLiveWorkoutStore.setState({
		ownerId: null,
		pendingDeletion: false,
		snapshots: {},
		lastSeen: null,
	})
	localStorage.clear()
}

beforeEach(reset)
afterEach(reset)

describe('useLiveWorkoutStore: pendingDeletion', () => {
	it('is set and cleared for a known owner', () => {
		useLiveWorkoutStore.getState().claim(OWNER_A)

		useLiveWorkoutStore.getState().setPendingDeletion(true)
		expect(useLiveWorkoutStore.getState().pendingDeletion).toBe(true)

		useLiveWorkoutStore.getState().setPendingDeletion(false)
		expect(useLiveWorkoutStore.getState().pendingDeletion).toBe(false)
	})

	it('is ignored without an owner', () => {
		useLiveWorkoutStore.getState().setPendingDeletion(true)

		expect(useLiveWorkoutStore.getState().pendingDeletion).toBe(false)
		expect(localStorage.getItem(LIVE_WORKOUT_STORAGE_KEY) ?? '').not.toContain(
			'"pendingDeletion":true',
		)
	})

	it('survives the same owner claiming again', () => {
		useLiveWorkoutStore.getState().claim(OWNER_A)
		useLiveWorkoutStore.getState().setPendingDeletion(true)

		useLiveWorkoutStore.getState().claim(OWNER_A)

		expect(useLiveWorkoutStore.getState().pendingDeletion).toBe(true)
	})

	it('is reset by another owner and by a logout', () => {
		useLiveWorkoutStore.getState().claim(OWNER_A)
		useLiveWorkoutStore.getState().setPendingDeletion(true)
		useLiveWorkoutStore.getState().claim(OWNER_B)
		expect(useLiveWorkoutStore.getState().pendingDeletion).toBe(false)

		useLiveWorkoutStore.getState().setPendingDeletion(true)
		useLiveWorkoutStore.getState().claim(null)
		expect(useLiveWorkoutStore.getState().pendingDeletion).toBe(false)
	})

	it('is persisted next to the owner', () => {
		useLiveWorkoutStore.getState().claim(OWNER_A)
		useLiveWorkoutStore.getState().setPendingDeletion(true)

		const stored = JSON.parse(localStorage.getItem(LIVE_WORKOUT_STORAGE_KEY) ?? '{}') as {
			state?: { pendingDeletion?: unknown }
		}

		expect(stored.state?.pendingDeletion).toBe(true)
	})
})

describe('useHasOfflineLive', () => {
	it('is true with an owner and a copy, false without either', () => {
		expect(renderHook(() => useHasOfflineLive()).result.current).toBe(false)

		useLiveWorkoutStore.setState({ ownerId: OWNER_A })
		expect(renderHook(() => useHasOfflineLive()).result.current).toBe(false)

		useLiveWorkoutStore.setState({ lastSeen: live() })
		expect(renderHook(() => useHasOfflineLive()).result.current).toBe(true)

		useLiveWorkoutStore.setState({ ownerId: null })
		expect(renderHook(() => useHasOfflineLive()).result.current).toBe(false)
	})

	it('is false when the account awaits deletion', () => {
		useLiveWorkoutStore.setState({ ownerId: OWNER_A, lastSeen: live(), pendingDeletion: true })

		expect(renderHook(() => useHasOfflineLive()).result.current).toBe(false)
	})
})

describe('useLiveWorkoutStore: reading the storage (v4)', () => {
	it('restores an explicit true of the same stored owner', async () => {
		writeStorage(4, { ownerId: OWNER_A, pendingDeletion: true, snapshots: {}, lastSeen: live() })

		await useLiveWorkoutStore.persist.rehydrate()

		expect(useLiveWorkoutStore.getState()).toMatchObject({
			ownerId: OWNER_A,
			pendingDeletion: true,
		})
	})

	it.each([
		['missing', undefined],
		['false', false],
		['the string "true"', 'true'],
		['1', 1],
		['null', null],
	])('does not take a pendingDeletion that is %s', async (_name, value) => {
		writeStorage(4, { ownerId: OWNER_A, pendingDeletion: value, snapshots: {}, lastSeen: live() })

		await useLiveWorkoutStore.persist.rehydrate()

		expect(useLiveWorkoutStore.getState().pendingDeletion).toBe(false)
		expect(useLiveWorkoutStore.getState().ownerId).toBe(OWNER_A)
	})

	it('does not take true stored without a valid owner', async () => {
		writeStorage(4, { ownerId: null, pendingDeletion: true, snapshots: {} })
		await useLiveWorkoutStore.persist.rehydrate()
		expect(useLiveWorkoutStore.getState().pendingDeletion).toBe(false)

		writeStorage(4, { ownerId: 'not-a-uuid', pendingDeletion: true, snapshots: {} })
		await useLiveWorkoutStore.persist.rehydrate()
		expect(useLiveWorkoutStore.getState().pendingDeletion).toBe(false)
	})

	it('does not take true of another owner than the one already in charge', async () => {
		useLiveWorkoutStore.getState().claim(OWNER_B)
		writeStorage(4, { ownerId: OWNER_A, pendingDeletion: true, snapshots: {}, lastSeen: live() })

		await useLiveWorkoutStore.persist.rehydrate()

		expect(useLiveWorkoutStore.getState()).toMatchObject({
			ownerId: OWNER_B,
			pendingDeletion: false,
			lastSeen: null,
		})
	})
})

describe('useLiveWorkoutStore: migration to v4', () => {
	it('v3 keeps the owner, the snapshots and lastSeen, and is not pending', async () => {
		writeStorage(3, {
			ownerId: OWNER_A,
			pendingDeletion: true,
			snapshots: { [WORKOUT_ID]: snapshot() },
			lastSeen: live(),
		})

		await useLiveWorkoutStore.persist.rehydrate()

		const state = useLiveWorkoutStore.getState()
		expect(state.ownerId).toBe(OWNER_A)
		expect(state.snapshots[WORKOUT_ID]).toEqual(snapshot())
		expect(state.lastSeen).toEqual(live())
		expect(state.pendingDeletion).toBe(false)
	})

	it('v2 keeps the owner and the snapshots, lastSeen is empty', async () => {
		writeStorage(2, { ownerId: OWNER_A, snapshots: { [WORKOUT_ID]: snapshot() }, lastSeen: live() })

		await useLiveWorkoutStore.persist.rehydrate()

		const state = useLiveWorkoutStore.getState()
		expect(state.ownerId).toBe(OWNER_A)
		expect(state.snapshots[WORKOUT_ID]).toEqual(snapshot())
		expect(state.lastSeen).toBeNull()
		expect(state.pendingDeletion).toBe(false)
	})

	it('an older version is dropped completely', async () => {
		writeStorage(1, {
			ownerId: OWNER_A,
			pendingDeletion: true,
			snapshots: { [WORKOUT_ID]: snapshot() },
			lastSeen: live(),
		})

		await useLiveWorkoutStore.persist.rehydrate()

		expect(useLiveWorkoutStore.getState()).toMatchObject({
			ownerId: null,
			pendingDeletion: false,
			snapshots: {},
			lastSeen: null,
		})
	})

	it('a broken v3 does not throw and leaves nothing to resume', async () => {
		writeStorage(3, 'garbage')

		await expect(useLiveWorkoutStore.persist.rehydrate()).resolves.not.toThrow()

		expect(useLiveWorkoutStore.getState()).toMatchObject({
			ownerId: null,
			pendingDeletion: false,
			snapshots: {},
			lastSeen: null,
		})
	})
})
