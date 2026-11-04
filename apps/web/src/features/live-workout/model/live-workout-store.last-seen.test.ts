// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { LIVE_EDITED_AT, makeLiveInput, makeLiveResponse } from '@/shared/testing'

import { LIVE_WORKOUT_STORAGE_KEY, useLiveWorkoutStore } from './live-workout-store'

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
	useLiveWorkoutStore.setState({ ownerId: null, snapshots: {}, lastSeen: null })
	localStorage.clear()
}

beforeEach(reset)
afterEach(reset)

describe('useLiveWorkoutStore: lastSeen', () => {
	it('setLastSeen keeps the answer for a known owner', () => {
		useLiveWorkoutStore.getState().claim(OWNER_A)

		useLiveWorkoutStore.getState().setLastSeen(live())

		expect(useLiveWorkoutStore.getState().lastSeen).toEqual(live())
	})

	it("setLastSeen without an owner is ignored: nobody's copy is never kept", () => {
		useLiveWorkoutStore.getState().setLastSeen(live())

		expect(useLiveWorkoutStore.getState().lastSeen).toBeNull()
		expect(localStorage.getItem(LIVE_WORKOUT_STORAGE_KEY) ?? '').not.toContain('Верх А')
	})

	it('claim by another user drops lastSeen and the snapshots', () => {
		useLiveWorkoutStore.getState().claim(OWNER_A)
		useLiveWorkoutStore.getState().setLastSeen(live())
		useLiveWorkoutStore.getState().saveSnapshot(WORKOUT_ID, snapshot())

		useLiveWorkoutStore.getState().claim(OWNER_B)

		expect(useLiveWorkoutStore.getState()).toMatchObject({
			ownerId: OWNER_B,
			snapshots: {},
			lastSeen: null,
		})
		expect(localStorage.getItem(LIVE_WORKOUT_STORAGE_KEY) ?? '').not.toContain('Верх А')
	})

	it('a logout (claim null) drops lastSeen and the snapshots', () => {
		useLiveWorkoutStore.getState().claim(OWNER_A)
		useLiveWorkoutStore.getState().setLastSeen(live())
		useLiveWorkoutStore.getState().saveSnapshot(WORKOUT_ID, snapshot())

		useLiveWorkoutStore.getState().claim(null)

		expect(useLiveWorkoutStore.getState()).toMatchObject({
			ownerId: null,
			snapshots: {},
			lastSeen: null,
		})
		expect(localStorage.getItem(LIVE_WORKOUT_STORAGE_KEY) ?? '').not.toContain('Верх А')
	})

	it('the same owner claiming again keeps lastSeen', () => {
		useLiveWorkoutStore.getState().claim(OWNER_A)
		useLiveWorkoutStore.getState().setLastSeen(live())

		useLiveWorkoutStore.getState().claim(OWNER_A)

		expect(useLiveWorkoutStore.getState().lastSeen).not.toBeNull()
	})

	it('clearLastSeen empties it and keeps the owner and the snapshots', () => {
		useLiveWorkoutStore.getState().claim(OWNER_A)
		useLiveWorkoutStore.getState().setLastSeen(live())
		useLiveWorkoutStore.getState().saveSnapshot(WORKOUT_ID, snapshot())

		useLiveWorkoutStore.getState().clearLastSeen()

		expect(useLiveWorkoutStore.getState().lastSeen).toBeNull()
		expect(useLiveWorkoutStore.getState().ownerId).toBe(OWNER_A)
		expect(Object.keys(useLiveWorkoutStore.getState().snapshots)).toEqual([WORKOUT_ID])
	})

	it('persists lastSeen next to the owner', () => {
		useLiveWorkoutStore.getState().claim(OWNER_A)
		useLiveWorkoutStore.getState().setLastSeen(live())

		const stored = JSON.parse(localStorage.getItem(LIVE_WORKOUT_STORAGE_KEY) ?? '{}') as {
			state?: { ownerId?: string; lastSeen?: unknown }
		}

		expect(stored.state?.ownerId).toBe(OWNER_A)
		expect(stored.state?.lastSeen).toEqual(live())
	})
})

