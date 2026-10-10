import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import {
	render,
	renderHook,
	type RenderHookResult,
	type RenderResult,
} from '@testing-library/react'
import type { ReactElement, ReactNode } from 'react'
import { I18nextProvider } from 'react-i18next'
import { MemoryRouter } from 'react-router'

import { i18n } from '@/shared/i18n'
import { ToastProvider } from '@/shared/ui'

import { stubMatchMedia } from './match-media'
import { PathnameSpy } from './PathnameSpy'

interface RenderOptions {
	queryClient?: QueryClient
	route?: string
	/** Called with the router pathname on every render: lets a test see where the app navigated. */
	onPathname?: (pathname: string) => void
}

const createTestQueryClient = (): QueryClient =>
	new QueryClient({ defaultOptions: { queries: { retry: false } } })

/** Tests only: the providers a feature needs (texts, queries, router, toasts), real Ukrainian copy. */
export const createWrapper = ({
	queryClient = createTestQueryClient(),
	route = '/',
	onPathname,
}: RenderOptions = {}): (({ children }: { children: ReactNode }) => ReactElement) => {
	stubMatchMedia()
	const Wrapper = ({ children }: { children: ReactNode }): ReactElement => (
		<I18nextProvider i18n={i18n}>
			<QueryClientProvider client={queryClient}>
				<MemoryRouter initialEntries={[route]}>
					{onPathname ? <PathnameSpy onPathname={onPathname} /> : null}
					<ToastProvider>{children}</ToastProvider>
				</MemoryRouter>
			</QueryClientProvider>
		</I18nextProvider>
	)
	return Wrapper
}

/** Tests only: renderHook inside the same providers. */
export const renderHookWithProviders = <Result,>(
	hook: () => Result,
	options: RenderOptions = {},
): RenderHookResult<Result, unknown> => renderHook(hook, { wrapper: createWrapper(options) })

export const renderWithProviders = (
	ui: ReactElement,
	options: RenderOptions = {},
): RenderResult => {
	const Wrapper = createWrapper(options)
	return render(<Wrapper>{ui}</Wrapper>)
}
