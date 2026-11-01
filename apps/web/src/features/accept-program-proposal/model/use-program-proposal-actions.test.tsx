// @vitest-environment jsdom
import { QueryClient } from '@tanstack/react-query'
import { act, cleanup, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { MESSAGES_QUERY_KEY, type MessagesPage } from '@/entities/message'
import { activeProgramQueryOptions } from '@/entities/program'
import { httpClient } from '@/shared/api'
import {
	apiErrorBody,
	createFakeAdapter,
	type FakeHandler,
	makeChatMessage,
	makeProgram,
	renderHookWithProviders,
} from '@/shared/testing'

import { useProgramProposalActions } from './use-program-proposal-actions'

const MESSAGE_ID = '0199b3a4-0000-7000-8000-000000000011'
const NEW_MESSAGE_ID = '0199b3a4-0000-7000-8000-000000000012'
const originalAdapter = httpClient.defaults.adapter

afterEach(() => {
	cleanup()
	httpClient.defaults.adapter = originalAdapter
	vi.restoreAllMocks()
})

const setup = (handler: FakeHandler, feed?: MessagesPage) => {
	const fake = createFakeAdapter(handler)
	httpClient.defaults.adapter = fake.adapter
	const queryClient = new QueryClient()
	if (feed) queryClient.setQueryData(MESSAGES_QUERY_KEY, { pages: [feed], pageParams: [null] })
	const invalidate = vi.spyOn(queryClient, 'invalidateQueries')
	const hook = renderHookWithProviders(() => useProgramProposalActions(), { queryClient })
	const invalidatedKeys = () => invalidate.mock.calls.map(([filters]) => filters?.queryKey)
	return { ...hook, queryClient, invalidatedKeys, calls: fake.calls }
}

describe('useProgramProposalActions: accept', () => {
	it('puts the returned program into the cache and reads the feed again', async () => {
		const program = makeProgram({ title: 'Нова' })
		const { result, queryClient, invalidatedKeys, calls } = setup(() => ({
			status: 200,
			data: { data: program },
		}))

		act(() => {
			result.current.accept.mutate(MESSAGE_ID)
		})

		await waitFor(() => {
			expect(result.current.accept.isSuccess).toBe(true)
		})
		expect(calls).toEqual([`/programs/proposals/${MESSAGE_ID}/accept`])
		expect(queryClient.getQueryData(activeProgramQueryOptions.queryKey)).toEqual(program)
		expect(invalidatedKeys()).toContainEqual(['messages'])
		expect(invalidatedKeys()).toContainEqual(['program', 'versions'])
		expect(invalidatedKeys()).toContainEqual(['workouts', 'dictionary'])
	})

	it('on a conflict reads the program and the feed again and leaves the cache alone', async () => {
		const { result, queryClient, invalidatedKeys } = setup(() => ({
			status: 409,
			data: apiErrorBody(409, 'PROGRAM_VERSION_CONFLICT'),
		}))

		act(() => {
			result.current.accept.mutate(MESSAGE_ID)
		})

		await waitFor(() => {
			expect(result.current.accept.isError).toBe(true)
		})
		expect(queryClient.getQueryData(activeProgramQueryOptions.queryKey)).toBeUndefined()
		expect(invalidatedKeys()).toContainEqual(['program'])
		expect(invalidatedKeys()).toContainEqual(['messages'])
	})
})

describe('useProgramProposalActions: rebase', () => {
	const previousMessage = makeChatMessage({
		id: MESSAGE_ID,
		programCardState: { status: 'REPLACED', versionCreatedAt: null },
	})
	const message = makeChatMessage({ id: NEW_MESSAGE_ID })
	const feed: MessagesPage = {
		messages: [
			makeChatMessage({
				id: MESSAGE_ID,
				programCardState: { status: 'OUTDATED', versionCreatedAt: null },
			}),
		],
		nextCursor: null,
	}
	const getCachedStatus = (queryClient: QueryClient): string | undefined =>
		queryClient.getQueryData<{ pages: MessagesPage[] }>(MESSAGES_QUERY_KEY)?.pages[0]?.messages[0]
			?.programCardState?.status

	it('swaps the old card for its new state at once and reads the feed for the new message', async () => {
		const { result, queryClient, invalidatedKeys, calls } = setup(
			() => ({ status: 200, data: { data: { message, previousMessage } } }),
			feed,
		)

		act(() => {
			result.current.rebase.mutate(MESSAGE_ID)
		})

		await waitFor(() => {
			expect(result.current.rebase.isSuccess).toBe(true)
		})
		expect(calls).toEqual([`/programs/proposals/${MESSAGE_ID}/rebase`])
		expect(getCachedStatus(queryClient)).toBe('REPLACED')
		expect(invalidatedKeys()).toContainEqual(['messages'])
	})

	it('reads the feed again when it fails, without touching the cached card', async () => {
		const { result, queryClient, invalidatedKeys } = setup(
			() => ({ status: 409, data: apiErrorBody(409, 'PROGRAM_PROPOSAL_REPLACED') }),
			feed,
		)

		act(() => {
			result.current.rebase.mutate(MESSAGE_ID)
		})

		await waitFor(() => {
			expect(result.current.rebase.isError).toBe(true)
		})
		expect(getCachedStatus(queryClient)).toBe('OUTDATED')
		expect(invalidatedKeys()).toContainEqual(['messages'])
	})
})
