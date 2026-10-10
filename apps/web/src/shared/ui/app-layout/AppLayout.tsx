import type { ReactNode } from 'react'

import { cn, getViewportBoxStyle, useIsTypingOnTouch, useViewportBox } from '@/shared/lib'

export interface AppLayoutProps {
	children: ReactNode
	/** The floating bottom nav; the content keeps room under it. */
	bottomNav?: ReactNode
	/** The page scrolls inside itself (the chat feed); otherwise the content area scrolls. */
	isFixedHeight?: boolean
}

/**
 * docs AppShell: bg-app, a 480px column in the middle on wide screens, safe-area insets.
 * The shell is exactly the visible part of the screen (visualViewport — on iOS the keyboard
 * doesn't shrink the page) and never scrolls itself: only the content area or the chat feed do,
 * so the header stays put and the composer sits right on the keyboard. While a field is focused
 * on a touch screen the keyboard is up and the tab bar steps aside.
 */
export const AppLayout = ({ children, bottomNav, isFixedHeight = false }: AppLayoutProps) => {
	const viewport = useViewportBox()
	const isTyping = useIsTypingOnTouch()
	const hasNav = bottomNav !== undefined && !isTyping

	return (
		<div
			className="fixed inset-x-0 top-0 h-dvh overflow-hidden bg-app"
			// dynamic: the keyboard changes the visible box; without visualViewport it stays 100dvh
			style={getViewportBoxStyle(viewport)}
		>
			<div className="relative mx-auto flex h-full w-full max-w-app flex-col pt-safe-top">
				<main
					className={cn(
						'flex min-h-0 flex-1 flex-col',
						isFixedHeight ? 'overflow-hidden' : 'overflow-y-auto overscroll-contain',
						// the home indicator is under the keyboard while typing: no room needed then
						hasNav ? 'pb-nav-room' : !isTyping && 'pb-safe-bottom',
					)}
				>
					{children}
				</main>
				{hasNav && <div className="absolute inset-x-0 bottom-0 z-30">{bottomNav}</div>}
			</div>
		</div>
	)
}
