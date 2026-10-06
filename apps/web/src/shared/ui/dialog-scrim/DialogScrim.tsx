import { type HTMLMotionProps, motion } from 'motion/react'

import { cn, scrimVariants } from '@/shared/lib'

export type DialogScrimProps = HTMLMotionProps<'div'> & {
	/** sheet — scrim 0.4 (chat-edit-entry, install-hint); dialog — 0.45 (settings-delete-confirm). */
	tone?: 'sheet' | 'dialog'
}

/**
 * The dark layer under sheets and dialogs; fades with them. Rendered as the asChild of a Radix
 * Dialog.Overlay / AlertDialog.Overlay by the caller, so it works with both primitives.
 */
export const DialogScrim = ({ tone = 'sheet', className, ...overlayProps }: DialogScrimProps) => (
	<motion.div
		className={cn(
			'fixed inset-0 z-40',
			tone === 'dialog' ? 'bg-scrim-strong' : 'bg-scrim',
			className,
		)}
		variants={scrimVariants}
		initial="hidden"
		animate="visible"
		exit="hidden"
		{...overlayProps}
	/>
)
