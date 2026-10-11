// @vitest-environment jsdom
import type { AuthUser } from '@kus/shared'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, cleanup, render, screen, waitFor } from '@testing-library/react'
import { I18nextProvider } from 'react-i18next'
import { createBrowserRouter, Outlet, type RouteObject, useNavigate } from 'react-router'
import { RouterProvider } from 'react-router/dom'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { SESSION_QUERY_KEY, setSessionUser } from '@/entities/session'
import { useChangePasswordForm } from '@/features/change-password'
import { LogoutButton } from '@/features/logout'
import { httpClient } from '@/shared/api'
import { ROUTES } from '@/shared/config'
import { i18n } from '@/shared/i18n'
import { getHistoryIndex } from '@/shared/lib'
import { createFakeAdapter, stubMatchMedia } from '@/shared/testing'
import { AppLayout, ListRow, ScreenHeader, ToastProvider } from '@/shared/ui'
import { BottomNav } from '@/widgets/bottom-nav'

import { SessionGuard } from './SessionGuard'
import { StackLayout } from './StackLayout'

/*
 * The real guards, layouts, tab bar, screen header and the actions that navigate, on a real
 * browser history (jsdom keeps one per file and fires popstate on traversal): the app's history
 * as the iOS swipe-back sees it. The pages are stubs — their content is not the point.
 */

const user: AuthUser = {
	id: '6f1c2d3e-4a5b-4c6d-8e9f-0a1b2c3d4e5f',
	email: 'me@kus.app',
	name: null,
	addressAs: null,
	locale: 'uk',
	timezone: 'Europe/Warsaw',
	createdAt: '2026-10-01T08:00:00.000Z',
	pendingDeletion: false,
	purgeAt: null,
}
const originalAdapter = httpClient.defaults.adapter

const Stub = ({ name }: { name: string }) => <output data-testid="screen">{name}</output>

const TabStub = ({ name }: { name: string }) => {
	const navigate = useNavigate()
	return (
		<>
			<Stub name={name} />
			<button type="button" onClick={() => void navigate(ROUTES.profile)}>
				avatar
			</button>
		</>
	)
}

const ProfileStub = () => (
	<>
		<ScreenHeader title="profile" backTo={ROUTES.chat} />
		<Stub name="profile" />
		<ListRow label="settings" to={ROUTES.settings} />
		<LogoutButton label="logout" />
	</>
)

const SettingsStub = () => (
	<>
		<ScreenHeader title="settings" backTo={ROUTES.profile} />
		<Stub name="settings" />
		<ListRow label="password" to={ROUTES.settingsPassword} />
	</>
)

const PasswordStub = () => {
	const { form, onSubmit } = useChangePasswordForm()
	const submit = (): void => {
		form.setValue('currentPassword', 'old-password')
		form.setValue('newPassword', 'new-password-12')
		form.setValue('repeatPassword', 'new-password-12')
		void onSubmit()
	}
	return (
		<>
			<ScreenHeader title="password" backTo={ROUTES.settings} />
			<Stub name="password" />
			<button type="button" onClick={submit}>
				change
			</button>
		</>
	)
}

const LoginStub = ({ queryClient }: { queryClient: QueryClient }) => (
	<>
		<Stub name="login" />
		<button
			type="button"
			onClick={() => {
				setSessionUser(queryClient, user)
			}}
		>
			login
		</button>
	</>
)

const TabsLayout = () => (
	<AppLayout bottomNav={<BottomNav />}>
		<Outlet />
	</AppLayout>
)

/** The shape of app/router/router.tsx with stub pages. */
const createRoutes = (queryClient: QueryClient): RouteObject[] => [
	{
		element: <SessionGuard guard="guest" />,
		children: [{ path: ROUTES.login, element: <LoginStub queryClient={queryClient} /> }],
	},
	{
		path: ROUTES.chat,
		element: <SessionGuard guard="protected" />,
		children: [
			{
				element: <TabsLayout />,
				children: [
					{ index: true, element: <TabStub name="chat" /> },
					{ path: ROUTES.today, element: <TabStub name="today" /> },
					{ path: ROUTES.progress, element: <Stub name="progress" /> },
					{ path: ROUTES.recipes, element: <Stub name="recipes" /> },
				],
			},
			{
				element: <StackLayout />,
				children: [
					{ path: ROUTES.profile, element: <ProfileStub /> },
					{ path: ROUTES.settings, element: <SettingsStub /> },
					{ path: ROUTES.settingsPassword, element: <PasswordStub /> },
				],
			},
		],
	},
]

/** jsdom traverses the history in a later task and reports through popstate, like a browser. */
const traverse = async (go: () => void): Promise<void> => {
	await act(async () => {
		const popped = new Promise<void>((resolve) => {
			window.addEventListener(
				'popstate',
				() => {
					resolve()
				},
				{ once: true },
			)
		})
		go()
		await popped
	})
}

/** Back to the file's first entry, then rewrite it: every test starts at index 0 with nothing behind. */
const resetHistory = async (path: string): Promise<void> => {
	const behind = getHistoryIndex(window.history.state)
	if (behind > 0) {
		await traverse(() => {
			window.history.go(-behind)
		})
	}
	window.history.replaceState(null, '', path)
}

