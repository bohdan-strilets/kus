import { createContext } from 'react'

export interface ToastAction {
	/** Already translated. */
	label: string
	onClick: () => void
}

export interface ToastOptions {
	/** A quiet button inside the toast («Повернути»); the toast closes when it is tapped. */
	action?: ToastAction
}

export interface ToastApi {
	/** Shows a short message about an action (CLAUDE.md §12: toast is for action errors/results). */
	show: (message: string, options?: ToastOptions) => void
}

export const ToastContext = createContext<ToastApi | null>(null)
