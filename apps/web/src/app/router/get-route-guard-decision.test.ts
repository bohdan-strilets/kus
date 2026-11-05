import { describe, expect, it } from 'vitest'

import { getReturnPath, getRouteGuardDecision } from './get-route-guard-decision'

const base = {
	path: '/app/today?day=2026-10-07',
	locationState: null,
	isPendingDeletion: false,
} as const

describe('getRouteGuardDecision — protected (/app/*)', () => {
	it('waits for the session check without rendering anything', () => {
		expect(getRouteGuardDecision({ ...base, guard: 'protected', status: 'pending' })).toEqual({
			action: 'loading',
		})
	})

	it('renders the page with a session', () => {
		expect(getRouteGuardDecision({ ...base, guard: 'protected', status: 'authenticated' })).toEqual(
			{ action: 'render' },
		)
	})

	it('sends an anonymous user to /login and remembers the full path', () => {
		expect(getRouteGuardDecision({ ...base, guard: 'protected', status: 'anonymous' })).toEqual({
			action: 'redirect',
			to: '/login',
			state: { from: '/app/today?day=2026-10-07' },
		})
	})

	it('shows the retry state when the check failed on the network', () => {
		expect(getRouteGuardDecision({ ...base, guard: 'protected', status: 'error' })).toEqual({
			action: 'error',
		})
	})
})

describe('getRouteGuardDecision — account pending deletion', () => {
	const pending = { ...base, status: 'authenticated', isPendingDeletion: true } as const

	it('sends every protected page to account-restore', () => {
		expect(getRouteGuardDecision({ ...pending, guard: 'protected' })).toEqual({
			action: 'redirect',
			to: '/app/account-restore',
		})
	})

	it('renders account-restore itself, ignoring query and hash', () => {
		expect(
			getRouteGuardDecision({
				...pending,
				guard: 'protected',
				path: '/app/account-restore?x=1#top',
			}),
		).toEqual({ action: 'render' })
	})

	it('sends a healthy account away from account-restore', () => {
		expect(
			getRouteGuardDecision({
				...base,
				guard: 'protected',
				status: 'authenticated',
				path: '/app/account-restore',
			}),
		).toEqual({ action: 'redirect', to: '/app' })
	})

	it('sends a login/register visitor to account-restore, not back to where they came from', () => {
		expect(
			getRouteGuardDecision({
				...pending,
				guard: 'guest',
				path: '/login',
				locationState: { from: '/app/recipes' },
			}),
		).toEqual({ action: 'redirect', to: '/app/account-restore' })
	})
})

describe('getRouteGuardDecision — guest (/login, /register)', () => {
	const guest = { path: '/login', guard: 'guest', isPendingDeletion: false } as const

	it('waits for the session check', () => {
		expect(getRouteGuardDecision({ ...guest, status: 'pending', locationState: null })).toEqual({
			action: 'loading',
		})
	})

	it('renders the form for an anonymous user and when the check failed', () => {
		for (const status of ['anonymous', 'error'] as const) {
			expect(getRouteGuardDecision({ ...guest, status, locationState: null })).toEqual({
				action: 'render',
			})
		}
	})

	it('sends a logged-in user back to where they came from', () => {
		expect(
			getRouteGuardDecision({
				...guest,
				status: 'authenticated',
				locationState: { from: '/app/recipes' },
			}),
		).toEqual({ action: 'redirect', to: '/app/recipes' })
	})

	it('falls back to /app without a usable return path', () => {
		expect(
			getRouteGuardDecision({ ...guest, status: 'authenticated', locationState: null }),
		).toEqual({ action: 'redirect', to: '/app' })
	})
})

describe('getReturnPath', () => {
	it.each([
		['/app', '/app'],
		['/app/today?day=1#top', '/app/today?day=1#top'],
	])('accepts %s', (from, expected) => {
		expect(getReturnPath({ from })).toBe(expected)
	})

	it.each([
		['an absolute URL', 'https://evil.example/app'],
		['a protocol-relative URL', '//evil.example/app'],
		['a guest page (would loop)', '/login'],
		['a look-alike prefix', '/application'],
		['a dot segment leaving /app', '/app/../login'],
		['not a string', 42],
	])('rejects %s', (_case, from) => {
		expect(getReturnPath({ from })).toBeNull()
	})

	it('rejects a missing state', () => {
		expect(getReturnPath(undefined)).toBeNull()
		expect(getReturnPath('from')).toBeNull()
	})
})

describe('getRouteGuardDecision — pending check with a kept live workout', () => {
	const pending = { ...base, guard: 'protected', status: 'pending', hasOfflineLive: true } as const

	it('renders the live route at once, ignoring query and hash', () => {
		expect(getRouteGuardDecision({ ...pending, path: '/app/training/live' })).toEqual({
			action: 'render',
		})
		expect(getRouteGuardDecision({ ...pending, path: '/app/training/live?x=1#top' })).toEqual({
			action: 'render',
		})
	})

	it('keeps the loader on any other route', () => {
		expect(getRouteGuardDecision({ ...pending, path: '/app/today' })).toEqual({
			action: 'loading',
		})
		expect(getRouteGuardDecision({ ...pending, path: '/app/training/live-other' })).toEqual({
			action: 'loading',
		})
	})

	it('keeps the loader without a kept session (or when it belongs to another owner)', () => {
		expect(
			getRouteGuardDecision({ ...pending, hasOfflineLive: false, path: '/app/training/live' }),
		).toEqual({ action: 'loading' })
	})

	it('keeps the loader on a guest route', () => {
		expect(
			getRouteGuardDecision({ ...pending, guard: 'guest', path: '/app/training/live' }),
		).toEqual({ action: 'loading' })
	})
})

describe('getRouteGuardDecision — offline live workout', () => {
	const offline = {
		...base,
		guard: 'protected',
		status: 'error',
		isNetworkError: true,
		hasOfflineLive: true,
	} as const

	it('renders the live screen alone when offline with a kept session', () => {
		expect(getRouteGuardDecision({ ...offline, path: '/app/training/live' })).toEqual({
			action: 'render',
		})
	})

	it('ignores query and hash on the live path', () => {
		expect(getRouteGuardDecision({ ...offline, path: '/app/training/live?x=1#top' })).toEqual({
			action: 'render',
		})
	})

	it('offers the way back into the session on any other route', () => {
		expect(getRouteGuardDecision({ ...offline, path: '/app/today' })).toEqual({
			action: 'error',
			canResumeLive: true,
		})
		expect(getRouteGuardDecision({ ...offline, path: '/app/training/live-other' })).toEqual({
			action: 'error',
			canResumeLive: true,
		})
	})

	it('shows plain retry without a kept session, even on the live path', () => {
		expect(
			getRouteGuardDecision({ ...offline, hasOfflineLive: false, path: '/app/training/live' }),
		).toEqual({ action: 'error' })
		expect(getRouteGuardDecision({ ...offline, hasOfflineLive: false })).toEqual({
			action: 'error',
		})
	})

	it('never opens the live screen for an error that is not a network one', () => {
		expect(
			getRouteGuardDecision({ ...offline, isNetworkError: false, path: '/app/training/live' }),
		).toEqual({ action: 'error' })
	})

	it('does not render the live screen for an anonymous or pending session', () => {
		expect(
			getRouteGuardDecision({ ...offline, status: 'anonymous', path: '/app/training/live' }),
		).toMatchObject({ action: 'redirect', to: '/login' })
		expect(
			getRouteGuardDecision({
				...offline,
				status: 'pending',
				hasOfflineLive: false,
				path: '/app/training/live',
			}),
		).toEqual({ action: 'loading' })
	})
})
