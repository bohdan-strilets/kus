import type { ReactNode } from 'react'

import { cn } from '@/shared/lib'

export interface AppLayoutProps {
	children: ReactNode
	/** The fixed bottom nav; the content gets room under it. */
	bottomNav?: ReactNode
}

/**
 * docs AppShell: bg-app on the whole viewport, a 480px column in the middle on wide screens,
 * safe-area insets for the notch and the home indicator.
 */
export const AppLayout = ({ children, bottomNav }: AppLayoutProps) => (
	<div className="min-h-dvh bg-app bg-fixed">
		<div className="mx-auto flex min-h-dvh w-full max-w-app flex-col pt-safe-top pb-safe-bottom">
			{/* room for the floating nav: 68 tall + 20 margin + air */}
			<main className={cn('flex flex-1 flex-col', bottomNav && 'pb-28')}>{children}</main>
			{bottomNav}
		</div>
	</div>
)
