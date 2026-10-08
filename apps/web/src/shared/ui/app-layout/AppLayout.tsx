import type { ReactNode } from 'react'

import { cn } from '@/shared/lib'

export interface AppLayoutProps {
	children: ReactNode
	/** The fixed bottom nav; the content gets room under it. */
	bottomNav?: ReactNode
	/** Exactly one screen tall, the page scrolls inside itself (the chat feed). */
	isFixedHeight?: boolean
}

/**
 * docs AppShell: bg-app on the whole viewport, a 480px column in the middle on wide screens,
 * safe-area insets for the notch and the home indicator.
 */
export const AppLayout = ({ children, bottomNav, isFixedHeight = false }: AppLayoutProps) => (
	<div className={cn('bg-app bg-fixed', isFixedHeight ? 'h-dvh overflow-hidden' : 'min-h-dvh')}>
		<div
			className={cn(
				'mx-auto flex w-full max-w-app flex-col pt-safe-top pb-safe-bottom',
				isFixedHeight ? 'h-full' : 'min-h-dvh',
			)}
		>
			{/* room for the floating nav: 68 tall + 20 margin + air */}
			<main className={cn('flex min-h-0 flex-1 flex-col', bottomNav && 'pb-28')}>{children}</main>
			{bottomNav}
		</div>
	</div>
)
