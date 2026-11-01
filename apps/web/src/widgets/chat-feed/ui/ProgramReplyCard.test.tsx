// @vitest-environment jsdom
import type { ChatMessage, ProgramCard, ProgramCardStatus } from '@kus/shared'
import { QueryClient } from '@tanstack/react-query'
import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { MESSAGES_QUERY_KEY, type MessagesPage } from '@/entities/message'
import { useComposerDraftStore } from '@/features/send-message'
import { httpClient } from '@/shared/api'
import {
	apiErrorBody,
	createFakeAdapter,
	type FakeHandler,
	makeChatMessage,
	makeProgram,
	renderWithProviders,
} from '@/shared/testing'

import { ProgramReplyCard } from './ProgramReplyCard'

const MESSAGE_ID = '0199b3a4-0000-7000-8000-000000000011'
const BASE_VERSION_ID = '0199b3a4-0000-7000-8000-0000000000a2'
const TEMPLATE_KEY = '0199b3a4-0000-7000-8000-000000000001'
const originalAdapter = httpClient.defaults.adapter
const EMPTY_TARGET = {
	sets: null,
	repsMin: null,
	repsMax: null,
	weightKg: null,
	progressStepKg: null,
	restSec: null,
	durationMin: null,
	distanceM: null,
}

const makeCard = (isInitial: boolean): ProgramCard => ({
	v: 1,
	baseVersionId: isInitial ? null : BASE_VERSION_ID,
	program: {
		title: null,
		mode: 'ROTATE',
		perWeek: 3,
		pinnedKey: null,
		templates: [
			{
				key: TEMPLATE_KEY,
				name: 'Тренування А',
				weekdays: [],
				estimatedMin: 55,
				exercises: [
					{
						name: 'Жим лежачи',
						exerciseId: null,
						kind: 'STRENGTH',
						muscleGroup: 'CHEST',
						target: { ...EMPTY_TARGET, sets: 3, repsMin: 8, repsMax: 12, weightKg: 60 },
					},
				],
			},
		],
	},
	changes: { v: 1, initial: isInitial, lines: [], unchangedTemplates: 0 },
})

const makeMessage = (
	status: ProgramCardStatus,
	{
		isInitial = true,
		versionCreatedAt = null,
	}: { isInitial?: boolean; versionCreatedAt?: string | null } = {},
): ChatMessage =>
	makeChatMessage({
		id: MESSAGE_ID,
		programCard: makeCard(isInitial),
		programCardState: { status, versionCreatedAt },
	})

beforeEach(() => {
	useComposerDraftStore.setState({ isFocusRequested: false })
})

afterEach(() => {
	cleanup()
	httpClient.defaults.adapter = originalAdapter
	vi.restoreAllMocks()
})

const setup = (message: ChatMessage, handler: FakeHandler, feed?: MessagesPage) => {
	const fake = createFakeAdapter(handler)
	httpClient.defaults.adapter = fake.adapter
	const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
	if (feed) queryClient.setQueryData(MESSAGES_QUERY_KEY, { pages: [feed], pageParams: [null] })
	const view = renderWithProviders(
		<ProgramReplyCard message={message} isFromOnboarding={false} />,
		{
			queryClient,
		},
	)
	return { ...view, queryClient, calls: fake.calls }
}

