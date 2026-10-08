import { QueryClient } from '@tanstack/react-query'
import { beforeEach, describe, expect, it } from 'vitest'

import { SESSION_QUERY_KEY } from '@/entities/session'
import { useOutboxStore } from '@/features/send-message'

import { syncOutboxOwner } from './sync-outbox-owner'

const USER_A = { id: '0199b3a4-0000-7000-8000-00000000000a', name: 'A' }
const USER_B = { id: '0199b3a4-0000-7000-8000-00000000000b', name: 'B' }

const failDraft = (): void => {
	const { markSending, markFailed } = useOutboxStore.getState()
	markSending({
		clientMessageId: '0199b3a4-0000-7000-8000-0000000000aa',
		text: 'тарілка супу',
		createdAt: '2026-10-08T10:00:00.000Z',
	})
	markFailed('0199b3a4-0000-7000-8000-0000000000aa', {
		messageKey: 'chat.networkError',
		canRetry: true,
	})
}

describe('syncOutboxOwner', () => {
	beforeEach(() => {
		useOutboxStore.setState({ ownerId: null, items: {} })
	})

	it('keeps the drafts of the same user and drops them for another one or after logout', () => {
		const queryClient = new QueryClient()
		const stop = syncOutboxOwner(queryClient)
		queryClient.setQueryData(SESSION_QUERY_KEY, USER_A)
		failDraft()

		queryClient.setQueryData(SESSION_QUERY_KEY, { ...USER_A })
		expect(Object.keys(useOutboxStore.getState().items)).toHaveLength(1)

		queryClient.setQueryData(SESSION_QUERY_KEY, USER_B)
		expect(useOutboxStore.getState()).toMatchObject({ ownerId: USER_B.id, items: {} })

		failDraft()
		queryClient.setQueryData(SESSION_QUERY_KEY, null)
		expect(useOutboxStore.getState()).toMatchObject({ ownerId: null, items: {} })
		stop()
	})

	it('waits while the session is unknown', () => {
		const queryClient = new QueryClient()
		useOutboxStore.setState({ ownerId: USER_A.id })
		failDraft()

		const stop = syncOutboxOwner(queryClient)

		expect(Object.keys(useOutboxStore.getState().items)).toHaveLength(1)
		stop()
	})
})
