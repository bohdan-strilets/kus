import { createContext } from 'react'

export interface ToastAction {
	/** Already translated. */
	label: string
	onClick: () => void
}

export interface ToastOptions {
	/** A quiet button inside the toast («Повернути»); the toast closes when it is tapped. */
	action?: ToastAction
	/** Survives the next route change (shown just before leaving the screen); the one after closes it. */
	keepOnNavigation?: boolean
}

export interface ToastApi {
	/** Shows a short message about an action (CLAUDE.md §12: toast is for action errors/results). */
	show: (message: string, options?: ToastOptions) => void
	/** Closes every toast but those kept for this one navigation: a toast belongs to the screen it was shown on. */
	dismissAll: () => void
}

export const ToastContext = createContext<ToastApi | null>(null)
