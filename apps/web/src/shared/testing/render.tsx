import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, type RenderResult } from '@testing-library/react'
import type { ReactElement } from 'react'
import { I18nextProvider } from 'react-i18next'
import { MemoryRouter } from 'react-router'

import { i18n } from '@/shared/i18n'
import { ToastProvider } from '@/shared/ui'

import { stubMatchMedia } from './match-media'

interface RenderOptions {
	queryClient?: QueryClient
	route?: string
}

/** Tests only: the providers a feature needs (texts, queries, router, toasts), real Ukrainian copy. */
export const renderWithProviders = (
	ui: ReactElement,
	{
		queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } }),
		route = '/',
	}: RenderOptions = {},
): RenderResult => {
	stubMatchMedia()
	return render(
		<I18nextProvider i18n={i18n}>
			<QueryClientProvider client={queryClient}>
				<MemoryRouter initialEntries={[route]}>
					<ToastProvider>{ui}</ToastProvider>
				</MemoryRouter>
			</QueryClientProvider>
		</I18nextProvider>,
	)
}