describe('useLiveWorkoutStore: reading the storage', () => {
	it('v3 restores lastSeen of the stored owner', async () => {
		writeStorage(3, { ownerId: OWNER_A, snapshots: {}, lastSeen: live() })

		await useLiveWorkoutStore.persist.rehydrate()

		expect(useLiveWorkoutStore.getState()).toMatchObject({ ownerId: OWNER_A, lastSeen: live() })
	})

	it('v2 is migrated: owner and snapshots stay, lastSeen is empty', async () => {
		writeStorage(2, { ownerId: OWNER_A, snapshots: { [WORKOUT_ID]: snapshot() } })

		await useLiveWorkoutStore.persist.rehydrate()

		const state = useLiveWorkoutStore.getState()
		expect(state.ownerId).toBe(OWNER_A)
		expect(state.snapshots[WORKOUT_ID]).toEqual(snapshot())
		expect(state.lastSeen).toBeNull()
	})

	it('v2 with a lastSeen smuggled in does not use it', async () => {
		writeStorage(2, { ownerId: OWNER_A, snapshots: {}, lastSeen: live() })

		await useLiveWorkoutStore.persist.rehydrate()

		expect(useLiveWorkoutStore.getState().lastSeen).toBeNull()
	})

	it('an older version is reset completely', async () => {
		writeStorage(1, { ownerId: OWNER_A, snapshots: { [WORKOUT_ID]: snapshot() }, lastSeen: live() })

		await useLiveWorkoutStore.persist.rehydrate()

		expect(useLiveWorkoutStore.getState()).toMatchObject({
			ownerId: null,
			snapshots: {},
			lastSeen: null,
		})
	})

	it('a lastSeen that does not parse becomes null without throwing, the rest is kept', async () => {
		writeStorage(3, {
			ownerId: OWNER_A,
			snapshots: { [WORKOUT_ID]: snapshot() },
			lastSeen: { workout: 'broken', plan: 5 },
		})

		await useLiveWorkoutStore.persist.rehydrate()

		const state = useLiveWorkoutStore.getState()
		expect(state.lastSeen).toBeNull()
		expect(state.ownerId).toBe(OWNER_A)
		expect(Object.keys(state.snapshots)).toEqual([WORKOUT_ID])
	})

	it('a lastSeen stored without a valid owner is never taken', async () => {
		writeStorage(3, { ownerId: null, snapshots: {}, lastSeen: live() })
		await useLiveWorkoutStore.persist.rehydrate()
		expect(useLiveWorkoutStore.getState().lastSeen).toBeNull()

		writeStorage(3, { ownerId: 'not-a-uuid', snapshots: {}, lastSeen: live() })
		await useLiveWorkoutStore.persist.rehydrate()
		expect(useLiveWorkoutStore.getState().lastSeen).toBeNull()
	})

	it('a lastSeen of another owner than the one already in charge is never taken', async () => {
		useLiveWorkoutStore.getState().claim(OWNER_B)
		writeStorage(3, { ownerId: OWNER_A, snapshots: {}, lastSeen: live() })

		await useLiveWorkoutStore.persist.rehydrate()

		expect(useLiveWorkoutStore.getState().ownerId).toBe(OWNER_B)
		expect(useLiveWorkoutStore.getState().lastSeen).toBeNull()
	})

	it('garbage in the storage does not throw', async () => {
		localStorage.setItem(LIVE_WORKOUT_STORAGE_KEY, '{not json')

		await expect(useLiveWorkoutStore.persist.rehydrate()).resolves.not.toThrow()
		expect(useLiveWorkoutStore.getState().lastSeen).toBeNull()
	})
})
