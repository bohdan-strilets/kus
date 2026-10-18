import type { ToastAction } from './toast.context'

export interface ToastItem {
	id: number
	message: string
	action?: ToastAction
}
