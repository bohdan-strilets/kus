import type { ReactNode } from 'react'

import { AppLayout, DecorBackdrop } from '@/shared/ui'

import { AuthTabs } from './AuthTabs'

interface AuthLayoutProps {
	/** Hamster + wordmark: stacked on login, in a row on registration. */
	header: ReactNode
	children: ReactNode
}

/** auth-login / auth-register: centred column, 24px sides, 18px between blocks, decor behind. */
export const AuthLayout = ({ header, children }: AuthLayoutProps) => (
	<AppLayout>
		<div className="relative isolate flex flex-1 flex-col items-center justify-center gap-4.5 px-6 py-8">
			<DecorBackdrop />
			{header}
			<AuthTabs />
			{children}
		</div>
	</AppLayout>
)
