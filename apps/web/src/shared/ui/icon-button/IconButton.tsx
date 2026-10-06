import { type HTMLMotionProps, motion } from 'motion/react'
import type { ReactNode } from 'react'

import { cn, PRESS } from '@/shared/lib'

import { type IconButtonVariantProps, iconButtonVariants } from './icon-button.variants'

export type IconButtonProps = IconButtonVariantProps &
	Omit<HTMLMotionProps<'button'>, 'children' | 'aria-label'> & {
		/** Accessible name — the icon alone says nothing to a screen reader. */
		label: string
		/** The icon, aria-hidden (Phosphor or a brand icon). */
		children: ReactNode
	}

export const IconButton = ({
	label,
	variant,
	size,
	disabled,
	type = 'button',
	className,
	children,
	...props
}: IconButtonProps) => (
	<motion.button
		type={type}
		aria-label={label}
		disabled={disabled}
		className={cn(iconButtonVariants({ variant, size }), className)}
		{...(disabled ? {} : PRESS)}
		{...props}
	>
		{children}
	</motion.button>
)
