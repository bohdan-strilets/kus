import { CheckIcon, WarningCircleIcon } from '@phosphor-icons/react'
import type { ReactNode } from 'react'

import { cn } from '@/shared/lib'

import { type BadgeVariantProps, badgeVariants } from './badge.variants'

const SUCCESS_ICON_SIZE = 16
const FAILED_ICON_SIZE = 14

export type BadgeProps = BadgeVariantProps & {
	/** Text for kcal / failed. */
	children?: ReactNode
	/** Accessible name for the icon-only variants (notice, success); omit when the context says it. */
	label?: string
	className?: string
}

const getA11yProps = (isIconOnly: boolean, label: string | undefined) => {
	if (!isIconOnly) return {}
	if (!label) return { 'aria-hidden': true }
	return { role: 'img', 'aria-label': label }
}

export const Badge = ({ variant, children, label, className }: BadgeProps) => {
	const isIconOnly = variant === 'notice' || variant === 'success'
	const a11yProps = getA11yProps(isIconOnly, label)

	return (
		<span className={cn(badgeVariants({ variant }), className)} {...a11yProps}>
			{variant === 'success' && <CheckIcon aria-hidden size={SUCCESS_ICON_SIZE} weight="bold" />}
			{variant === 'failed' && (
				<WarningCircleIcon aria-hidden size={FAILED_ICON_SIZE} weight="bold" />
			)}
			{!isIconOnly && children}
		</span>
	)
}
