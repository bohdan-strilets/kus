import { QueryClientProvider } from '@tanstack/react-query'
import { MotionConfig } from 'motion/react'
import type { ReactNode } from 'react'
import { I18nextProvider } from 'react-i18next'

import { i18n } from '@/shared/i18n'
import { ToastProvider } from '@/shared/ui'

import { queryClient } from './query-client'

export const AppProviders = ({ children }: { children: ReactNode }) => (
	<I18nextProvider i18n={i18n}>
		<QueryClientProvider client={queryClient}>
			{/* prefers-reduced-motion: Motion skips transform/layout animations app-wide (CLAUDE.md §7) */}
			<MotionConfig reducedMotion="user">
				<ToastProvider>{children}</ToastProvider>
			</MotionConfig>
		</QueryClientProvider>
	</I18nextProvider>
)
