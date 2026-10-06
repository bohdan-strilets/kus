import { createContext } from 'react'

export interface ToastApi {
	/** Shows a short message about an action (CLAUDE.md §12: toast is for action errors/results). */
	show: (message: string) => void
}

export const ToastContext = createContext<ToastApi | null>(null)
