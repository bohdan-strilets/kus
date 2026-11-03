// @vitest-environment jsdom
import { QueryClient } from '@tanstack/react-query'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { SESSION_QUERY_KEY } from '@/entities/session'
import { useLiveWorkoutStore } from '@/features/live-workout'
import { makeLiveInput } from '@/shared/testing'

import { syncOutboxOwner } from './sync-outbox-owner'

const USER_A = { id: '0199b3a4-0000-7000-8000-00000000000a', name: 'A' }
const USER_B = { id: '0199b3a4-0000-7000-8000-00000000000b', name: 'B' }
const WORKOUT = '0199b3a4-0000-7000-8000-0000000000f1'

describe('syncOutboxOwner and the unsent sets of a live workout', () => {
	beforeEach(() => {
		useLiveWorkoutStore.setState({ ownerId: null, snapshots: {} })
	})

	afterEach(() => {
		useLiveWorkoutStore.setState({ ownerId: null, snapshots: {} })
	})

	it('keeps the sets for the same user and drops them for another one or a logout', () => {
		const queryClient = new QueryClient()
		const stop = syncOutboxOwner(queryClient)
		queryClient.setQueryData(SESSION_QUERY_KEY, USER_A)
		useLiveWorkoutStore.getState().saveSnapshot(WORKOUT, {
			exercises: [makeLiveInput()],
			knownEditedAt: null,
		})

		queryClient.setQueryData(SESSION_QUERY_KEY, { ...USER_A })
		expect(Object.keys(useLiveWorkoutStore.getState().snapshots)).toEqual([WORKOUT])

		queryClient.setQueryData(SESSION_QUERY_KEY, USER_B)
		expect(useLiveWorkoutStore.getState()).toMatchObject({ ownerId: USER_B.id, snapshots: {} })

		useLiveWorkoutStore.getState().saveSnapshot(WORKOUT, {
			exercises: [makeLiveInput()],
			knownEditedAt: null,
		})
		queryClient.setQueryData(SESSION_QUERY_KEY, null)
		expect(useLiveWorkoutStore.getState()).toMatchObject({ ownerId: null, snapshots: {} })
		stop()
	})

	it('does nothing while the session is not known yet', () => {
		useLiveWorkoutStore.setState({ ownerId: USER_A.id, snapshots: {} })
		useLiveWorkoutStore.getState().saveSnapshot(WORKOUT, {
			exercises: [makeLiveInput()],
			knownEditedAt: null,
		})

		const stop = syncOutboxOwner(new QueryClient())

		expect(Object.keys(useLiveWorkoutStore.getState().snapshots)).toEqual([WORKOUT])
		stop()
	})
})
