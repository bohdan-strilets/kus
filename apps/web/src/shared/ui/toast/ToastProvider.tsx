import * as RadixToast from '@radix-ui/react-toast'
import { AnimatePresence, motion } from 'motion/react'
import { type ReactNode, useCallback, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { TRANSITION } from '@/shared/lib'

import { MAX_VISIBLE_TOASTS, TOAST_ENTER_OFFSET_PX } from './toast.constants'
import { type ToastApi, ToastContext } from './toast.context'
import type { ToastItem } from './toast.types'
import { useToastTimers } from './use-toast-timers'

/**
 * No mockup exists for toasts; agreed minimal look: a surface card, radius 18, shadow-chip,
 * 15/600, text action 15/700, at the top of the screen under the header (the bottom is taken by
 * the composer and the sheet buttons), no icons. Radix Toast gives the live region, swipe and
 * hotkey; closing is ours (useToastTimers, dismissAll on navigation).
 */
export const ToastProvider = ({ children }: { children: ReactNode }) => {
	const { t } = useTranslation()
	const [toasts, setToasts] = useState<ToastItem[]>([])
	// a counter, not crypto.randomUUID(): that one exists only in secure contexts (no http on LAN)
	const nextId = useRef(0)

	const dismiss = useCallback((id: number): void => {
		setToasts((current) => current.filter((toast) => toast.id !== id))
	}, [])

	useToastTimers(toasts, dismiss)

	const api = useMemo<ToastApi>(
		() => ({
			show: (message, options) => {
				nextId.current += 1
				const toast: ToastItem = { id: nextId.current, message, action: options?.action }
				setToasts((current) => [...current, toast].slice(-MAX_VISIBLE_TOASTS))
			},
			dismissAll: () => {
				setToasts([])
			},
		}),
		[],
	)

	return (
		<ToastContext value={api}>
			{/* Infinity: Radix never closes a toast by itself, see useToastTimers */}
			<RadixToast.Provider label={t('toast.label')} duration={Infinity} swipeDirection="up">
				{children}
				<AnimatePresence>
					{toasts.map((toast) => (
						<RadixToast.Root
							key={toast.id}
							forceMount
							asChild
							onOpenChange={(isOpen) => {
								if (!isOpen) dismiss(toast.id)
							}}
						>
							<motion.li
								layout
								initial={{ opacity: 0, y: TOAST_ENTER_OFFSET_PX }}
								animate={{ opacity: 1, y: 0, transition: TRANSITION.base }}
								exit={{ opacity: 0, transition: TRANSITION.exit }}
								className="pointer-events-auto flex items-center justify-between gap-3 rounded-chip bg-surface px-4 py-3 shadow-chip"
							>
								<RadixToast.Description className="text-body font-semibold text-ink">
									{toast.message}
								</RadixToast.Description>
								{toast.action && (
									<RadixToast.Action asChild altText={toast.action.label}>
										<button
											type="button"
											className="min-h-tap min-w-tap shrink-0 cursor-pointer text-body font-bold text-primary"
											onClick={toast.action.onClick}
										>
											{toast.action.label}
										</button>
									</RadixToast.Action>
								)}
							</motion.li>
						</RadixToast.Root>
					))}
				</AnimatePresence>
				{/* under the header, inside the app column, above sheets and dialogs (z-50) */}
				<RadixToast.Viewport
					label={t('toast.viewport')}
					className="pointer-events-none fixed inset-x-0 top-below-header z-60 mx-auto flex max-w-app flex-col gap-2 px-gutter outline-none"
				/>
			</RadixToast.Provider>
		</ToastContext>
	)
}