describe('ProgramReplyCard: proposal', () => {
	it('«Змінити в чаті» asks the composer for focus and sends nothing', () => {
		const { calls } = setup(makeMessage('OPEN'), () => ({ status: 500 }))

		fireEvent.click(screen.getByRole('button', { name: 'Змінити в чаті' }))

		expect(useComposerDraftStore.getState().isFocusRequested).toBe(true)
		expect(calls).toEqual([])
	})

	it('«Прийняти» locks both buttons while the request runs and sends it once', async () => {
		let release: (() => void) | undefined
		const gate = new Promise<void>((resolve) => {
			release = resolve
		})
		const { calls } = setup(makeMessage('OPEN'), async () => {
			await gate
			return { status: 200, data: { data: makeProgram() } }
		})

		const accept = screen.getByRole('button', { name: 'Прийняти' })
		fireEvent.click(accept)

		await waitFor(() => {
			expect(screen.getByRole('button', { name: 'Змінити в чаті' })).toHaveProperty(
				'disabled',
				true,
			)
		})
		expect(accept).toHaveProperty('disabled', true)
		fireEvent.click(accept)
		release?.()

		await waitFor(() => {
			expect(calls).toEqual([`/programs/proposals/${MESSAGE_ID}/accept`])
		})
	})

	it('once the feed says ACCEPTED the buttons are gone and the plaque shows the version date', () => {
		setup(makeMessage('ACCEPTED', { versionCreatedAt: '2026-10-31T10:00:00.000Z' }), () => ({
			status: 500,
		}))

		expect(screen.queryByRole('button', { name: 'Прийняти' })).toBeNull()
		expect(screen.queryByRole('button', { name: 'Змінити в чаті' })).toBeNull()
		expect(screen.getByRole('status').textContent).toContain('Прийнято · версія від')
	})

	it('shows the server conflict in a toast and unlocks the buttons again', async () => {
		setup(makeMessage('OPEN'), () => ({
			status: 409,
			data: apiErrorBody(409, 'PROGRAM_PROPOSAL_ALREADY_ACCEPTED'),
		}))

		fireEvent.click(screen.getByRole('button', { name: 'Прийняти' }))

		expect(await screen.findByText('Цю програму вже прийнято')).toBeTruthy()
		await waitFor(() => {
			expect(screen.getByRole('button', { name: 'Прийняти' })).toHaveProperty('disabled', false)
		})
	})

	it('says the connection error in a toast on a network failure', async () => {
		setup(makeMessage('OPEN'), () => 'network')

		fireEvent.click(screen.getByRole('button', { name: 'Прийняти' }))

		expect(
			await screen.findByText("Немає зв'язку з сервером. Перевір інтернет і спробуй ще раз."),
		).toBeTruthy()
	})

	it('a card of a message without state counts as open', () => {
		setup({ ...makeMessage('OPEN'), programCardState: null }, () => ({ status: 500 }))

		expect(screen.getByRole('button', { name: 'Прийняти' })).toBeTruthy()
	})
})

describe('ProgramReplyCard: outdated change card', () => {
	const previousMessage = makeMessage('REPLACED', { isInitial: false })
	const rebasedMessage = makeChatMessage({ id: '0199b3a4-0000-7000-8000-000000000012' })
	const feed: MessagesPage = {
		messages: [makeMessage('OUTDATED', { isInitial: false })],
		nextCursor: null,
	}

	it('offers «Перерахувати» instead of «Прийняти»', () => {
		setup(makeMessage('OUTDATED', { isInitial: false }), () => ({ status: 500 }))

		expect(screen.getByRole('button', { name: 'Перерахувати' })).toBeTruthy()
		expect(screen.queryByRole('button', { name: 'Прийняти' })).toBeNull()
		expect(screen.getByText('Програма вже змінилась — перерахуй зміни')).toBeTruthy()
	})

	it('«Перерахувати» calls rebase and replaces the previous message in the feed', async () => {
		const { queryClient, calls } = setup(
			makeMessage('OUTDATED', { isInitial: false }),
			() => ({
				status: 200,
				data: { data: { message: rebasedMessage, previousMessage } },
			}),
			feed,
		)

		fireEvent.click(screen.getByRole('button', { name: 'Перерахувати' }))

		await waitFor(() => {
			expect(calls).toContain(`/programs/proposals/${MESSAGE_ID}/rebase`)
		})
		await waitFor(() => {
			const cached = queryClient.getQueryData<{ pages: MessagesPage[] }>(MESSAGES_QUERY_KEY)
			expect(cached?.pages[0]?.messages[0]?.programCardState?.status).toBe('REPLACED')
		})
		expect(calls).not.toContain(`/programs/proposals/${MESSAGE_ID}/accept`)
	})

	it('toasts the server reason when the card cannot be rebased', async () => {
		setup(makeMessage('OUTDATED', { isInitial: false }), () => ({
			status: 409,
			data: apiErrorBody(409, 'PROGRAM_PROPOSAL_REPLACED'),
		}))

		fireEvent.click(screen.getByRole('button', { name: 'Перерахувати' }))

		expect(await screen.findByText("З'явилась новіша пропозиція")).toBeTruthy()
	})

	it('a replaced card is dimmed and has no buttons', () => {
		setup(makeMessage('REPLACED', { isInitial: false }), () => ({ status: 500 }))

		expect(screen.queryByRole('button', { name: 'Перерахувати' })).toBeNull()
		expect(screen.queryByRole('button', { name: 'Прийняти' })).toBeNull()
	})
})

describe('ProgramReplyCard: no card', () => {
	it('renders nothing for a message without a program card', () => {
		const { container } = setup(makeChatMessage({ id: MESSAGE_ID }), () => ({ status: 500 }))

		expect(container.textContent).toBe('')
	})
})
