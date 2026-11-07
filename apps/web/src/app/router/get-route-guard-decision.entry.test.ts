import { describe, expect, it } from 'vitest'

import { TRAINING_LIVE_ROUTE } from '@/shared/config'

import { getRouteGuardDecision, type GuardDecision } from './get-route-guard-decision'

type Input = Parameters<typeof getRouteGuardDecision>[0]
type Status = Input['status']

const CHAT = '/app'
const LIVE_WITH_QUERY = `${TRAINING_LIVE_ROUTE}?from=today#top`
const GO_LIVE: GuardDecision = { action: 'redirect', to: TRAINING_LIVE_ROUTE }

interface StatusCase {
	status: Status
	isNetworkError: boolean
}

const STATUSES: readonly StatusCase[] = [
	{ status: 'pending', isNetworkError: false },
	{ status: 'authenticated', isNetworkError: false },
	{ status: 'error', isNetworkError: true },
	{ status: 'error', isNetworkError: false },
	{ status: 'anonymous', isNetworkError: false },
]

const decide = (overrides: Partial<Input> & StatusCase): GuardDecision =>
	getRouteGuardDecision({
		guard: 'protected',
		hasOfflineLive: true,
		isEntry: true,
		isOfflineLiveFresh: true,
		path: CHAT,
		locationState: null,
		isPendingDeletion: false,
		...overrides,
	})

describe('getRouteGuardDecision: cold start into a fresh live workout', () => {
	it.each([
		['pending', 'pending', false, GO_LIVE],
		['authenticated', 'authenticated', false, GO_LIVE],
		['error with a network failure', 'error', true, GO_LIVE],
		['error without a network failure', 'error', false, { action: 'error' }],
		['anonymous', 'anonymous', false, { action: 'redirect', to: '/login', state: { from: CHAT } }],
	] as const)('entry + fresh + offline copy, %s', (_name, status, isNetworkError, expected) => {
		expect(decide({ status, isNetworkError })).toEqual(expected)
	})

	it('does not redirect when already on the live route, with or without query and hash', () => {
		const render = { action: 'render' }

		expect(
			decide({ status: 'authenticated', isNetworkError: false, path: TRAINING_LIVE_ROUTE }),
		).toEqual(render)
		expect(
			decide({ status: 'authenticated', isNetworkError: false, path: LIVE_WITH_QUERY }),
		).toEqual(render)
		expect(decide({ status: 'pending', isNetworkError: false, path: LIVE_WITH_QUERY })).toEqual(
			render,
		)
	})

	it('redirects from a query-carrying path of another page', () => {
		expect(
			decide({ status: 'pending', isNetworkError: false, path: '/app/today?day=2026-11-01' }),
		).toEqual(GO_LIVE)
	})

	it('a pending-deletion account goes to account-restore, not the workout', () => {
		const restore = { action: 'redirect', to: '/app/account-restore' }

		expect(
			decide({ status: 'authenticated', isNetworkError: false, isPendingDeletion: true }),
		).toEqual(restore)
		expect(
			decide({
				status: 'authenticated',
				isNetworkError: false,
				isPendingDeletion: true,
				path: TRAINING_LIVE_ROUTE,
			}),
		).toEqual(restore)
	})

	describe.each(STATUSES)('$status (network: $isNetworkError): old behaviour is kept', (input) => {
		const old = (overrides: Partial<Input>): GuardDecision =>
			getRouteGuardDecision({
				guard: 'protected',
				status: input.status,
				isNetworkError: input.isNetworkError,
				hasOfflineLive: true,
				path: CHAT,
				locationState: null,
				isPendingDeletion: false,
				...overrides,
			})

		it('not an entry', () => {
			expect(decide({ ...input, isEntry: false })).toEqual(old({}))
			expect(decide({ ...input, isEntry: false })).not.toEqual(GO_LIVE)
		})

		it('a stale copy', () => {
			expect(decide({ ...input, isOfflineLiveFresh: false })).toEqual(old({}))
			expect(decide({ ...input, isOfflineLiveFresh: false })).not.toEqual(GO_LIVE)
		})

		it('no offline copy at all', () => {
			expect(decide({ ...input, hasOfflineLive: false })).toEqual(old({ hasOfflineLive: false }))
			expect(decide({ ...input, hasOfflineLive: false })).not.toEqual(GO_LIVE)
		})
	})

	it('keeps the error for a non-entry or stale offline error on another page', () => {
		const resume = { action: 'error' }

		expect(decide({ status: 'error', isNetworkError: true, isEntry: false })).toEqual(resume)
		expect(decide({ status: 'error', isNetworkError: true, isOfflineLiveFresh: false })).toEqual(
			resume,
		)
	})

	it('a non-entry pending check on the live route still renders from the copy', () => {
		expect(
			decide({
				status: 'pending',
				isNetworkError: false,
				isEntry: false,
				path: TRAINING_LIVE_ROUTE,
			}),
		).toEqual({ action: 'render' })
	})

	it('a non-entry pending check elsewhere keeps loading', () => {
		expect(decide({ status: 'pending', isNetworkError: false, isEntry: false })).toEqual({
			action: 'loading',
		})
	})

	it('the guest guard is unchanged by entry and freshness', () => {
		const guest = (status: Status): GuardDecision =>
			getRouteGuardDecision({
				guard: 'guest',
				status,
				hasOfflineLive: true,
				isEntry: true,
				isOfflineLiveFresh: true,
				path: '/login',
				locationState: null,
				isPendingDeletion: false,
			})

		expect(guest('pending')).toEqual({ action: 'loading' })
		expect(guest('anonymous')).toEqual({ action: 'render' })
		expect(guest('error')).toEqual({ action: 'render' })
		expect(guest('authenticated')).toEqual({ action: 'redirect', to: '/app' })
	})
})
