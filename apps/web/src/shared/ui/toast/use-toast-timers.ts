import { useEffect, useRef, useSyncExternalStore } from 'react'

import { TOAST_ACTION_DURATION_MS, TOAST_DURATION_MS } from './toast.constants'
import type { ToastItem } from './toast.types'

const subscribeToVisibility = (onChange: () => void): (() => void) => {
	document.addEventListener('visibilitychange', onChange)
	return () => {
		document.removeEventListener('visibilitychange', onChange)
	}
}

const getIsDocumentHidden = (): boolean => document.hidden

export const getToastDurationMs = (toast: ToastItem): number =>
	toast.action ? TOAST_ACTION_DURATION_MS : TOAST_DURATION_MS

/**
 * Our own clock per toast instead of Radix's: Radix pauses it while the toast is hovered or
 * focused, and on iOS a tap leaves a sticky «hover», so the toast would never close. Only a hidden
 * tab pauses ours — nobody reads a toast in the background — and the time left is kept.
 */
export const useToastTimers = (toasts: ToastItem[], dismiss: (id: number) => void): void => {
	const isHidden = useSyncExternalStore(subscribeToVisibility, getIsDocumentHidden, () => false)
	const remainingMs = useRef(new Map<number, number>())

	useEffect(() => {
		const remaining = remainingMs.current
		const liveIds = new Set(toasts.map((toast) => toast.id))
		for (const id of remaining.keys()) {
			if (!liveIds.has(id)) remaining.delete(id)
		}
		if (isHidden) return

		const startedAt = Date.now()
		const timers = new Map<number, ReturnType<typeof setTimeout>>()
		for (const toast of toasts) {
			const leftMs = remaining.get(toast.id) ?? getToastDurationMs(toast)
			remaining.set(toast.id, leftMs)
			timers.set(
				toast.id,
				setTimeout(() => {
					dismiss(toast.id)
				}, leftMs),
			)
		}

		return () => {
			const elapsedMs = Date.now() - startedAt
			for (const [id, timer] of timers) {
				clearTimeout(timer)
				remaining.set(id, Math.max(0, (remaining.get(id) ?? 0) - elapsedMs))
			}
		}
	}, [toasts, isHidden, dismiss])
}
