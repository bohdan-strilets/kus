import * as RadixToast from '@radix-ui/react-toast'
import { AnimatePresence, motion } from 'motion/react'
import { type ReactNode, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { TRANSITION } from '@/shared/lib'

import { MAX_VISIBLE_TOASTS, TOAST_DURATION_MS, TOAST_ENTER_OFFSET_PX } from './toast.constants'
import { type ToastApi, ToastContext } from './toast.context'
import type { ToastItem } from './toast.types'

/**
 * No mockup exists for toasts; agreed minimal look: a surface card, radius 18, shadow-chip,
 * 14/600, above the bottom nav, no icons. Radix Toast gives the live region, swipe and hotkey.
 */
export const ToastProvider = ({ children }: { children: ReactNode }) => {
	const { t } = useTranslation()
	const [toasts, setToasts] = useState<ToastItem[]>([])
	// a counter, not crypto.randomUUID(): that one exists only in secure contexts (no http on LAN)
	const nextId = useRef(0)

	const api = useMemo<ToastApi>(
		() => ({
			show: (message) => {
				nextId.current += 1
				const toast = { id: nextId.current, message }
				setToasts((current) => [...current, toast].slice(-MAX_VISIBLE_TOASTS))
			},
		}),
		[],
	)

	const dismiss = (id: number): void => {
		setToasts((current) => current.filter((toast) => toast.id !== id))
	}

	return (
		<ToastContext value={api}>
			<RadixToast.Provider
				label={t('toast.label')}
				duration={TOAST_DURATION_MS}
				swipeDirection="down"
			>
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
								className="pointer-events-auto rounded-chip bg-surface px-4 py-3 shadow-chip"
							>
								<RadixToast.Description className="text-card-title font-semibold text-ink">
									{toast.message}
								</RadixToast.Description>
							</motion.li>
						</RadixToast.Root>
					))}
				</AnimatePresence>
				{/* above the floating nav (68 + 20 margin) and above sheets and dialogs (z-50) */}
				<RadixToast.Viewport
					label={t('toast.viewport')}
					className="pointer-events-none fixed inset-x-0 bottom-0 z-60 mx-auto mb-26 flex max-w-app flex-col gap-2 px-gutter pb-safe-bottom outline-none"
				/>
			</RadixToast.Provider>
		</ToastContext>
	)
}