let disposeRouter: (() => void) | null = null

const renderApp = async ({
	at,
	isAuthenticated = true,
}: {
	at: string
	isAuthenticated?: boolean
}): Promise<void> => {
	await resetHistory(at)
	const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
	queryClient.setQueryData(SESSION_QUERY_KEY, isAuthenticated ? user : null)
	const router = createBrowserRouter(createRoutes(queryClient))
	disposeRouter = () => {
		router.dispose()
	}
	render(
		<I18nextProvider i18n={i18n}>
			<QueryClientProvider client={queryClient}>
				<ToastProvider>
					<RouterProvider router={router} />
				</ToastProvider>
			</QueryClientProvider>
		</I18nextProvider>,
	)
}

const press = async (role: 'button' | 'link', name: string): Promise<void> => {
	await act(async () => {
		screen.getByRole(role, { name }).click()
		await Promise.resolve()
	})
}

const tapBack = (): Promise<void> => press('button', i18n.t('common.back'))

const back = (): Promise<void> =>
	traverse(() => {
		window.history.back()
	})

interface Place {
	screen: string
	path: string
	index: number
}

const where = (): Place => ({
	screen: screen.getByTestId('screen').textContent,
	path: window.location.pathname,
	index: getHistoryIndex(window.history.state),
})

/** The router renders a traversal or a cache change on its own time: wait for the place, not a timer. */
const expectAt = async (place: Place): Promise<void> => {
	await waitFor(() => {
		expect(where()).toEqual(place)
	})
}

beforeEach(() => {
	stubMatchMedia()
})

afterEach(() => {
	cleanup()
	disposeRouter?.()
	disposeRouter = null
	httpClient.defaults.adapter = originalAdapter
})

describe('navigation history', () => {
	it('tabs switch in place: Back never flips between them', async () => {
		await renderApp({ at: ROUTES.chat })
		const entries = window.history.length

		await press('link', i18n.t('nav.today'))
		await expectAt({ screen: 'today', path: ROUTES.today, index: 0 })
		await press('link', i18n.t('nav.chat'))
		await expectAt({ screen: 'chat', path: ROUTES.chat, index: 0 })

		// no entry was added: there is nothing for Back to return to but what was before the app
		expect(window.history.length).toBe(entries)
	})

	it('profile → settings → back → back lands on the tab the profile was opened from', async () => {
		await renderApp({ at: ROUTES.chat })
		await press('link', i18n.t('nav.today'))
		await press('button', 'avatar')
		await press('link', 'settings')
		await expectAt({ screen: 'settings', path: ROUTES.settings, index: 2 })

		await tapBack()
		await expectAt({ screen: 'profile', path: ROUTES.profile, index: 1 })

		await tapBack()
		await expectAt({ screen: 'today', path: ROUTES.today, index: 0 })
	})

	it('a deep link into the stack unwinds to the parent, then the chat, with no new entries', async () => {
		await renderApp({ at: ROUTES.settings })
		await expectAt({ screen: 'settings', path: ROUTES.settings, index: 0 })

		await tapBack()
		await expectAt({ screen: 'profile', path: ROUTES.profile, index: 0 })

		await tapBack()
		await expectAt({ screen: 'chat', path: ROUTES.chat, index: 0 })
	})

	it('after a password change Back does not reopen the form', async () => {
		httpClient.defaults.adapter = createFakeAdapter(() => ({ status: 204 })).adapter
		await renderApp({ at: ROUTES.chat })
		await press('button', 'avatar')
		await press('link', 'settings')
		await press('link', 'password')
		await expectAt({ screen: 'password', path: ROUTES.settingsPassword, index: 3 })

		await press('button', 'change')
		await expectAt({ screen: 'settings', path: ROUTES.settings, index: 2 })

		await back()
		await expectAt({ screen: 'profile', path: ROUTES.profile, index: 1 })
	})

	it('login → chat: the login entry is replaced, nothing of it stays behind', async () => {
		await renderApp({ at: ROUTES.login, isAuthenticated: false })
		await expectAt({ screen: 'login', path: ROUTES.login, index: 0 })
		const entries = window.history.length

		await press('button', 'login')
		await expectAt({ screen: 'chat', path: ROUTES.chat, index: 0 })
		expect(window.history.length).toBe(entries)
	})

	it('a deep link while logged out returns there after login, still with nothing behind', async () => {
		await renderApp({ at: ROUTES.settings, isAuthenticated: false })
		await expectAt({ screen: 'login', path: ROUTES.login, index: 0 })

		await press('button', 'login')
		await expectAt({ screen: 'settings', path: ROUTES.settings, index: 0 })

		await tapBack()
		await expectAt({ screen: 'profile', path: ROUTES.profile, index: 0 })
	})

	it('logout → Back shows no screen of the app', async () => {
		httpClient.defaults.adapter = createFakeAdapter(() => ({ status: 204 })).adapter
		await renderApp({ at: ROUTES.chat })
		await press('button', 'avatar')
		await expectAt({ screen: 'profile', path: ROUTES.profile, index: 1 })

		await press('button', 'logout')
		await expectAt({ screen: 'login', path: ROUTES.login, index: 1 })

		await back()
		await expectAt({ screen: 'login', path: ROUTES.login, index: 0 })
	})
})
