import { QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { I18nextProvider } from 'react-i18next'

import { i18n } from '@/shared/i18n'

import { queryClient } from './query-client'

export const AppProviders = ({ children }: { children: ReactNode }) => (
	<I18nextProvider i18n={i18n}>
		<QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
	</I18nextProvider>
)
