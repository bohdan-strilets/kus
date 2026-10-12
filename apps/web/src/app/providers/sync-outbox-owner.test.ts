import { QueryClient } from '@tanstack/react-query'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { useFreshReplyStore } from '@/entities/message'
import { SESSION_QUERY_KEY } from '@/entities/session'
import { hasCelebratedGoal, markGoalCelebrated, useGoalCelebrationStore } from '@/entities/stats'
import { useComposerDraftStore, useOutboxStore } from '@/features/send-message'

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

const TODAY = '2026-10-12'

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

describe('syncOutboxOwner', () => {
	beforeEach(() => {
		vi.stubGlobal('localStorage', createMemoryStorage())
		useOutboxStore.setState({ ownerId: null, items: {} })
		useComposerDraftStore.setState({ ownerId: null, text: '' })
		useFreshReplyStore.setState({ ownerId: null, freshAt: {} })
		useGoalCelebrationStore.setState({
			ownerId: null,
			armed: null,
			pending: null,
			celebratedReplyId: null,
		})
	})

	afterEach(() => {
		vi.unstubAllGlobals()
	})

	it('resets the goal celebration and clears the previous user flags for another user, keeps them for the same one', () => {
		const queryClient = new QueryClient()
		const stop = syncOutboxOwner(queryClient)
		queryClient.setQueryData(SESSION_QUERY_KEY, USER_A)
		markGoalCelebrated(USER_A.id, TODAY)
		useGoalCelebrationStore.getState().arm('m1')
		useGoalCelebrationStore.setState({ celebratedReplyId: 'm1' })

		queryClient.setQueryData(SESSION_QUERY_KEY, { ...USER_A })
		expect(useGoalCelebrationStore.getState()).toMatchObject({
			ownerId: USER_A.id,
			celebratedReplyId: 'm1',
		})
		expect(hasCelebratedGoal(USER_A.id, TODAY)).toBe(true)

		queryClient.setQueryData(SESSION_QUERY_KEY, USER_B)
		expect(useGoalCelebrationStore.getState()).toMatchObject({
			ownerId: USER_B.id,
			armed: null,
			pending: null,
			celebratedReplyId: null,
		})
		expect(hasCelebratedGoal(USER_A.id, TODAY)).toBe(false)
		stop()
	})

	it('clears the goal flags after logout', () => {
		const queryClient = new QueryClient()
		const stop = syncOutboxOwner(queryClient)
		queryClient.setQueryData(SESSION_QUERY_KEY, USER_A)
		markGoalCelebrated(USER_A.id, TODAY)

		queryClient.setQueryData(SESSION_QUERY_KEY, null)

		expect(useGoalCelebrationStore.getState().ownerId).toBeNull()
		expect(hasCelebratedGoal(USER_A.id, TODAY)).toBe(false)
		stop()
	})

	it('drops the fresh-reply marks for another user and after logout, keeps them for the same one', () => {
		const queryClient = new QueryClient()
		const stop = syncOutboxOwner(queryClient)
		queryClient.setQueryData(SESSION_QUERY_KEY, USER_A)
		useFreshReplyStore.setState({ freshAt: { m1: 1 } })

		queryClient.setQueryData(SESSION_QUERY_KEY, { ...USER_A })
		expect(useFreshReplyStore.getState().freshAt).toEqual({ m1: 1 })

		queryClient.setQueryData(SESSION_QUERY_KEY, USER_B)
		expect(useFreshReplyStore.getState()).toMatchObject({ ownerId: USER_B.id, freshAt: {} })

		useFreshReplyStore.setState({ freshAt: { m2: 1 } })
		queryClient.setQueryData(SESSION_QUERY_KEY, null)
		expect(useFreshReplyStore.getState()).toMatchObject({ ownerId: null, freshAt: {} })
		stop()
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

	it('drops the composer text for another user and after logout, like the drafts', () => {
		const queryClient = new QueryClient()
		const stop = syncOutboxOwner(queryClient)
		queryClient.setQueryData(SESSION_QUERY_KEY, USER_A)
		useComposerDraftStore.getState().setText('тарілка борщу і')

		queryClient.setQueryData(SESSION_QUERY_KEY, { ...USER_A })
		expect(useComposerDraftStore.getState().text).toBe('тарілка борщу і')

		queryClient.setQueryData(SESSION_QUERY_KEY, USER_B)
		expect(useComposerDraftStore.getState()).toMatchObject({ ownerId: USER_B.id, text: '' })

		useComposerDraftStore.getState().setText('банан')
		queryClient.setQueryData(SESSION_QUERY_KEY, null)
		expect(useComposerDraftStore.getState()).toMatchObject({ ownerId: null, text: '' })
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
